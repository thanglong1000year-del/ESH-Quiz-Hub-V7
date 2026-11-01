import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchStudentProgress, type StudentProgressView } from "@shared/lib/student-progress";

export default function ParentProgressPage() {
  const { subjectId, classId, studentId, token } = useParams<{
    subjectId: string;
    classId: string;
    studentId: string;
    token: string;
  }>();
  const [data, setData] = useState<StudentProgressView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId || !classId || !studentId || !token) return;
    fetchStudentProgress({ subjectId, classId, studentId, token })
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được tiến độ học tập.")
      );
  }, [subjectId, classId, studentId, token]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-danger-500">{error}</p>
        <p className="text-sm text-slate-500 mt-2">Liên hệ giáo viên bộ môn để nhận link mới.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center text-slate-400 text-sm">Đang tải…</div>;
  }

  const { progress } = data;

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          {data.subjectName} · Lớp {data.className}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{data.studentName}</h1>
        <p className="text-xs text-slate-400 mt-1">
          Số liệu cập nhật trực tiếp mỗi lần mở trang — lưu link này để xem lại bất cứ lúc nào.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-slate-500">Điểm trắc nghiệm trung bình</p>
          <p className="text-2xl font-semibold text-slate-900">
            {progress.avgScore != null ? progress.avgScore.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-slate-500">{progress.submissionCount} bài đã làm</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Bài tập tự luận đã nộp</p>
          <p className="text-2xl font-semibold text-slate-900">
            {progress.submittedWeeks}/{progress.totalWeeks}
          </p>
          <p className="text-xs text-slate-500">tuần được giao</p>
        </div>
      </div>

      <section>
        <h2 className="font-medium text-slate-900 mb-2">Bài trắc nghiệm</h2>
        <div className="space-y-1">
          {data.submissions.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-surface-0 border border-surface-200 rounded-md px-3 py-2 text-sm"
            >
              <div>
                <span className="text-slate-900">{s.title}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(s.submittedAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <span className="font-medium text-slate-900">
                {s.score != null ? s.score.toFixed(1) : "—"} / {s.maxScore}
              </span>
            </div>
          ))}
          {data.submissions.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có bài trắc nghiệm nào.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-medium text-slate-900 mb-2">Bài tập tự luận theo tuần</h2>
        <div className="flex flex-wrap gap-2">
          {data.writtenWeeks.map((w) => (
            <span
              key={w.week}
              title={w.title}
              className={
                "text-xs px-2 py-1 rounded-md border " +
                (w.submitted
                  ? "bg-success-500/10 text-success-500 border-success-500/30"
                  : "bg-danger-500/5 text-danger-500 border-danger-500/30")
              }
            >
              Tuần {w.week}: {w.submitted ? "Đã nộp" : "Chưa nộp"}
            </span>
          ))}
          {data.writtenWeeks.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có tuần nào được giao bài tự luận.</p>
          )}
        </div>
      </section>
    </div>
  );
}
