import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import {
  restoreQuestion,
  softDeleteQuestion,
  subscribeQuestions,
  subscribeTrashedQuestions,
} from "@shared/lib/questions";
import type { Question } from "@shared/types/core";
import QuestionForm from "@/app/components/questions/QuestionForm";
import QuestionListItem from "@/app/components/questions/QuestionListItem";

export default function QuestionBankPage() {
  const { profile } = useAuth();
  const subjectId = profile?.subjectId;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [trashed, setTrashed] = useState<Question[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!subjectId) return;
    const unsub1 = subscribeQuestions(subjectId, setQuestions);
    const unsub2 = subscribeTrashedQuestions(subjectId, setTrashed);
    return () => {
      unsub1();
      unsub2();
    };
  }, [subjectId]);

  if (!subjectId || !profile) return null;

  const visible = (showTrash ? trashed : questions).filter((q) =>
    q.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="text-sm text-brand-500 hover:underline">
        ← Về trang môn học
      </Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-slate-500">
            {questions.length} câu hỏi đang hoạt động
            {trashed.length > 0 && ` · ${trashed.length} trong thùng rác`}
          </p>
        </div>
        {!showTrash && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Thêm câu hỏi
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          className="input flex-1"
          placeholder="Tìm câu hỏi…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn-secondary text-sm whitespace-nowrap"
          onClick={() => setShowTrash((v) => !v)}
        >
          {showTrash ? "← Danh sách chính" : `Thùng rác (${trashed.length})`}
        </button>
      </div>

      {formOpen && (
        <div className="mb-6">
          <QuestionForm
            subjectId={subjectId}
            createdBy={profile.uid}
            editing={editing}
            onDone={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      )}

      <div className="space-y-3">
        {visible.map((q) => (
          <QuestionListItem
            key={q.id}
            question={q}
            onEdit={() => {
              setEditing(q);
              setFormOpen(true);
            }}
            onDelete={() => softDeleteQuestion(subjectId, q.id)}
            onRestore={showTrash ? () => restoreQuestion(subjectId, q.id) : undefined}
          />
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            {showTrash ? "Thùng rác trống." : "Chưa có câu hỏi nào. Thêm câu hỏi đầu tiên."}
          </p>
        )}
      </div>
    </div>
  );
}
