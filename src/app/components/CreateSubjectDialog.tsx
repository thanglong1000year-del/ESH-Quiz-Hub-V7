import { useState, type FormEvent } from "react";
import { createTeacherAdmin } from "@shared/lib/teacher-admin";

/**
 * Owner tạo môn học mới + tài khoản giáo viên admin sở hữu môn đó trong 1
 * bước — qua Cloud Function `createTeacherAdmin` (Admin SDK, tạo thật tài
 * khoản Firebase Auth). Thay cho quy trình thủ công cũ (tạo tay trên Firebase
 * Console/Auth rồi dán UID).
 *
 * App chưa có hệ thống gửi email — mật khẩu tạm được trả về MỘT LẦN DUY NHẤT
 * ngay sau khi tạo, Owner tự chuyển cho giáo viên (Zalo/tin nhắn...).
 */
export default function CreateSubjectDialog({ onClose }: { onClose: () => void }) {
  const [subjectName, setSubjectName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subjectName.trim() || !email.trim() || !displayName.trim()) {
      setError("Vui lòng nhập đầy đủ tên môn, email và tên giáo viên.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createTeacherAdmin({
        subjectName: subjectName.trim(),
        email: email.trim(),
        displayName: displayName.trim(),
      });
      setResult({ email: res.email, tempPassword: res.tempPassword });
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      if (code === "functions/already-exists") {
        setError("Email này đã có tài khoản đăng nhập trong hệ thống.");
      } else {
        setError("Không tạo được môn học. Thử lại sau.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4">
        <div className="card w-full max-w-md space-y-4">
          <h2 className="text-lg font-semibold text-success-500">Đã tạo môn học!</h2>
          <p className="text-sm text-slate-600">
            Gửi thông tin đăng nhập dưới đây cho giáo viên — mật khẩu này chỉ hiển thị
            MỘT LẦN DUY NHẤT, không thể xem lại sau khi đóng cửa sổ này.
          </p>
          <div className="bg-surface-100 border border-surface-200 rounded-md p-3 space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Email: </span>
              <span className="font-mono">{result.email}</span>
            </p>
            <p>
              <span className="text-slate-500">Mật khẩu tạm: </span>
              <span className="font-mono font-medium">{result.tempPassword}</span>
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={onClose}>
              Đã lưu, đóng lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Tạo môn học mới</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên môn học
            </label>
            <input
              className="input"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="Ví dụ: Sinh học 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên giáo viên sở hữu (admin của môn)
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email đăng nhập của giáo viên
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="giaovien@example.com"
            />
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống tự tạo tài khoản + mật khẩu tạm — bạn gửi lại cho giáo viên sau khi tạo.
            </p>
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Đang tạo…" : "Tạo môn học"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
