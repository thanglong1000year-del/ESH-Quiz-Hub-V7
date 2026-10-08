/**
 * Mời giáo viên xem-lớp (viewer) — xem docs/DATA_MODEL.md mục "Mời giáo
 * viên xem lớp". Admin của môn tạo/xoá lời mời trực tiếp từ client (Firestore
 * rules kiểm tra `isSubjectAdmin`); việc "nhận lời mời" (tạo hồ sơ
 * `/users/{uid}`) đi qua Cloud Function `claimTeacherInvite` — xem
 * auth-context.tsx.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/client";
import type { TeacherInvite } from "@shared/types/core";

function invitesRef() {
  return collection(db, "teacherInvites");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** Danh sách lời mời của 1 lớp — dùng trên ClassDetailPage. */
export function subscribeClassInvites(
  subjectId: string,
  classId: string,
  onChange: (invites: TeacherInvite[]) => void
): Unsubscribe {
  const q = query(
    invitesRef(),
    where("subjectId", "==", subjectId),
    where("classId", "==", classId)
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TeacherInvite));
  });
}

export async function inviteViewerTeacher(
  subjectId: string,
  classId: string,
  email: string,
  invitedBy: string
) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    throw new Error("Email không hợp lệ.");
  }

  const ref = doc(invitesRef(), normalized);
  await setDoc(ref, {
    email: normalized,
    subjectId,
    classId,
    invitedBy,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export async function revokeInvite(email: string) {
  await deleteDoc(doc(invitesRef(), normalizeEmail(email)));
}

/**
 * Gọi ngay sau khi đăng nhập Google mà chưa có hồ sơ `/users/{uid}` — xem
 * auth-context.tsx. Dùng email đã xác thực từ token phía server, không phải
 * email client tự khai.
 */
export async function claimTeacherInvite(): Promise<{ ok: boolean; subjectId: string }> {
  const call = httpsCallable<void, { ok: boolean; subjectId: string }>(
    functions,
    "claimTeacherInvite"
  );
  const result = await call();
  return result.data;
}
