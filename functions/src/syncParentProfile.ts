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
 * Kênh thứ 2 (bên cạnh link `viewToken`) để phụ huynh xem tiến độ con: tự
 * đăng ký tài khoản email/mật khẩu trên chính V7, không cần giữ link —
 * tránh rủi ro link giả mạo lừa đảo. Client gọi hàm này ngay sau khi
 * đăng ký/đăng nhập (xem `parent-auth.ts`).
 *
 * Dùng email đã XÁC THỰC từ token đăng nhập (`request.auth.token.email`),
 * KHÔNG dùng email client tự khai — nếu không, ai cũng tạo được tài khoản
 * bằng email người khác (họ không biết mật khẩu) để dò xem dữ liệu con
 * người khác. Bắt buộc `email_verified` để chỉ người thực sự kiểm soát hộp
 * mail đó mới xem được, GIỐNG `claimTeacherInvite` với Google Sign-In.
 *
 * Quét collectionGroup("students") theo `parentEmails` (array-contains) —
 * 1 học sinh có thể có NHIỀU email phụ huynh (bố, mẹ…) nên trường này là
 * mảng; array-contains trên collectionGroup cũng được đánh index đơn tự
 * động, không cần thêm cấu hình index. Ghi đè `/users/{uid}` mỗi lần gọi
 * (idempotent) để danh sách con luôn khớp dữ liệu học sinh hiện tại (ví
 * dụ: giáo viên vừa thêm thêm 1 con nữa có cùng email phụ huynh).
 */
export const syncParentProfile = onCall({ region: "asia-southeast1" }, async (request) => {
  const uid = request.auth?.uid;
  const tokenEmail = request.auth?.token?.email as string | undefined;
  const emailVerified = request.auth?.token?.email_verified as boolean | undefined;

  if (!uid || !tokenEmail) {
    throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  }
  if (!emailVerified) {
    throw new HttpsError(
      "permission-denied",
      "Email chưa được xác minh. Mở email vừa gửi và bấm vào link xác minh, sau đó đăng nhập lại."
    );
  }

  const email = normalizeEmail(tokenEmail);
  const studentsSnap = await db
    .collectionGroup("students")
    .where("parentEmails", "array-contains", email)
    .get();

  const subjectCache = new Map<string, string>();
  const classCache = new Map<string, string>();
  async function subjectName(subjectId: string) {
    if (!subjectCache.has(subjectId)) {
      const snap = await db.collection("subjects").doc(subjectId).get();
      subjectCache.set(subjectId, String(snap.data()?.name ?? ""));
    }
    return subjectCache.get(subjectId)!;
  }
  async function className(subjectId: string, classId: string) {
    const key = `${subjectId}/${classId}`;
    if (!classCache.has(key)) {
      const snap = await db
        .collection("subjects")
        .doc(subjectId)
        .collection("classes")
        .doc(classId)
        .get();
      classCache.set(key, String(snap.data()?.name ?? ""));
    }
    return classCache.get(key)!;
  }

  const children = await Promise.all(
    studentsSnap.docs.map(async (d) => {
      const data = d.data();
      const subjectId = String(data.subjectId ?? "");
      const classId = String(data.classId ?? "");
      return {
        subjectId,
        classId,
        studentId: d.id,
        studentName: String(data.fullName ?? ""),
        className: await className(subjectId, classId),
        subjectName: await subjectName(subjectId),
      };
    })
  );

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  const nowIso = new Date().toISOString();

  await userRef.set(
    {
      uid,
      email,
      displayName: email,
      role: "parent",
      children,
      createdAt: existing.exists ? existing.data()?.createdAt ?? nowIso : nowIso,
    },
    { merge: false }
  );

  return { children };
});
