import type { Firestore } from "firebase-admin/firestore";

/**
 * Logic chấm trắc nghiệm dùng chung giữa `submitAssignment` (nộp bài thật,
 * có ghi `submissions`) và `previewAssignment` (giáo viên xem/làm thử, KHÔNG
 * ghi gì cả — xem ghi chú trong previewAssignment.ts). Tách riêng để không
 * lặp lại logic đọc questionBank + so khớp đáp án đúng ở 2 nơi.
 *
 * Câu tự luận không tự chấm được — bỏ qua, không tính vào maxScore (giống
 * hành vi gốc trong submitAssignment.ts).
 */
export async function gradeMultipleChoiceAnswers({
  db,
  subjectId,
  questionIds,
  answers,
}: {
  db: Firestore;
  subjectId: string;
  questionIds: string[];
  answers: Record<string, string[] | string>;
}): Promise<{
  score: number | null;
  maxScore: number;
  perQuestion: Record<string, { correct: boolean; correctOptionIds: string[] } | null>;
}> {
  const questionDocs = await Promise.all(
    questionIds.map((id) =>
      db.collection("subjects").doc(subjectId).collection("questionBank").doc(id).get()
    )
  );

  let earned = 0;
  let maxScore = 0;
  const perQuestionMax = 10 / Math.max(questionIds.length, 1);
  const perQuestion: Record<string, { correct: boolean; correctOptionIds: string[] } | null> = {};

  for (const qDoc of questionDocs) {
    if (!qDoc.exists) {
      perQuestion[qDoc.id] = null;
      continue;
    }
    const q = qDoc.data()!;
    if (q.type !== "multiple_choice") {
      perQuestion[qDoc.id] = null; // tự luận: chấm tay, không có trong kết quả tự động
      continue;
    }
    maxScore += perQuestionMax;

    const given = answers[qDoc.id];
    const givenIds = Array.isArray(given) ? given : given ? [given] : [];
    const correctIds: string[] = q.correctOptionIds ?? [];

    const isCorrect =
      givenIds.length === correctIds.length && correctIds.every((id) => givenIds.includes(id));
    if (isCorrect) earned += perQuestionMax;

    perQuestion[qDoc.id] = { correct: isCorrect, correctOptionIds: correctIds };
  }

  const score = maxScore > 0 ? Math.round((earned / maxScore) * 100) / 10 : null;
  return { score, maxScore, perQuestion };
}
