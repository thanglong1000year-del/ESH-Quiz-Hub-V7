import { useAuth } from "@shared/lib/auth-context";

/**
 * Khung điều hướng cho giáo viên trong phạm vi môn của mình.
 * Các phần dưới (ngân hàng câu hỏi, lớp học, đề/bài giao, báo cáo) sẽ được
 * xây tiếp ở các bước sau — đây là Giai đoạn 0: nền tảng điều hướng + xác
 * nhận cô lập theo subjectId hoạt động đúng.
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
    { title: "Ngân hàng câu hỏi", desc: "Soạn và quản lý câu hỏi trắc nghiệm/tự luận của môn bạn." },
    { title: "Lớp học", desc: "Quản lý lớp và danh sách học sinh của bạn." },
    { title: "Đề / bài giao", desc: "Tạo đề thi, bài tập từ ngân hàng câu hỏi." },
    { title: "Kết quả & điểm danh", desc: "Xem kết quả làm bài và điểm danh theo lớp." },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Môn của bạn</h1>
      <p className="text-sm text-slate-500 mb-6">
        Mọi dữ liệu bạn tạo ở đây chỉ thuộc về môn này — không giáo viên môn khác nào thấy được.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="card">
            <h2 className="font-medium text-slate-900">{s.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
