import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Giáo viên được mời (viewer) gọi hàm này ngay sau khi đăng nhập Google lần
 * đầu, nếu client phát hiện chưa có hồ sơ `/users/{uid}` (xem auth-context.tsx).
 *
 * Dùng email đã XÁC THỰC từ token đăng nhập (`request.auth.token.email`),
 * KHÔNG dùng email client tự gửi lên — tránh giả mạo nhận lời mời của người
 * khác. Google Sign-In luôn trả `email_verified: true` nên không cần kiểm
 * tra thêm.
 *
 * Tìm `teacherInvites/{email}` còn "pending" khớp đúng email này; nếu có,
 * tạo `/users/{uid}` tương ứng (role: teacher, teacherRole: viewer) và đánh
 * dấu lời mời đã nhận. Nếu không tìm thấy (chưa được mời, hoặc email không
 * khớp lời mời nào), trả lỗi rõ ràng để UI hiển thị cho người dùng.
 */
export const claimTeacherInvite = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    const tokenEmail = request.auth?.token?.email as string | undefined;
    const emailVerified = request.auth?.token?.email_verified as boolean | undefined;

    if (!uid || !tokenEmail) {
      throw new HttpsError("unauthenticated", "Cần đăng nhập bằng Google.");
    }
    if (!emailVerified) {
      throw new HttpsError("permission-denied", "Email Google chưa được xác thực.");
    }

    const email = normalizeEmail(tokenEmail);
    const inviteRef = db.collection("teacherInvites").doc(email);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      throw new HttpsError(
        "not-found",
        `Email ${tokenEmail} chưa được giáo viên quản trị môn mời. Liên hệ giáo viên quản trị môn của bạn.`
      );
    }

    const invite = inviteSnap.data()!;
    if (invite.status === "accepted") {
      // Đã nhận trước đó (ví dụ: đăng nhập lại trên máy khác) — nếu đúng uid
      // này thì coi như thành công (idempotent), khác uid thì từ chối.
      if (invite.acceptedUid === uid) {
        return { ok: true, alreadyAccepted: true, subjectId: invite.subjectId };
      }
      throw new HttpsError(
        "already-exists",
        "Lời mời này đã được một tài khoản khác nhận trước đó."
      );
    }

    const nowIso = new Date().toISOString();
    const displayName =
      (request.auth?.token?.name as string | undefined)?.trim() || tokenEmail;

    await db.collection("users").doc(uid).set({
      uid,
      email,
      displayName,
      role: "teacher",
      teacherRole: "viewer",
      subjectId: invite.subjectId,
      viewerClassId: invite.classId,
      createdAt: nowIso,
    });

    await inviteRef.update({
      status: "accepted",
      acceptedUid: uid,
      acceptedDisplayName: displayName,
      acceptedAt: nowIso,
    });

    return { ok: true, alreadyAccepted: false, subjectId: invite.subjectId };
  }
);
