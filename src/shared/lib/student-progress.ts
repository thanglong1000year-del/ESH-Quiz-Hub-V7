import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export interface StudentProgressView {
  studentName: string;
  className: string;
  subjectName: string;
  progress: {
    avgScore: number | null;
    submissionCount: number;
    submittedWeeks: number;
    totalWeeks: number;
  };
  submissions: { title: string; score: number | null; maxScore: number; submittedAt: string }[];
  writtenWeeks: { week: number; title: string; submitted: boolean }[];
}

export async function fetchStudentProgress(input: {
  subjectId: string;
  classId: string;
  studentId: string;
  token: string;
}) {
  const call = httpsCallable<typeof input, StudentProgressView>(functions, "getStudentProgress");
  return (await call(input)).data;
}
