import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { gradeMultipleChoiceAnswers } from "./gradeAssignment.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

interface PreviewInput {
  subjectId: string;
  assignmentId: string;
  answers: Record<string, string[] | string>;
}

/**
 * "Làm thử" đề bài cho giáo viên (admin hoặc viewer của ĐÚNG lớp) — chấm
 * bằng cùng logic với `submitAssignment` (đọc đáp án đúng qua Admin SDK) để
 * trả về điểm + câu nào đúng/sai ngay, nhưng KHÔNG ghi gì vào `submissions`.
 * Đây là tính năng cho giáo viên xem trước đề, không phải một lượt nộp bài
 * thật — không tính vào kết quả/tiến độ của học sinh.
 *
 * Không dùng Firestore Rules để chặn (rules không chạy trong Cloud Function,
 * vì Admin SDK bỏ qua rules) — tự kiểm tra quyền ở đây: phải có hồ sơ
 * /users/{uid} là giáo viên của ĐÚNG subjectId này, và nếu là viewer thì
 * phải đúng classId của đề bài.
 */
export const previewAssignment = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Cần đăng nhập để làm thử.");

    const { subjectId, assignmentId, answers } = request.data as PreviewInput;
    if (!subjectId || !assignmentId) {
      throw new HttpsError("invalid-argument", "Thiếu thông tin bắt buộc.");
    }

    const profileSnap = await db.collection("users").doc(uid).get();
    const profile = profileSnap.data();
    if (
      !profile ||
      profile.role !== "teacher" ||
      profile.subjectId !== subjectId
    ) {
      throw new HttpsError("permission-denied", "Bạn không thuộc môn học này.");
    }

    const assignmentRef = db
      .collection("subjects")
      .doc(subjectId)
      .collection("assignments")
      .doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đề bài.");
    }
    const assignment = assignmentSnap.data()!;

    // Viewer chỉ làm thử được đề của ĐÚNG lớp họ được gán. Admin (toàn quyền
    // trong môn) làm thử được mọi đề.
    if (
      profile.teacherRole === "viewer" &&
      profile.viewerClassId !== assignment.classId
    ) {
      throw new HttpsError("permission-denied", "Bạn chỉ xem được lớp mình được gán.");
    }

    const questionIds: string[] = assignment.questionIds ?? [];
    const { score, maxScore, perQuestion } = await gradeMultipleChoiceAnswers({
      db,
      subjectId,
      questionIds,
      answers: answers ?? {},
    });

    return { ok: true, preview: true, score, maxScore, perQuestion };
  }
);
