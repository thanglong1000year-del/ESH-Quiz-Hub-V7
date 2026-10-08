/**
 * Owner tạo môn học mới + tài khoản giáo viên admin sở hữu môn đó — qua
 * Cloud Function `createTeacherAdmin` (Admin SDK, tạo tài khoản Firebase
 * Auth thật). Xem functions/src/createTeacherAdmin.ts.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export interface CreateTeacherAdminResult {
  ok: boolean;
  subjectId: string;
  uid: string;
  email: string;
  tempPassword: string;
}

export async function createTeacherAdmin(input: {
  subjectName: string;
  email: string;
  displayName: string;
}): Promise<CreateTeacherAdminResult> {
  const call = httpsCallable<typeof input, CreateTeacherAdminResult>(
    functions,
    "createTeacherAdmin"
  );
  const result = await call(input);
  return result.data;
}
