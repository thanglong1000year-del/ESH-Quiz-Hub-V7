import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import { randomBytes } from "node:crypto";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

interface CreateTeacherAdminInput {
  subjectName: string;
  email: string;
  displayName: string;
}

function generateTempPassword() {
  // 12 ký tự base64url — đủ mạnh cho mật khẩu tạm, giáo viên đổi lại sau khi
  // đăng nhập lần đầu (chưa có UI đổi mật khẩu — ghi chú trong README).
  return randomBytes(9).toString("base64url");
}

/**
 * Owner tạo trực tiếp 1 môn học mới + tài khoản giáo viên admin sở hữu môn đó
 * — thay cho quy trình thủ công cũ (tạo tay trên Firebase Console/Auth rồi
 * dán UID vào form tạo môn). Chạy bằng Admin SDK nên tạo được tài khoản
 * Firebase Auth thật (email/password); mật khẩu tạm được TRẢ VỀ MỘT LẦN cho
 * Owner tự gửi cho giáo viên (app chưa có hệ thống gửi email).
 *
 * Giáo viên admin (được tạo ở đây) khác với giáo viên viewer (được admin
 * mời, đăng nhập bằng Gmail cá nhân qua `claimTeacherInvite`) — xem
 * docs/DATA_MODEL.md mục "Mời giáo viên xem lớp".
 */
export const createTeacherAdmin = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");

    const callerSnap = await db.collection("users").doc(uid).get();
    if (callerSnap.data()?.role !== "owner") {
      throw new HttpsError("permission-denied", "Chỉ Owner được tạo tài khoản giáo viên.");
    }

    const { subjectName, email, displayName } = request.data as CreateTeacherAdminInput;
    const name = subjectName?.trim();
    const teacherEmail = email?.trim().toLowerCase();
    const teacherDisplayName = displayName?.trim();

    if (!name || !teacherEmail || !teacherDisplayName) {
      throw new HttpsError("invalid-argument", "Thiếu tên môn, email hoặc tên giáo viên.");
    }

    const tempPassword = generateTempPassword();

    let authUser;
    try {
      authUser = await auth.createUser({
        email: teacherEmail,
        password: tempPassword,
        displayName: teacherDisplayName,
      });
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          `Email ${teacherEmail} đã có tài khoản đăng nhập trong hệ thống.`
        );
      }
      throw new HttpsError("internal", "Không tạo được tài khoản đăng nhập.");
    }

    const subjectRef = db.collection("subjects").doc();
    const nowIso = new Date().toISOString();

    await subjectRef.set({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      ownerTeacherId: authUser.uid,
      status: "active",
      createdAt: nowIso,
    });

    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      email: teacherEmail,
      displayName: teacherDisplayName,
      role: "teacher",
      teacherRole: "admin",
      subjectId: subjectRef.id,
      createdAt: nowIso,
    });

    return {
      ok: true,
      subjectId: subjectRef.id,
      uid: authUser.uid,
      email: teacherEmail,
      tempPassword,
    };
  }
);
