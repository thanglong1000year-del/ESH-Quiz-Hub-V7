import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import {
  createReportCampaign,
  deleteReportCampaign,
  runReportCampaignNow,
  subscribeReportCampaigns,
} from "@shared/lib/report-campaigns";
import type { ReportCampaign, ReportRecipientMode } from "@shared/types/core";

const STATUS_LABEL: Record<ReportCampaign["status"], string> = {
  scheduled: "Đã lên lịch",
  running: "Đang gửi…",
  sent: "Đã gửi",
  failed: "Lỗi",
};

const STATUS_CLASS: Record<ReportCampaign["status"], string> = {
  scheduled: "bg-slate-200 text-slate-600",
  running: "bg-brand-500/10 text-brand-500",
  sent: "bg-success-500/10 text-success-500",
  failed: "bg-danger-500/10 text-danger-500",
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReportCampaignsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;

  const [campaigns, setCampaigns] = useState<ReportCampaign[]>([]);
  const [title, setTitle] = useState("");
  const [recipientMode, setRecipientMode] = useState<ReportRecipientMode>("both");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId || !classId) return;
    return subscribeReportCampaigns(subjectId, classId, setCampaigns);
  }, [subjectId, classId]);

  if (!subjectId || !classId) return null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Nhập tên chiến dịch.");

    setSubmitting(true);
    try {
      await createReportCampaign(subjectId!, classId!, config.currentSchoolYear, {
        title: title.trim(),
        recipientMode,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setTitle("");
    } catch {
      setError("Không tạo được chiến dịch. Thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRunNow(campaignId: string) {
    setRunningId(campaignId);
    try {
      await runReportCampaignNow(subjectId!, classId!, campaignId);
    } catch {
      // Lỗi thật đã được ghi vào lastError của chính campaign — hiển thị qua danh sách dưới, không cần báo riêng ở đây.
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/classes/${classId}`} className="text-sm text-brand-500 hover:underline">
        ← Về trang lớp
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Báo cáo/campaign</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gửi email báo cáo tiến độ (điểm trắc nghiệm trung bình + tỉ lệ nộp bài tự luận) cho học
          sinh/phụ huynh có khai báo email. Cần Owner bật Firebase Extension "Trigger Email" trên
          project thật trước khi email thực sự gửi đi — xem README.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tên chiến dịch</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Báo cáo giữa kỳ I"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gửi cho</label>
            <select
              className="input"
              value={recipientMode}
              onChange={(e) => setRecipientMode(e.target.value as ReportRecipientMode)}
            >
              <option value="student">Học sinh</option>
              <option value="parent">Phụ huynh</option>
              <option value="both">Cả hai</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hẹn giờ gửi</label>
            <input
              type="datetime-local"
              className="input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger-500">{error}</p>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Đang tạo…" : "Tạo chiến dịch"}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  className="text-sm text-brand-500 hover:underline"
                  disabled={runningId === c.id || c.status === "running"}
                  onClick={() => handleRunNow(c.id)}
                >
                  {runningId === c.id ? "Đang gửi…" : "Gửi ngay"}
                </button>
                <button
                  className="text-sm text-danger-500 hover:underline"
                  onClick={() => deleteReportCampaign(subjectId, classId, c.id)}
                >
                  Xoá
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Gửi cho: {c.recipientMode === "both" ? "Học sinh + Phụ huynh" : c.recipientMode === "student" ? "Học sinh" : "Phụ huynh"}
              {" · "}Hẹn giờ: {new Date(c.scheduledAt).toLocaleString("vi-VN")}
              {typeof c.sentCount === "number" && ` · Đã gửi: ${c.sentCount}/${c.targetCount ?? 0}`}
            </p>
            {/* Lỗi thật LUÔN hiển thị ở đây — đây chính là lỗ hổng UX đã phát hiện ở V6.3.8
                (lastError có trong Firestore nhưng không bao giờ hiện ra UI). */}
            {c.lastError && (
              <p className="text-xs text-danger-500 bg-danger-500/5 rounded px-2 py-1">
                Lý do lỗi: {c.lastError}
              </p>
            )}
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Chưa có chiến dịch báo cáo nào.</p>
        )}
      </div>
    </div>
  );
}
