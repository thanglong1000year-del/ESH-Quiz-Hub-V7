import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import { closeAssignment, publishAssignment, subscribeAssignments } from "@shared/lib/assignments";
import type { Assignment } from "@shared/types/core";
import CreateAssignmentDialog from "@/app/components/assignments/CreateAssignmentDialog";

const STATUS_LABEL: Record<Assignment["status"], string> = {
  draft: "Chưa mở",
  published: "Đang mở",
  closed: "Đã đóng",
};
const STATUS_STYLE: Record<Assignment["status"], string> = {
  draft: "bg-slate-200 text-slate-600",
  published: "bg-success-500/10 text-success-500",
  closed: "bg-surface-200 text-slate-500",
};

export default function AssignmentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;
  const isViewer = profile?.teacherRole === "viewer";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!subjectId || !classId) return;
    return subscribeAssignments(subjectId, classId, setAssignments);
  }, [subjectId, classId]);

  if (!subjectId || !classId) return null;

  const takeLink = (assignmentId: string) =>
    `${window.location.origin}/take/${subjectId}/${assignmentId}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/classes/${classId}`} className="text-sm text-brand-500 hover:underline">
        ← Về lớp học
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Đề / bài giao</h1>
        {!isViewer && (
          <button className="btn-primary" onClick={() => setDialogOpen(true)}>
            + Tạo đề mới
          </button>
        )}
      </div>

      <div className="space-y-3">
        {assignments.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{a.title}</p>
                <p className="text-sm text-slate-500">
                  {a.questionIds.length} câu · {a.durationMinutes} phút
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[a.status]}`}>
                {STATUS_LABEL[a.status]}
              </span>
            </div>

            {!isViewer && a.status === "published" && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  className="input text-xs flex-1"
                  value={takeLink(a.id)}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="btn-secondary text-sm whitespace-nowrap"
                  onClick={() => navigator.clipboard.writeText(takeLink(a.id))}
                >
                  Copy link
                </button>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {!isViewer && a.status === "draft" && (
                <button
                  className="btn-primary text-sm"
                  onClick={() => publishAssignment(subjectId, a.id)}
                >
                  Mở cho học sinh làm bài
                </button>
              )}
              {!isViewer && a.status === "published" && (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => closeAssignment(subjectId, a.id)}
                >
                  Đóng đề
                </button>
              )}
              <Link to={`/classes/${classId}/assignments/${a.id}/preview`} className="btn-secondary text-sm">
                Xem thử đề
              </Link>
              <Link to={`/assignments/${a.id}/results`} className="btn-secondary text-sm">
                Xem kết quả
              </Link>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            Lớp này chưa có đề bài nào. Tạo đề đầu tiên ở trên.
          </p>
        )}
      </div>

      {dialogOpen && (
        <CreateAssignmentDialog
          subjectId={subjectId}
          classId={classId}
          schoolYear={config.currentSchoolYear}
          defaultDurationMinutes={config.defaultAssignmentDurationMinutes}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
