// Seed dữ liệu giả cho Firebase Emulator — chạy sau khi `firebase emulators:start`.
// Dùng: node scripts/seed-emulator.mjs
//
// Tạo 1 Owner, 1 Teacher, 1 Subject mẫu để kiểm thử nhanh luồng đăng nhập +
// cô lập dữ liệu theo subjectId mà không đụng tới Firestore thật.

import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
} from "firebase/firestore";

const app = initializeApp({ projectId: "esh-quiz-hub-v7-dev" });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "127.0.0.1", 8080);

async function main() {
  const ownerCred = await createUserWithEmailAndPassword(
    auth,
    "owner@esh.test",
    "password123"
  );
  const teacherCred = await createUserWithEmailAndPassword(
    auth,
    "teacher-sinh@esh.test",
    "password123"
  );

  await setDoc(doc(db, "platformConfig", "default"), {
    archiveRetentionMonths: 6,
    defaultGradingScale: { max: 10 },
    defaultAssignmentDurationMinutes: 45,
    currentSchoolYear: "2027-2028",
  });

  await setDoc(doc(db, "users", ownerCred.user.uid), {
    uid: ownerCred.user.uid,
    email: "owner@esh.test",
    displayName: "Owner (seed)",
    role: "owner",
    createdAt: new Date().toISOString(),
  });

  const subjectId = "sinh-hoc-10-seed";
  await setDoc(doc(db, "users", teacherCred.user.uid), {
    uid: teacherCred.user.uid,
    email: "teacher-sinh@esh.test",
    displayName: "GV Sinh học (seed)",
    role: "teacher",
    subjectId,
    createdAt: new Date().toISOString(),
  });

  await setDoc(doc(db, "subjects", subjectId), {
    name: "Sinh học 10 (seed)",
    slug: "sinh-hoc-10-seed",
    ownerTeacherId: teacherCred.user.uid,
    status: "active",
    createdAt: new Date().toISOString(),
  });

  console.log("Seed xong.");
  console.log("  Owner:   owner@esh.test / password123");
  console.log("  Teacher: teacher-sinh@esh.test / password123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
