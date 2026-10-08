import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { listSubmissionsForAssignment } from "@shared/lib/assignments";
import type { Submission } from "@shared/types/core";

export default function AssignmentResultsPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { profile } = useAuth();
  const subjectId = profile?.subjectId;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId || !assignmentId) return;
    listSubmissionsForAssignment(subjectId, assignmentId)
      .then((s) => setSubmissions(s as Submission[]))
      .finally(() => setLoading(false));
  }, [subjectId, assignmentId]);

  if (!subjectId) return null;

  const average =
    submissions.length > 0
      ? (
          submissions.reduce((sum, s) => sum + (s.score ?? 0), 0) / submissions.length
        ).toFixed(1)
      : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="text-sm text-brand-500 hover:underline">
        ← Về trang môn học
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Kết quả bài làm</h1>
        <p className="text-sm text-slate-500">
          {submissions.length} bài nộp · Điểm trung bình: {average}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="space-y-1">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between bg-surface-0 border border-surface-200 rounded-md px-3 py-2"
            >
              <span className="text-slate-900">{s.studentName}</span>
              <span className="font-medium text-slate-900">
                {s.score != null ? s.score.toFixed(1) : "Chờ chấm"} / {s.maxScore}
              </span>
            </div>
          ))}
          {submissions.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">Chưa có học sinh nào nộp bài.</p>
          )}
        </div>
      )}
    </div>
  );
}
