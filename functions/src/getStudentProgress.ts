import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { timingSafeEqual } from "node:crypto";
import { loadProgressView } from "./progressView.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

interface Input {
  subjectId: string;
  classId: string;
  studentId: string;
  token: string;
}

function tokensMatch(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Trang "Theo dõi tiến độ" công khai cho phụ huynh — không cần đăng nhập,
 * bảo vệ bằng `viewToken` ngẫu nhiên riêng của từng học sinh. Đây là kênh
 * mặc định (miễn phí) để phụ huynh nắm tiến độ: giáo viên chỉ cần gửi link
 * 1 lần qua Zalo/SMS/email cá nhân, phụ huynh mở lúc nào cũng thấy số liệu
 * mới nhất. Chỉ đọc Firestore khi có người thực sự mở link, không quét định
 * kỳ toàn bộ học sinh như campaign email — chi phí gần như bằng 0.
 *
 * Chạy bằng Admin SDK nên Firestore Rules không cần mở quyền đọc công khai;
 * chỉ trả về số liệu tổng hợp của ĐÚNG học sinh đó, không có đáp án/câu hỏi.
 */
export const getStudentProgress = onCall({ region: "asia-southeast1" }, async (request) => {
  const { subjectId, classId, studentId, token } = (request.data ?? {}) as Input;
  if (!subjectId || !classId || !studentId || !token) {
    throw new HttpsError("invalid-argument", "Link không hợp lệ.");
  }

  const classRef = db.collection("subjects").doc(subjectId).collection("classes").doc(classId);
  const studentSnap = await classRef.collection("students").doc(studentId).get();

  const student = studentSnap.data();
  if (!student?.viewToken || !tokensMatch(String(student.viewToken), token)) {
    throw new HttpsError("not-found", "Link không hợp lệ hoặc đã bị giáo viên thu hồi.");
  }

  return loadProgressView(db, subjectId, classId, studentId, student);
});
