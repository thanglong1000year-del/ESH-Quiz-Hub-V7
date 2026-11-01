import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { loadProgressView } from "./progressView.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

interface Input {
  subjectId: string;
  classId: string;
  studentId: string;
}

/**
 * Xem tiến độ 1 con — dành cho phụ huynh đã đăng nhập bằng email/mật khẩu
 * (xem `syncParentProfile.ts`). Danh sách con hiển thị ở client lấy từ
 * `/users/{uid}.children` (ghi lúc đăng nhập) chỉ để vẽ UI — quyền xem THẬT
 * luôn được kiểm tra lại ở đây bằng dữ liệu Firestore mới nhất, nên dù
 * danh sách đó có lỡ cũ (ví dụ giáo viên vừa xoá email phụ huynh) thì vẫn
 * không đọc được dữ liệu học sinh đó nữa.
 */
export const getChildProgressForParent = onCall({ region: "asia-southeast1" }, async (request) => {
  const tokenEmail = request.auth?.token?.email as string | undefined;
  const emailVerified = request.auth?.token?.email_verified as boolean | undefined;
  if (!tokenEmail) {
    throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  }
  if (!emailVerified) {
    throw new HttpsError("permission-denied", "Email chưa được xác minh.");
  }

  const { subjectId, classId, studentId } = (request.data ?? {}) as Input;
  if (!subjectId || !classId || !studentId) {
    throw new HttpsError("invalid-argument", "Thiếu thông tin học sinh.");
  }

  const studentSnap = await db
    .collection("subjects")
    .doc(subjectId)
    .collection("classes")
    .doc(classId)
    .collection("students")
    .doc(studentId)
    .get();
  const student = studentSnap.data();

  const parentEmails = ((student?.parentEmails as string[] | undefined) ?? []).map(normalizeEmail);
  const authEmail = normalizeEmail(tokenEmail);
  if (!student || !parentEmails.includes(authEmail)) {
    throw new HttpsError("permission-denied", "Không có quyền xem học sinh này.");
  }

  return loadProgressView(db, subjectId, classId, studentId, student);
});
