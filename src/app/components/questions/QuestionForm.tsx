import { useState, type FormEvent } from "react";
import {
  createEssayQuestion,
  createMultipleChoiceQuestion,
  updateQuestion,
} from "@shared/lib/questions";
import type { Question, QuestionType } from "@shared/types/core";

interface Props {
  subjectId: string;
  createdBy: string;
  /** Khi có giá trị: form ở chế độ sửa câu hỏi đã tồn tại. */
  editing?: Question | null;
  onDone: () => void;
  onCancel: () => void;
}

function newOptionId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function QuestionForm({ subjectId, createdBy, editing, onDone, onCancel }: Props) {
  const [type, setType] = useState<QuestionType>(editing?.type ?? "multiple_choice");
  const [prompt, setPrompt] = useState(editing?.prompt ?? "");
  const [tagsInput, setTagsInput] = useState(editing?.tags.join(", ") ?? "");
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    editing?.type === "multiple_choice"
      ? editing.options
      : [
          { id: newOptionId(), text: "" },
          { id: newOptionId(), text: "" },
        ]
  );
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>(
    editing?.type === "multiple_choice" ? editing.correctOptionIds : []
  );
  const [rubric, setRubric] = useState(editing?.type === "essay" ? (editing.rubric ?? "") : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOptionText(id: string, text: string) {
    setOptions((opts) => opts.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function toggleCorrect(id: string) {
    setCorrectOptionIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  function addOption() {
    setOptions((opts) => [...opts, { id: newOptionId(), text: "" }]);
  }

  function removeOption(id: string) {
    setOptions((opts) => opts.filter((o) => o.id !== id));
    setCorrectOptionIds((ids) => ids.filter((x) => x !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Nội dung câu hỏi không được để trống.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editing) {
        if (type === "multiple_choice") {
          await updateQuestion(subjectId, editing.id, {
            type,
            prompt,
            tags,
            options,
            correctOptionIds,
          } as Partial<Question>);
        } else {
          await updateQuestion(subjectId, editing.id, {
            type,
            prompt,
            tags,
            rubric,
          } as Partial<Question>);
        }
      } else if (type === "multiple_choice") {
        await createMultipleChoiceQuestion(subjectId, createdBy, {
          prompt,
          tags,
          options,
          correctOptionIds,
        });
      } else {
        await createEssayQuestion(subjectId, createdBy, { prompt, tags, rubric });
      }
      onDone();
    } catch {
      setError("Không lưu được câu hỏi. Thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          {editing ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}
        </h2>
        {!editing && (
          <div className="flex rounded-md border border-surface-200 overflow-hidden text-sm">
            <button
              type="button"
              className={`px-3 py-1.5 ${type === "multiple_choice" ? "bg-brand-500 text-white" : "bg-surface-0"}`}
              onClick={() => setType("multiple_choice")}
            >
              Trắc nghiệm
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${type === "essay" ? "bg-brand-500 text-white" : "bg-surface-0"}`}
              onClick={() => setType("essay")}
            >
              Tự luận
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung câu hỏi</label>
        <textarea
          className="input min-h-[80px]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tags (phân cách bằng dấu phẩy)
        </label>
        <input
          className="input"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="ví dụ: chương 1, dễ"
        />
      </div>

      {type === "multiple_choice" ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Lựa chọn (tick vào ô để đánh dấu đáp án đúng)
          </label>
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={correctOptionIds.includes(opt.id)}
                onChange={() => toggleCorrect(opt.id)}
                className="h-4 w-4"
              />
              <input
                className="input flex-1"
                placeholder={`Lựa chọn ${idx + 1}`}
                value={opt.text}
                onChange={(e) => updateOptionText(opt.id, e.target.value)}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="text-slate-400 hover:text-danger-500 text-sm px-1"
                  onClick={() => removeOption(opt.id)}
                >
                  Xoá
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary text-sm" onClick={addOption}>
            + Thêm lựa chọn
          </button>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Biểu điểm / hướng dẫn chấm (tuỳ chọn)
          </label>
          <textarea
            className="input min-h-[60px]"
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-sm text-danger-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Huỷ
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Đang lưu…" : "Lưu câu hỏi"}
        </button>
      </div>
    </form>
  );
}
