import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";

/**
 * Khung điều hướng cho giáo viên trong phạm vi môn của mình.
 */
export default function TeacherDashboard() {
  const { profile } = useAuth();

  if (!profile?.subjectId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="card">
          <p className="text-slate-700">
            Tài khoản của bạn chưa được gán môn học nào. Liên hệ Owner để được gán môn.
          </p>
        </div>
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
      desc: "Quản lý lớp, danh sách học sinh, tạo đề và xem kết quả.",
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
