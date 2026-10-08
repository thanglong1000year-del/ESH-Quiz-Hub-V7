import { httpsCallable } from "firebase/functions";
import { signInAnonymously } from "firebase/auth";
import { auth, functions } from "@/firebase/client";

/** Đảm bảo học sinh có 1 phiên ẩn danh để gọi Cloud Function nộp bài. */
export async function ensureAnonymousSession() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}

interface SubmitResult {
  ok: true;
  submissionId: string;
  score: number | null;
}

export async function submitAssignmentAnswers(input: {
  subjectId: string;
  assignmentId: string;
  studentName: string;
  answers: Record<string, string[] | string>;
}) {
  await ensureAnonymousSession();
  const fn = httpsCallable<typeof input, SubmitResult>(functions, "submitAssignment");
  const res = await fn(input);
  return res.data;
}
