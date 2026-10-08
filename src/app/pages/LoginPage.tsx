import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "@/firebase/client";
import { claimTeacherInvite } from "@shared/lib/teacher-invites";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/", { replace: true });
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Dành cho giáo viên được mời (viewer) — đăng nhập bằng Gmail cá nhân,
   * không có mật khẩu riêng do app cấp (xem docs/DATA_MODEL.md). Sau khi
   * đăng nhập Google thành công, auth-context.tsx tự phát hiện chưa có hồ sơ
   * `/users/{uid}` và gọi `claimTeacherInvite` — nhưng gọi luôn ở đây để báo
   * lỗi ngay nếu email chưa được mời, thay vì để người dùng kẹt ở trang trắng.
   */
  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await claimTeacherInvite().catch((caught) => {
        // "already-exists" nghĩa là hồ sơ đã có từ trước (admin, hoặc viewer
        // đã nhận lời mời ở lần đăng nhập trước) — auth-context sẽ tự tải
        // hồ sơ hiện có, không cần coi là lỗi.
        const code = (caught as { code?: string })?.code;
        if (code !== "functions/already-exists") throw caught;
      });
      navigate("/", { replace: true });
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      if (code === "functions/not-found") {
        setError(
          "Email Gmail này chưa được giáo viên quản trị môn mời. Liên hệ giáo viên quản trị môn của bạn."
        );
      } else if (code !== "auth/popup-closed-by-user") {
        setError("Đăng nhập Google không thành công. Thử lại sau.");
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">ESH Quiz Hub</h1>
          <p className="text-sm text-slate-500 mt-1">Đăng nhập để tiếp tục</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-surface-200" />
          <span className="text-xs text-slate-400">hoặc</span>
          <div className="flex-1 border-t border-surface-200" />
        </div>

        <button
          type="button"
          className="btn-secondary w-full"
          disabled={googleSubmitting}
          onClick={handleGoogleSignIn}
        >
          {googleSubmitting ? "Đang đăng nhập…" : "Đăng nhập bằng Google"}
        </button>
        <p className="text-xs text-slate-400 text-center mt-2">
          Dành cho giáo viên được mời xem lớp — dùng đúng Gmail đã được mời.
        </p>
      </div>
    </div>
  );
}
