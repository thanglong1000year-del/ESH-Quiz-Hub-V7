import type { Firestore } from "firebase-admin/firestore";
import { computeStudentProgress } from "./studentProgress.js";

export interface ProgressView {
  studentName: string;
  className: string;
  subjectName: string;
  progress: ReturnType<typeof computeStudentProgress>;
  submissions: { title: string; score: number | null; maxScore: number; submittedAt: string }[];
  writtenWeeks: { week: number; title: string; submitted: boolean }[];
}

/**
 * Phần đọc dữ liệu dùng chung cho cả 2 kênh xem tiến độ của phụ huynh:
 * link công khai có `viewToken` (`getStudentProgress`) và đăng nhập bằng
 * email/mật khẩu (`getChildProgressForParent`). Mỗi callable tự chịu trách
 * nhiệm xác thực quyền truy cập ĐÚNG học sinh này trước khi gọi hàm này —
 * hàm này không kiểm tra quyền, chỉ tổng hợp số liệu.
 */
export async function loadProgressView(
  db: Firestore,
  subjectId: string,
  classId: string,
  studentId: string,
  student: Record<string, unknown>
): Promise<ProgressView> {
  const classRef = db.collection("subjects").doc(subjectId).collection("classes").doc(classId);
  const [classSnap, subjectSnap, submissionsSnap, assignmentsSnap, writtenSnap, weeksSnap] =
    await Promise.all([
      classRef.get(),
      db.collection("subjects").doc(subjectId).get(),
      db
        .collection("subjects")
        .doc(subjectId)
        .collection("submissions")
        .where("classId", "==", classId)
        .where("studentName", "==", student.fullName)
        .get(),
      db.collection("subjects").doc(subjectId).collection("assignments").where("classId", "==", classId).get(),
      classRef.collection("writtenSubmissions").doc(studentId).get(),
      classRef.collection("writtenWeeks").get(),
    ]);

  const titles = new Map(assignmentsSnap.docs.map((d) => [d.id, String(d.data().title ?? "")]));
  const submissions = submissionsSnap.docs
    .map((d) => d.data())
    .map((s) => ({
      title: titles.get(s.assignmentId) ?? "Đề đã xoá",
      score: (s.score as number | null) ?? null,
      maxScore: (s.maxScore as number) ?? 10,
      submittedAt: String(s.submittedAt),
    }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const ticked = (writtenSnap.data()?.weeks ?? {}) as Record<string, boolean>;
  const weeks: Record<string, boolean> = {};
  const writtenWeeks = weeksSnap.docs
    .map((d) => d.data() as { week: number; title?: string })
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      weeks[String(w.week)] = ticked[String(w.week)] === true;
      return { week: w.week, title: w.title ?? "", submitted: weeks[String(w.week)] };
    });

  return {
    studentName: String(student.fullName),
    className: String(classSnap.data()?.name ?? ""),
    subjectName: String(subjectSnap.data()?.name ?? ""),
    progress: computeStudentProgress(
      submissions.map((s) => s.score),
      weeks
    ),
    submissions,
    writtenWeeks,
  };
}
