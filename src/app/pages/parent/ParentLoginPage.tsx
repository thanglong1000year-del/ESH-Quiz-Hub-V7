import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  EmailNotVerifiedError,
  resendParentVerificationEmail,
  signInParent,
  signUpParent,
} from "@shared/lib/parent-auth";

type Mode = "signin" | "signup";

export default function ParentLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResent(false);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { needsVerification: needs, children } = await signUpParent(email, password);
        if (needs) {
          setNeedsVerification(true);
        } else if (children.length === 0) {
          setError(
            "Tài khoản đã tạo nhưng chưa tìm thấy học sinh nào dùng email này làm email phụ huynh. Liên hệ giáo viên bộ môn để được thêm vào danh sách lớp, sau đó quay lại đăng nhập."
          );
        } else {
          navigate("/parent", { replace: true });
        }
      } else {
        const { children } = await signInParent(email, password);
        if (children.length === 0) {
          setError(
            "Chưa tìm thấy học sinh nào dùng email này làm email phụ huynh. Liên hệ giáo viên bộ môn để được thêm vào danh sách lớp."
          );
        } else {
          navigate("/parent", { replace: true });
        }
      }
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      if (caught instanceof EmailNotVerifiedError) {
        setNeedsVerification(true);
      } else if (code === "auth/email-already-in-use") {
        setError("Email này đã có tài khoản — hãy chuyển sang tab Đăng nhập.");
      } else if (code === "auth/weak-password") {
        setError("Mật khẩu cần ít nhất 6 ký tự.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Email hoặc mật khẩu không đúng.");
      } else {
        setError("Không thực hiện được. Thử lại sau.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await resendParentVerificationEmail();
      setResent(true);
    } catch {
      setError("Không gửi lại được email xác minh. Đăng nhập lại rồi thử lần nữa.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Dành cho phụ huynh</h1>
          <p className="text-sm text-slate-500 mt-1">
            Xem điểm và tiến độ học tập của con bất cứ lúc nào — không cần giữ link, không cần
            giáo viên nhắc lại.
          </p>
        </div>

        <div className="flex rounded-md border border-surface-200 overflow-hidden text-sm mb-4">
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${mode === "signin" ? "bg-brand-500 text-white" : "bg-surface-0"}`}
            onClick={() => setMode("signin")}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 ${mode === "signup" ? "bg-brand-500 text-white" : "bg-surface-0"}`}
            onClick={() => setMode("signup")}
          >
            Tạo tài khoản
          </button>
        </div>

        {mode === "signup" && (
          <p className="text-xs text-slate-500 mb-4">
            💡 Dùng ĐÚNG email mà giáo viên đã lưu làm "email phụ huynh" cho con bạn trong hệ
            thống — tài khoản mới chỉ xem được con có cùng email này. Sau khi tạo, kiểm tra email
            để xác minh trước khi xem được số liệu.
          </p>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          {needsVerification && (
            <div className="text-sm bg-brand-500/5 border border-brand-500/20 rounded-md p-3 space-y-2">
              <p className="text-slate-700">
                Email chưa được xác minh. Mở email vừa gửi và bấm vào link xác minh, sau đó đăng
                nhập lại ở đây.
              </p>
              <button
                type="button"
                className="text-brand-500 hover:underline text-xs"
                onClick={handleResend}
              >
                {resent ? "Đã gửi lại ✓" : "Gửi lại email xác minh"}
              </button>
            </div>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? "Đang xử lý…"
              : mode === "signup"
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-4">
          Là giáo viên?{" "}
          <Link to="/login" className="text-brand-500 hover:underline">
            Đăng nhập tại đây
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
