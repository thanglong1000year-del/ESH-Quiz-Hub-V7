import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicAssignment, type SafeQuestion } from "@shared/lib/assignments";
import { submitAssignmentAnswers } from "@shared/lib/student-submit";
import type { Assignment } from "@shared/types/core";

type Phase = "loading" | "name" | "answering" | "submitting" | "done" | "error" | "unavailable";

export default function TakeAssignmentPage() {
  const { subjectId, assignmentId } = useParams<{ subjectId: string; assignmentId: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [assignment, setAssignment] = useState<
    (Assignment & { questionsSnapshot: SafeQuestion[] }) | null
  >(null);
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [result, setResult] = useState<{ score: number | null } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId || !assignmentId) return;
    getPublicAssignment(subjectId, assignmentId)
      .then((a) => {
        if (!a || a.status !== "published") {
          setPhase("unavailable");
          return;
        }
        const now = Date.now();
        if (now < new Date(a.openAt).getTime() || now > new Date(a.closeAt).getTime()) {
          setPhase("unavailable");
          return;
        }
        setAssignment(a as Assignment & { questionsSnapshot: SafeQuestion[] });
        setPhase("name");
      })
      .catch(() => setPhase("unavailable"));
  }, [subjectId, assignmentId]);

  function setMcAnswer(questionId: string, optionId: string) {
    setAnswers((a) => ({ ...a, [questionId]: [optionId] }));
  }

  function setEssayAnswer(questionId: string, text: string) {
    setAnswers((a) => ({ ...a, [questionId]: text }));
  }

  async function handleSubmit() {
    if (!subjectId || !assignmentId) return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      const res = await submitAssignmentAnswers({
        subjectId,
        assignmentId,
        studentName,
        answers,
      });
      setResult({ score: res.score });
      setPhase("done");
    } catch {
      setErrorMsg("Nộp bài không thành công. Kiểm tra kết nối mạng và thử lại.");
      setPhase("answering");
    }
  }

  if (phase === "loading") {
    return <CenteredMessage text="Đang tải đề bài…" />;
  }
  if (phase === "unavailable") {
    return <CenteredMessage text="Đề bài này chưa mở, đã đóng, hoặc không tồn tại." />;
  }
  if (!assignment) return null;

  if (phase === "name") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm card">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">{assignment.title}</h1>
          <p className="text-sm text-slate-500 mb-4">
            {assignment.questionsSnapshot.length} câu · {assignment.durationMinutes} phút
          </p>
          <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
          <input
            className="input mb-4"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Nhập đầy đủ họ tên"
          />
          <button
            className="btn-primary w-full"
            disabled={!studentName.trim()}
            onClick={() => setPhase("answering")}
          >
            Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <CenteredMessage
        text={
          result?.score != null
            ? `Đã nộp bài! Điểm trắc nghiệm của bạn: ${result.score.toFixed(1)} / 10`
            : "Đã nộp bài! Giáo viên sẽ chấm và thông báo kết quả sau."
        }
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-lg font-semibold text-slate-900 mb-1">{assignment.title}</h1>
      <p className="text-sm text-slate-500 mb-6">Học sinh: {studentName}</p>

      <div className="space-y-4">
        {assignment.questionsSnapshot.map((q, idx) => (
          <div key={q.id} className="card">
            <p className="font-medium text-slate-900 mb-3">
              Câu {idx + 1}. {q.prompt}
            </p>
            {q.type === "multiple_choice" ? (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      checked={(answers[q.id] as string[] | undefined)?.[0] === opt.id}
                      onChange={() => setMcAnswer(q.id, opt.id)}
                    />
                    {opt.text}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="input min-h-[100px]"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setEssayAnswer(q.id, e.target.value)}
                placeholder="Nhập câu trả lời…"
              />
            )}
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-sm text-danger-500 mt-4">{errorMsg}</p>}

      <button
        className="btn-primary w-full mt-6"
        disabled={phase === "submitting"}
        onClick={handleSubmit}
      >
        {phase === "submitting" ? "Đang nộp bài…" : "Nộp bài"}
      </button>
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <p className="text-slate-600 max-w-sm">{text}</p>
    </div>
  );
}
