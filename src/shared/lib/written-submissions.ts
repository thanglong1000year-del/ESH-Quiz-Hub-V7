/**
 * "Bài tập tự luận" — tầng Firestore cho mô hình tick nộp/chưa nộp theo
 * tuần (xem `WrittenWeek`/`WrittenSubmission` trong `@shared/types/core`).
 * Kế thừa trực tiếp từ bản sửa lại ở V6.3.8 (`written-submission-data.ts`):
 * không điểm số, không nhận xét — chỉ một ô tick mỗi học sinh × mỗi tuần.
 *
 * Khác V6.3.8 (collection phẳng cấp toàn trường, phải tự ghép khối+lớp+năm
 * học vào id): V7 lưu trực tiếp dưới `classes/{classId}` — lớp đã tự mang
 * `subjectId` + `schoolYear` nên không cần trường "grade" hay id ghép phức
 * tạp.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import {
  WRITTEN_SUBMISSION_MAX_WEEK,
  type Student,
  type WrittenSubmission,
  type WrittenWeek,
} from "@shared/types/core";

export { WRITTEN_SUBMISSION_MAX_WEEK };

function weeksRef(subjectId: string, classId: string) {
  return collection(db, "subjects", subjectId, "classes", classId, "writtenWeeks");
}

function submissionsRef(subjectId: string, classId: string) {
  return collection(db, "subjects", subjectId, "classes", classId, "writtenSubmissions");
}

function weekDocId(week: number) {
  return `w${String(week).padStart(2, "0")}`;
}

export function subscribeWrittenWeeks(
  subjectId: string,
  classId: string,
  onChange: (weeks: WrittenWeek[]) => void
): Unsubscribe {
  const q = query(weeksRef(subjectId, classId), orderBy("week", "asc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WrittenWeek));
  });
}

export function subscribeWrittenSubmissions(
  subjectId: string,
  classId: string,
  onChange: (submissions: WrittenSubmission[]) => void
): Unsubscribe {
  return onSnapshot(submissionsRef(subjectId, classId), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WrittenSubmission));
  });
}

/** Thêm/sửa một tuần có giao bài tự luận cho lớp. */
export async function addWrittenWeek(
  subjectId: string,
  classId: string,
  schoolYear: string,
  week: number,
  title?: string
) {
  if (!Number.isInteger(week) || week < 1 || week > WRITTEN_SUBMISSION_MAX_WEEK) {
    throw new Error(`Tuần phải từ 1 đến ${WRITTEN_SUBMISSION_MAX_WEEK}.`);
  }

  const ref = doc(weeksRef(subjectId, classId), weekDocId(week));
  await setDoc(
    ref,
    {
      subjectId,
      schoolYear,
      classId,
      week,
      ...(title?.trim() ? { title: title.trim() } : {}),
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function removeWrittenWeek(subjectId: string, classId: string, weekId: string) {
  await deleteDoc(doc(weeksRef(subjectId, classId), weekId));
}

/**
 * Tick/untick trực tiếp một ô trên bảng. Dùng `setDoc(..., {merge: true})`
 * với field `weeks` lồng nhau — Firestore deep-merge map lồng khi merge:
 * true, nên chỉ tuần đang tick thay đổi, các tuần khác giữ nguyên, không
 * cần đọc document hiện tại trước.
 */
export async function toggleWrittenSubmission(
  subjectId: string,
  classId: string,
  schoolYear: string,
  student: Student,
  week: number,
  submitted: boolean
) {
  const ref = doc(submissionsRef(subjectId, classId), student.id);
  await setDoc(
    ref,
    {
      subjectId,
      schoolYear,
      classId,
      studentId: student.id,
      studentName: student.fullName,
      weeks: { [String(week)]: submitted },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
