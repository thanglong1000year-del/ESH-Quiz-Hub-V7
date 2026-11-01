export interface StudentProgress {
  avgScore: number | null;
  submissionCount: number;
  submittedWeeks: number;
  totalWeeks: number;
}

export function computeStudentProgress(
  scores: (number | null)[],
  weeks: Record<string, boolean>
): StudentProgress {
  const graded = scores.filter((s): s is number => s != null);
  return {
    avgScore: graded.length > 0 ? graded.reduce((sum, s) => sum + s, 0) / graded.length : null,
    submissionCount: graded.length,
    submittedWeeks: Object.values(weeks).filter(Boolean).length,
    totalWeeks: Object.keys(weeks).length,
  };
}
