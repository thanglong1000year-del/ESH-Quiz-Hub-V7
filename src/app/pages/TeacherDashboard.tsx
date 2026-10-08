import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuth } from "@shared/lib/auth-context";
import { auth } from "@/firebase/client";

/**
 * Khung điều hướng cho giáo viên trong phạm vi môn của mình.
 *
 * Có 2 vai trò (xem docs/DATA_MODEL.md):
 * - "admin": toàn quyền trong môn (ngân hàng câu hỏi, mọi lớp, mời viewer).
 * - "viewer": chỉ xem đúng 1 lớp được gán (được mời bởi admin, đăng nhập
 *   bằng Gmail cá nhân) — không có quyền sửa gì.
 */
export default function TeacherDashboard() {
  const { profile } = useAuth();

  if (!profile?.subjectId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="card space-y-3">
          <p className="text-slate-700">
            Tài khoản của bạn chưa được gán môn học nào, hoặc Gmail bạn dùng chưa được giáo
            viên quản trị môn mời xem lớp nào. Liên hệ Owner (nếu bạn là giáo viên quản trị
            môn) hoặc giáo viên quản trị môn của bạn (nếu bạn được mời xem lớp).
          </p>
          <button className="btn-secondary text-sm" onClick={() => signOut(auth)}>
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (profile.teacherRole === "viewer") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Lớp bạn đang theo dõi</h1>
        <p className="text-sm text-slate-500 mb-6">
          Bạn chỉ xem được lớp dưới đây — danh sách học sinh, đề trắc nghiệm (xem + làm thử,
          không ghi nhận kết quả), kết quả/tiến độ nộp bài. Không thể sửa dữ liệu.
        </p>
        <Link
          to={`/classes/${profile.viewerClassId}`}
          className="card hover:border-brand-300 transition-colors block"
        >
          <h2 className="font-medium text-slate-900">Mở lớp của bạn →</h2>
        </Link>
      </div>
    );
  }

  const sections = [
    {
      title: "Ngân hàng câu hỏi",
      desc: "Soạn và quản lý câu hỏi trắc nghiệm/tự luận của môn bạn.",
      to: "/questions",
    },
    {
      title: "Lớp học",
      desc: "Quản lý lớp, danh sách học sinh, tạo đề, xem kết quả, mời giáo viên xem lớp.",
      to: "/classes",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Môn của bạn</h1>
      <p className="text-sm text-slate-500 mb-6">
        Mọi dữ liệu bạn tạo ở đây chỉ thuộc về môn này — không giáo viên môn khác nào thấy được.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link key={s.title} to={s.to} className="card hover:border-brand-300 transition-colors">
            <h2 className="font-medium text-slate-900">{s.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
