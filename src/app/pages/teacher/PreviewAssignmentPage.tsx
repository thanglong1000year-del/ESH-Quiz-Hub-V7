import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { getPublicAssignment, type SafeQuestion } from "@shared/lib/assignments";
import {
  previewAssignmentAnswers,
  type PreviewAssignmentResult,
} from "@shared/lib/assignment-preview";
import type { Assignment } from "@shared/types/core";

type PreviewAssignment = Omit<Assignment, "questionsSnapshot"> & {
  questionsSnapshot: SafeQuestion[];
};

/**
 * Giáo viên (admin hoặc viewer đúng lớp) xem/làm thử đề trắc nghiệm — KHÔNG
 * ghi nhận kết quả, không ảnh hưởng tiến độ học sinh. Chấm thật qua Cloud
 * Function `previewAssignment` (đọc đáp án đúng server-side) nên vẫn báo
 * đúng/sai chính xác, nhưng không lưu gì vào `submissions`.
 */
export default function PreviewAssignmentPage() {
  const { classId, assignmentId } = useParams<{ classId: string; assignmentId: string }>();
  const { profile } = useAuth();
  const subjectId = profile?.subjectId;

  const [assignment, setAssignment] = useState<PreviewAssignment | null>(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [result, setResult] = useState<PreviewAssignmentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!subjectId || !assignmentId) return;
    getPublicAssignment(subjectId, assignmentId)
      .then((a) => {
        if (!a) {
          setLoadError("Không tìm thấy đề bài.");
          return;
        }
        setAssignment(a as PreviewAssignment);
      })
      .catch(() => setLoadError("Không tải được đề bài."));
  }, [subjectId, assignmentId]);

  if (!subjectId || !assignmentId) return null;

  function setMcAnswer(questionId: string, optionId: string) {
    setResult(null);
    setAnswers((a) => ({ ...a, [questionId]: [optionId] }));
  }

  async function handleCheck() {
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await previewAssignmentAnswers({ subjectId: subjectId!, assignmentId: assignmentId!, answers });
      setResult(res);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Không chấm thử được.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/classes/${classId}/assignments`} className="text-sm text-brand-500 hover:underline">
        ← Về đề / bài giao
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Xem thử đề</h1>
        <p className="text-sm text-slate-500 mt-1">
          Chỉ để bạn xem trước nội dung đề và thử chấm — KHÔNG ghi nhận kết quả, không ảnh
          hưởng tiến độ làm bài của học sinh.
        </p>
      </div>

      {loadError && <p className="text-sm text-danger-500">{loadError}</p>}

      {assignment && (
        <>
          <h2 className="font-medium text-slate-900 mb-4">{assignment.title}</h2>
          <div className="space-y-4">
            {assignment.questionsSnapshot.map((q, idx) => {
              const feedback = result?.perQuestion?.[q.id];
              return (
                <div key={q.id} className="card">
                  <p className="font-medium text-slate-900 mb-3">
                    Câu {idx + 1}. {q.prompt}
                    {feedback && (
                      <span
                        className={
                          "ml-2 text-xs px-2 py-0.5 rounded-full " +
                          (feedback.correct
                            ? "bg-success-500/10 text-success-500"
                            : "bg-danger-500/10 text-danger-500")
                        }
                      >
                        {feedback.correct ? "Đúng" : "Sai"}
                      </span>
                    )}
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
                          {feedback?.correctOptionIds.includes(opt.id) && (
                            <span className="text-xs text-success-500">(đáp án đúng)</span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">
                      Câu tự luận — không chấm thử tự động được.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {submitError && <p className="text-sm text-danger-500 mt-4">{submitError}</p>}

          {result && (
            <p className="text-sm text-slate-700 mt-4">
              Điểm thử: <span className="font-medium">{result.score ?? "—"}</span> / 10 (chỉ
              tính câu trắc nghiệm, không lưu lại)
            </p>
          )}

          <button className="btn-primary w-full mt-6" disabled={submitting} onClick={handleCheck}>
            {submitting ? "Đang chấm thử…" : "Chấm thử"}
          </button>
        </>
      )}
    </div>
  );
}
