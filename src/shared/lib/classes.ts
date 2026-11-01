import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import type { ClassRoom, Student } from "@shared/types/core";

function classesRef(subjectId: string) {
  return collection(db, "subjects", subjectId, "classes");
}

function studentsRef(subjectId: string, classId: string) {
  return collection(db, "subjects", subjectId, "classes", classId, "students");
}

export function subscribeClasses(
  subjectId: string,
  schoolYear: string,
  onChange: (classes: ClassRoom[]) => void
): Unsubscribe {
  const q = query(
    classesRef(subjectId),
    where("schoolYear", "==", schoolYear),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom));
  });
}

export async function createClass(subjectId: string, schoolYear: string, name: string) {
  await addDoc(classesRef(subjectId), {
    subjectId,
    schoolYear,
    name,
    createdAt: new Date().toISOString(),
  });
}

export async function renameClass(subjectId: string, classId: string, name: string) {
  await updateDoc(doc(db, "subjects", subjectId, "classes", classId), { name });
}

export function subscribeStudents(
  subjectId: string,
  classId: string,
  onChange: (students: Student[]) => void
): Unsubscribe {
  const q = query(studentsRef(subjectId, classId), orderBy("fullName", "asc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student));
  });
}

export async function addStudent(
  subjectId: string,
  classId: string,
  schoolYear: string,
  input: { fullName: string; studentCode?: string }
) {
  await addDoc(studentsRef(subjectId, classId), {
    subjectId,
    schoolYear,
    classId,
    fullName: input.fullName,
    studentCode: input.studentCode ?? "",
    viewToken: generateViewToken(),
  });
}

export function generateViewToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tạo mã mới (cũng dùng cho học sinh cũ chưa có mã) — link cũ lập tức hết hiệu lực. */
export async function regenerateViewToken(subjectId: string, classId: string, studentId: string) {
  const viewToken = generateViewToken();
  await updateDoc(doc(db, "subjects", subjectId, "classes", classId, "students", studentId), {
    viewToken,
  });
  return viewToken;
}

export function progressLink(subjectId: string, classId: string, studentId: string, viewToken: string) {
  return `${window.location.origin}/progress/${subjectId}/${classId}/${studentId}/${viewToken}`;
}

/** Thêm nhiều học sinh cùng lúc — mỗi dòng 1 tên (dán danh sách từ Excel/Sheets). */
export async function addStudentsBulk(
  subjectId: string,
  classId: string,
  schoolYear: string,
  names: string[]
) {
  await Promise.all(
    names
      .map((n) => n.trim())
      .filter(Boolean)
      .map((fullName) => addStudent(subjectId, classId, schoolYear, { fullName }))
  );
}

export async function removeStudent(subjectId: string, classId: string, studentId: string) {
  await deleteDoc(doc(db, "subjects", subjectId, "classes", classId, "students", studentId));
}

/** Cập nhật email học sinh/phụ huynh — cần ít nhất 1 trong 2 để nhận báo cáo (xem ReportCampaign). */
export async function updateStudentContact(
  subjectId: string,
  classId: string,
  studentId: string,
  input: { studentEmail?: string; parentEmail?: string }
) {
  await updateDoc(doc(db, "subjects", subjectId, "classes", classId, "students", studentId), {
    studentEmail: input.studentEmail?.trim() ?? "",
    parentEmail: input.parentEmail?.trim() ?? "",
  });
}
