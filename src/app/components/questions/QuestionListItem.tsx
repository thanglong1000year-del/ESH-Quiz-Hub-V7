import type { Question } from "@shared/types/core";
import ValidationBadge from "./ValidationBadge";

interface Props {
  question: Question;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
}

export default function QuestionListItem({ question, onEdit, onDelete, onRestore }: Props) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {question.type === "multiple_choice" ? "Trắc nghiệm" : "Tự luận"}
            </span>
            <ValidationBadge validation={question.validation} />
          </div>
          <p className="text-slate-900 whitespace-pre-wrap">{question.prompt}</p>

          {question.type === "multiple_choice" && (
            <ul className="mt-2 space-y-1">
              {question.options.map((o) => (
                <li
                  key={o.id}
                  className={
                    "text-sm pl-2 " +
                    (question.correctOptionIds.includes(o.id)
                      ? "text-success-500 font-medium"
                      : "text-slate-600")
                  }
                >
                  {question.correctOptionIds.includes(o.id) ? "✓ " : "— "}
                  {o.text || <span className="italic text-slate-400">(trống)</span>}
                </li>
              ))}
            </ul>
          )}

          {question.validation.status === "failed" && question.validation.issues.length > 0 && (
            <ul className="mt-2 text-sm text-danger-500 list-disc list-inside">
              {question.validation.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}

          {question.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {question.tags.map((t) => (
                <span key={t} className="text-xs bg-surface-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {onRestore ? (
            <button className="btn-secondary text-sm" onClick={onRestore}>
              Khôi phục
            </button>
          ) : (
            <>
              <button className="btn-secondary text-sm" onClick={onEdit}>
                Sửa
              </button>
              <button
                className="text-sm text-danger-500 hover:underline px-3 py-1.5"
                onClick={onDelete}
              >
                Xoá
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
