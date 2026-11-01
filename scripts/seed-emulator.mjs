// Seed dữ liệu giả cho Firebase Emulator — chạy sau khi `firebase emulators:start`.
// Dùng: node scripts/seed-emulator.mjs
//
// Tạo 1 Owner, 1 Teacher (admin) + 1 Subject mẫu để kiểm thử nhanh luồng
// đăng nhập + cô lập dữ liệu theo subjectId mà không đụng tới Firestore thật.
//
// Dùng firebase-admin (Admin SDK) nối trực tiếp emulator — KHÔNG dùng SDK
// client như bản trước: client bị chính firestore.rules chặn khi ghi
// /users/{uid} (allow write: if isOwner()) vì tại thời điểm ghi hồ sơ Owner
// đầu tiên, chưa có Owner nào tồn tại để pass điều kiện đó — đúng bài toán
// "con gà quả trứng" khi bootstrap. Production cũng phải tạo Owner đầu tiên
// qua Admin SDK/Firebase Console, không qua client, vì lý do tương tự.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

initializeApp({ projectId: "demo-esh-v7" });
const auth = getAuth();
const db = getFirestore();

async function main() {
  const owner = await auth.createUser({
    email: "owner@esh.test",
    password: "password123",
    displayName: "Owner (seed)",
  });
  const teacher = await auth.createUser({
    email: "teacher-sinh@esh.test",
    password: "password123",
    displayName: "GV Sinh học (seed)",
  });

  const nowIso = new Date().toISOString();

  await db.collection("platformConfig").doc("default").set({
    archiveRetentionMonths: 6,
    defaultGradingScale: { max: 10 },
    defaultAssignmentDurationMinutes: 45,
    currentSchoolYear: "2027-2028",
  });

  await db.collection("users").doc(owner.uid).set({
    uid: owner.uid,
    email: "owner@esh.test",
    displayName: "Owner (seed)",
    role: "owner",
    createdAt: nowIso,
  });

  const subjectId = "sinh-hoc-10-seed";

  await db.collection("users").doc(teacher.uid).set({
    uid: teacher.uid,
    email: "teacher-sinh@esh.test",
    displayName: "GV Sinh học (seed)",
    role: "teacher",
    // Bắt buộc từ khi có mô hình admin/viewer (commit a6ce843) — thiếu field
    // này thì firestore.rules isSubjectAdmin() luôn false, giáo viên seed
    // không làm được gì (phát hiện khi thử nghiệm luồng thật trên emulator).
    teacherRole: "admin",
    subjectId,
    createdAt: nowIso,
  });

  await db.collection("subjects").doc(subjectId).set({
    name: "Sinh học 10 (seed)",
    slug: subjectId,
    ownerTeacherId: teacher.uid,
    status: "active",
    createdAt: nowIso,
  });

  console.log("Seed xong.");
  console.log("  Owner:   owner@esh.test / password123");
  console.log("  Teacher: teacher-sinh@esh.test / password123 (admin, môn 'Sinh học 10 (seed)')");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
