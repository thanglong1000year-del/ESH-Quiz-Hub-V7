import { useEffect, useState, type FormEvent } from "react";
import { subscribeQuestions } from "@shared/lib/questions";
import { createAssignment } from "@shared/lib/assignments";
import type { Question } from "@shared/types/core";

interface Props {
  subjectId: string;
  classId: string;
  schoolYear: string;
  defaultDurationMinutes: number;
  onClose: () => void;
}

export default function CreateAssignmentDialog({
  subjectId,
  classId,
  schoolYear,
  defaultDurationMinutes,
  onClose,
}: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [openAt, setOpenAt] = useState(() => toLocalInput(new Date()));
  const [closeAt, setCloseAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeQuestions(subjectId, setQuestions), [subjectId]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Nhập tên đề bài.");
    if (selected.size === 0) return setError("Chọn ít nhất 1 câu hỏi.");

    setSubmitting(true);
    try {
      await createAssignment(subjectId, {
        classId,
        schoolYear,
        title: title.trim(),
        questionIds: Array.from(selected),
        durationMinutes: duration,
        openAt: new Date(openAt).toISOString(),
        closeAt: new Date(closeAt).toISOString(),
      });
      onClose();
    } catch {
      setError("Không tạo được đề bài. Thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  const validQuestions = questions.filter((q) => q.validation.status !== "failed");

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-10">
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Tạo đề bài mới</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên đề bài</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Thời gian làm bài (phút)
              </label>
              <input
                type="number"
                min={1}
                className="input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mở lúc</label>
              <input
                type="datetime-local"
                className="input"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đóng lúc</label>
              <input
                type="datetime-local"
                className="input"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Chọn câu hỏi ({selected.size} đã chọn)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-surface-200 rounded-md p-2">
              {validQuestions.map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                  <span className="text-slate-700">{q.prompt}</span>
                </label>
              ))}
              {validQuestions.length === 0 && (
                <p className="text-sm text-slate-500">
                  Chưa có câu hỏi hợp lệ nào. Thêm câu hỏi ở Ngân hàng câu hỏi trước.
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Đang tạo…" : "Tạo đề (chưa mở)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
