import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import type { Assignment, Question } from "@shared/types/core";

function assignmentsRef(subjectId: string) {
  return collection(db, "subjects", subjectId, "assignments");
}

/** Câu hỏi "an toàn" gửi cho học sinh — KHÔNG được chứa đáp án đúng. */
export type SafeQuestion =
  | { id: string; type: "multiple_choice"; prompt: string; options: { id: string; text: string }[] }
  | { id: string; type: "essay"; prompt: string };

function toSafeQuestion(q: Question): SafeQuestion {
  if (q.type === "multiple_choice") {
    return { id: q.id, type: "multiple_choice", prompt: q.prompt, options: q.options };
  }
  return { id: q.id, type: "essay", prompt: q.prompt };
}

export function subscribeAssignments(
  subjectId: string,
  classId: string,
  onChange: (assignments: Assignment[]) => void
): Unsubscribe {
  const q = query(
    assignmentsRef(subjectId),
    where("classId", "==", classId),
    orderBy("openAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment));
  });
}

interface CreateAssignmentInput {
  classId: string;
  schoolYear: string;
  title: string;
  questionIds: string[];
  durationMinutes: number;
  openAt: string; // ISO
  closeAt: string; // ISO
}

/**
 * Tạo đề từ ngân hàng câu hỏi — lưu kèm `questionsSnapshot` (bản sao câu hỏi
 * ĐÃ LƯỢC BỎ đáp án đúng) để học sinh đọc được đề mà không cần quyền đọc
 * questionBank gốc. Trạng thái mặc định "draft"; gọi `publishAssignment` để
 * mở cho học sinh làm bài.
 */
export async function createAssignment(subjectId: string, input: CreateAssignmentInput) {
  const questionDocs = await Promise.all(
    input.questionIds.map((id) => getDoc(doc(db, "subjects", subjectId, "questionBank", id)))
  );
  const questionsSnapshot = questionDocs
    .filter((d) => d.exists())
    .map((d) => toSafeQuestion({ id: d.id, ...d.data() } as Question));

  await addDoc(assignmentsRef(subjectId), {
    subjectId,
    classId: input.classId,
    schoolYear: input.schoolYear,
    title: input.title,
    questionIds: input.questionIds,
    questionsSnapshot,
    durationMinutes: input.durationMinutes,
    openAt: input.openAt,
    closeAt: input.closeAt,
    status: "draft",
    createdAt: new Date().toISOString(),
  });
}

export async function publishAssignment(subjectId: string, assignmentId: string) {
  await updateDoc(doc(db, "subjects", subjectId, "assignments", assignmentId), {
    status: "published",
  });
}

export async function closeAssignment(subjectId: string, assignmentId: string) {
  await updateDoc(doc(db, "subjects", subjectId, "assignments", assignmentId), {
    status: "closed",
  });
}

/** Đọc công khai 1 đề (dùng ở trang học sinh làm bài) — chỉ khi đã published, rules sẽ chặn nếu chưa. */
export async function getPublicAssignment(subjectId: string, assignmentId: string) {
  const snap = await getDoc(doc(db, "subjects", subjectId, "assignments", assignmentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Assignment & {
    questionsSnapshot: SafeQuestion[];
    status: string;
  };
}

export async function listSubmissionsForAssignment(subjectId: string, assignmentId: string) {
  const q = query(
    collection(db, "subjects", subjectId, "submissions"),
    where("assignmentId", "==", assignmentId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
