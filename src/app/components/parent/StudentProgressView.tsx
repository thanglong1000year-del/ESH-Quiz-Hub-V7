interface ProgressData {
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

/** Hiển thị số liệu tiến độ 1 học sinh — dùng chung cho cả link viewToken và dashboard phụ huynh đăng nhập. */
export default function StudentProgressView({ data }: { data: ProgressData }) {
  const { progress } = data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          {data.subjectName} · Lớp {data.className}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{data.studentName}</h1>
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
