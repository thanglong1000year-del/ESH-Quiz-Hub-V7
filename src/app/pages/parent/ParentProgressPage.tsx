import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStudentProgress, type StudentProgressView } from "@shared/lib/student-progress";
import StudentProgressViewPanel from "@/app/components/parent/StudentProgressView";

export default function ParentProgressPage() {
  const { subjectId, classId, studentId, token } = useParams<{
    subjectId: string;
    classId: string;
    studentId: string;
    token: string;
  }>();
  const [data, setData] = useState<StudentProgressView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId || !classId || !studentId || !token) return;
    fetchStudentProgress({ subjectId, classId, studentId, token })
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được tiến độ học tập.")
      );
  }, [subjectId, classId, studentId, token]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-danger-500">{error}</p>
        <p className="text-sm text-slate-500 mt-2">Liên hệ giáo viên bộ môn để nhận link mới.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center text-slate-400 text-sm">Đang tải…</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <p className="text-xs text-slate-400">
        Số liệu cập nhật trực tiếp mỗi lần mở trang — lưu link này để xem lại bất cứ lúc nào.
      </p>

      <StudentProgressViewPanel data={data} />

      <p className="text-xs text-slate-400 border-t border-surface-200 pt-3">
        💡 Lo link này bị người khác lợi dụng gửi giả mạo? Bạn có thể tự tạo tài khoản đăng nhập
        bằng email/mật khẩu của mình thay vì giữ link —{" "}
        <Link to="/parent/login" className="text-brand-500 hover:underline">
          tạo tài khoản tại đây
        </Link>
        .
      </p>
    </div>
  );
}
