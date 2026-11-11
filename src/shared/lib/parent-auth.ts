/**
 * Kênh thứ 2 cho phụ huynh xem tiến độ con — tự đăng ký tài khoản email/
 * mật khẩu trên V7, thay vì chỉ dựa vào link `viewToken` (xem classes.ts).
 * Vì sao cần thêm: kẻ gian gửi link giả mạo lừa đảo đang phổ biến — tài
 * khoản đăng nhập giúp phụ huynh không phải tin vào 1 đường link nhận qua
 * Zalo/SMS, chỉ cần nhớ email/mật khẩu của chính mình.
 *
 * Luồng: đăng ký → Firebase gửi email xác minh → phụ huynh bấm xác minh →
 * đăng nhập lại → gọi `syncParentProfile` (Cloud Function, Admin SDK) để
 * khớp email đã xác thực với `parentEmail` trên các học sinh hiện có và
 * tạo hồ sơ `/users/{uid}` (role "parent"). Bắt buộc xác minh email để
 * không ai tạo được tài khoản bằng email người khác rồi dò xem dữ liệu.
 */
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/firebase/client";
import type { ParentChildRef } from "@shared/types/core";

export class EmailNotVerifiedError extends Error {}

async function syncParentProfile(): Promise<{ children: ParentChildRef[] }> {
  const call = httpsCallable<void, { children: ParentChildRef[] }>(functions, "syncParentProfile");
  try {
    const result = await call();
    return result.data;
  } catch (caught) {
    const code = (caught as { code?: string })?.code;
    if (code === "functions/permission-denied") {
      throw new EmailNotVerifiedError();
    }
    throw caught;
  }
}

/** Trả về `needsVerification: true` nếu tài khoản vừa tạo chưa thể đọc dữ liệu ngay (bình thường). */
export async function signUpParent(
  email: string,
  password: string
): Promise<{ needsVerification: boolean; children: ParentChildRef[] }> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await sendEmailVerification(cred.user);
  try {
    const { children } = await syncParentProfile();
    return { needsVerification: false, children };
  } catch (caught) {
    if (caught instanceof EmailNotVerifiedError) {
      return { needsVerification: true, children: [] };
    }
    throw caught;
  }
}

export async function signInParent(
  email: string,
  password: string
): Promise<{ children: ParentChildRef[] }> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
  return syncParentProfile();
}

/**
 * Kênh thứ 3: đăng nhập Google — 1 lần bấm vừa tạo vừa đăng nhập tài khoản
 * (Firebase tự tạo user mới nếu Gmail này chưa có), không cần mật khẩu
 * riêng và không cần bước xác minh email (Google đã xác thực sẵn, token
 * luôn có `email_verified: true` nên `syncParentProfile` chấp nhận ngay).
 * Dùng chung `auth` chính như đăng nhập giáo viên (`LoginPage.tsx`) — an
 * toàn vì `/parent/login` là route riêng, không có luồng nào khác đang
 * lắng nghe `onAuthStateChanged` để điều hướng giữa chừng.
 */
export async function signInParentWithGoogle(): Promise<{ children: ParentChildRef[] }> {
  await signInWithPopup(auth, new GoogleAuthProvider());
  return syncParentProfile();
}

/** Gọi lại sau khi phụ huynh xác minh email xong, hoặc để làm mới danh sách con. */
export { syncParentProfile as refreshParentChildren };

export async function resendParentVerificationEmail() {
  if (!auth.currentUser) throw new Error("Chưa đăng nhập.");
  await sendEmailVerification(auth.currentUser);
}

export interface ChildProgress {
  studentName: string;
  className: string;
  subjectName: string;
  progress: {
    avgScore: number | null;
    submissionCount: number;
    submittedWeeks: number;
    totalWeeks: number;
  };
  submissions: { title: string; score: number | null; maxScore: number; submittedAt: string }[];
  writtenWeeks: { week: number; title: string; submitted: boolean }[];
}

export async function fetchChildProgress(child: {
  subjectId: string;
  classId: string;
  studentId: string;
}): Promise<ChildProgress> {
  const call = httpsCallable<typeof child, ChildProgress>(functions, "getChildProgressForParent");
  return (await call(child)).data;
}
