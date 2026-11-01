import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import type { ClassRoom, Student } from "@shared/types/core";
import type { ParsedBulkStudent, ParsedParentContact } from "./bulk-import";
import { normalizeNameForMatch } from "./bulk-import";

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

/**
 * Thêm nhiều học sinh cùng lúc — mỗi dòng 1 học sinh, đã qua
 * `parseStudentRosterBulkText` (chỉ cần tên, hoặc "Tên, Email học sinh,
 * Email phụ huynh" dán từ Excel/Sheets).
 */
export async function addStudentsBulk(
  subjectId: string,
  classId: string,
  schoolYear: string,
  students: ParsedBulkStudent[]
) {
  const ref = studentsRef(subjectId, classId);
  for (let i = 0; i < students.length; i += 450) {
    const chunk = students.slice(i, i + 450);
    const batch = writeBatch(db);
    for (const s of chunk) {
      const docRef = doc(ref);
      batch.set(docRef, {
        subjectId,
        schoolYear,
        classId,
        fullName: s.fullName,
        studentCode: "",
        studentEmail: s.studentEmail ?? "",
        parentEmails: s.parentEmails,
        viewToken: generateViewToken(),
      });
    }
    await batch.commit();
  }
}

/**
 * Cập nhật email phụ huynh hàng loạt bằng cách khớp TÊN với học sinh đã có
 * sẵn trong lớp (không phân biệt hoa/thường, bỏ khoảng trắng thừa) — dùng
 * khi nhận được danh sách liên hệ phụ huynh sau khi đã nhập danh sách lớp.
 * THÊM VÀO (gộp, bỏ trùng) danh sách email đã có của học sinh đó, KHÔNG
 * xoá email cũ — vì 1 học sinh có thể có nhiều email phụ huynh (bố, mẹ…)
 * được thêm ở những lần khác nhau. Trả về số dòng khớp được và danh sách
 * tên không tìm thấy.
 */
export async function bulkUpdateParentEmails(
  subjectId: string,
  classId: string,
  entries: ParsedParentContact[]
): Promise<{ matched: number; unmatched: string[] }> {
  const snap = await getDocs(studentsRef(subjectId, classId));
  const byName = new Map<string, { id: string; parentEmails: string[] }>();
  snap.docs.forEach((d) => {
    const fullName = (d.data().fullName as string) ?? "";
    const parentEmails = (d.data().parentEmails as string[] | undefined) ?? [];
    byName.set(normalizeNameForMatch(fullName), { id: d.id, parentEmails });
  });

  const unmatched: string[] = [];
  const toUpdate: { id: string; parentEmails: string[] }[] = [];
  for (const entry of entries) {
    const found = byName.get(normalizeNameForMatch(entry.studentName));
    if (!found) {
      unmatched.push(entry.studentName);
      continue;
    }
    const merged = Array.from(new Set([...found.parentEmails, ...entry.parentEmails]));
    toUpdate.push({ id: found.id, parentEmails: merged });
  }

  for (let i = 0; i < toUpdate.length; i += 450) {
    const chunk = toUpdate.slice(i, i + 450);
    const batch = writeBatch(db);
    for (const u of chunk) {
      batch.update(doc(db, "subjects", subjectId, "classes", classId, "students", u.id), {
        parentEmails: u.parentEmails,
      });
    }
    await batch.commit();
  }

  return { matched: toUpdate.length, unmatched };
}

export async function removeStudent(subjectId: string, classId: string, studentId: string) {
  await deleteDoc(doc(db, "subjects", subjectId, "classes", classId, "students", studentId));
}

/** Cập nhật email học sinh/phụ huynh — cần ít nhất 1 email để nhận báo cáo (xem ReportCampaign). */
export async function updateStudentContact(
  subjectId: string,
  classId: string,
  studentId: string,
  input: { studentEmail?: string; parentEmails: string[] }
) {
  await updateDoc(doc(db, "subjects", subjectId, "classes", classId, "students", studentId), {
    studentEmail: input.studentEmail?.trim().toLowerCase() ?? "",
    // Chuẩn hoá chữ thường — phụ huynh đăng nhập bằng email/mật khẩu được
    // khớp bằng so sánh chính xác (xem bulk-import.ts, syncParentProfile).
    // Đây là lần GHI ĐÈ toàn bộ danh sách (khác bulkUpdateParentEmails chỉ
    // gộp thêm) — dùng khi giáo viên sửa tay đúng 1 học sinh.
    parentEmails: input.parentEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  });
}
