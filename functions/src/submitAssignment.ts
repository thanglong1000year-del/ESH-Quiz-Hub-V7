import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { gradeMultipleChoiceAnswers } from "./gradeAssignment.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

interface SubmitInput {
  subjectId: string;
  assignmentId: string;
  studentName: string;
  /** questionId -> optionId đã chọn (trắc nghiệm) hoặc text (tự luận) */
  answers: Record<string, string[] | string>;
}

/**
 * Nộp bài + chấm điểm — chạy bằng Admin SDK nên đọc được đáp án đúng trong
 * questionBank mà KHÔNG BAO GIỜ gửi chúng xuống client. Đây là lý do nộp bài
 * không đi qua client Firestore write trực tiếp (xem ghi chú trong
 * firestore.rules, collection `submissions`).
 *
 * Câu tự luận không tự chấm được — lưu lại để giáo viên chấm tay sau
 * (score cho câu đó = null, không tính vào maxScore).
 */
export const submitAssignment = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Cần đăng nhập (kể cả ẩn danh) để nộp bài.");

    const { subjectId, assignmentId, studentName, answers } = request.data as SubmitInput;
    if (!subjectId || !assignmentId || !studentName?.trim()) {
      throw new HttpsError("invalid-argument", "Thiếu thông tin bắt buộc.");
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

    if (assignment.status !== "published") {
      throw new HttpsError("failed-precondition", "Đề bài chưa mở hoặc đã đóng.");
    }
    const now = Date.now();
    if (now < new Date(assignment.openAt).getTime() || now > new Date(assignment.closeAt).getTime()) {
      throw new HttpsError("failed-precondition", "Ngoài thời gian làm bài cho phép.");
    }

    const questionIds: string[] = assignment.questionIds ?? [];
    const { score } = await gradeMultipleChoiceAnswers({
      db,
      subjectId,
      questionIds,
      answers,
    });

    const submissionRef = db
      .collection("subjects")
      .doc(subjectId)
      .collection("submissions")
      .doc();
    await submissionRef.set({
      subjectId,
      schoolYear: assignment.schoolYear,
      assignmentId,
      classId: assignment.classId,
      studentName: studentName.trim(),
      answers,
      score,
      maxScore: 10,
      submittedBy: uid,
      submittedAt: new Date().toISOString(),
    });

    return { ok: true, submissionId: submissionRef.id, score };
  }
);
