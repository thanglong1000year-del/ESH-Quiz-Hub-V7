/**
 * Giáo viên (admin hoặc viewer đúng lớp) "làm thử" 1 đề trắc nghiệm — chấm
 * điểm thật qua Cloud Function `previewAssignment` nhưng KHÔNG ghi vào
 * `submissions`, không ảnh hưởng tiến độ/kết quả thật của học sinh. Xem
 * functions/src/previewAssignment.ts.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export interface PreviewAssignmentResult {
  ok: true;
  preview: true;
  score: number | null;
  maxScore: number;
  perQuestion: Record<string, { correct: boolean; correctOptionIds: string[] } | null>;
}

export async function previewAssignmentAnswers(input: {
  subjectId: string;
  assignmentId: string;
  answers: Record<string, string[] | string>;
}) {
  const fn = httpsCallable<typeof input, PreviewAssignmentResult>(functions, "previewAssignment");
  const res = await fn(input);
  return res.data;
}
