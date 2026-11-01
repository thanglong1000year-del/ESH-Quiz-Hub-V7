import { useState } from "react";
import { parseQuestionBankBulkText } from "@shared/lib/bulk-import";
import { createMultipleChoiceQuestionsBulk } from "@shared/lib/questions";

const EXAMPLE =
  "Câu hỏi\tLựa chọn A\tLựa chọn B\tLựa chọn C\tLựa chọn D\tĐáp án đúng\tTags\n" +
  "Nhà Lý dời đô về đâu năm 1010?\tHoa Lư\tThăng Long\tPhú Xuân\tHuế\tB\tchương 1\n" +
  "Ai lãnh đạo khởi nghĩa Lam Sơn?\tTrần Hưng Đạo\tLê Lợi\tQuang Trung\tLý Thường Kiệt\tB\tchương 2";

export default function BulkImportQuestionsPanel({
  subjectId,
  createdBy,
  onCancel,
}: {
  subjectId: string;
  createdBy: string;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleImport() {
    const { items, errors: parseErrors } = parseQuestionBankBulkText(text);
    setErrors(parseErrors);
    setResult(null);
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const created = await createMultipleChoiceQuestionsBulk(subjectId, createdBy, items);
      setResult(
        `Đã nhập ${created} câu hỏi. Hệ thống đang tự kiểm tra từng câu (trùng lặp, đáp án hợp lệ…) — vài giây nữa sẽ thấy nhãn "Hợp lệ"/"Có lỗi" trong danh sách bên dưới.`
      );
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold text-slate-900">Nhập câu hỏi hàng loạt</h2>
        <p className="text-xs text-slate-500 mt-1">
          💡 Dán trực tiếp từ Excel/Sheets (hoặc gõ tay, ngăn cách bằng dấu phẩy). Mỗi dòng 1 câu
          hỏi trắc nghiệm, theo đúng thứ tự cột: <strong>Câu hỏi, Lựa chọn A, B, C, D, Đáp án
          đúng (vd: B hoặc A,C nếu nhiều đáp án), Tags (tuỳ chọn)</strong>. Chỉ cần tối thiểu 2
          lựa chọn (A, B) — không bắt buộc đủ 4.
        </p>
        <details className="text-xs text-slate-500 mt-1">
          <summary className="cursor-pointer text-brand-500">Xem ví dụ mẫu (bấm để sao chép)</summary>
          <pre className="bg-surface-100 border border-surface-200 rounded-md p-2 mt-1 overflow-x-auto whitespace-pre">
            {EXAMPLE}
          </pre>
        </details>
      </div>

      <textarea
        className="input min-h-[140px] font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dán nội dung đã copy từ Excel/Sheets vào đây…"
      />

      {errors.length > 0 && (
        <ul className="text-xs text-danger-500 list-disc pl-4">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {result && <p className="text-sm text-success-500">{result}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {result ? "Đóng" : "Huỷ"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={submitting || !text.trim()}
          onClick={handleImport}
        >
          {submitting ? "Đang nhập…" : "Kiểm tra và nhập câu hỏi"}
        </button>
      </div>
    </div>
  );
}
