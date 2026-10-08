import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import { addStudentsBulk, removeStudent, subscribeStudents } from "@shared/lib/classes";
import {
  inviteViewerTeacher,
  revokeInvite,
  subscribeClassInvites,
} from "@shared/lib/teacher-invites";
import type { Student, TeacherInvite } from "@shared/types/core";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;
  // Viewer chỉ xem được ĐÚNG lớp mình được gán — mọi lớp khác không vào
  // được trang này (rules Firestore sẽ chặn đọc nếu cố truy cập trực tiếp).
  const isViewer = profile?.teacherRole === "viewer";

  const [students, setStudents] = useState<Student[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  useEffect(() => {
    if (!subjectId || !classId) return;
    return subscribeStudents(subjectId, classId, setStudents);
  }, [subjectId, classId]);

  useEffect(() => {
    if (!subjectId || !classId || isViewer) return;
    return subscribeClassInvites(subjectId, classId, setInvites);
  }, [subjectId, classId, isViewer]);

  if (!subjectId || !classId) return null;

  async function handleAdd() {
    const names = bulkInput.split("\n").filter((n) => n.trim());
    if (names.length === 0) return;
    setSubmitting(true);
    try {
      await addStudentsBulk(subjectId!, classId!, config.currentSchoolYear, names);
      setBulkInput("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail.trim()) return;

    setInviteSubmitting(true);
    try {
      await inviteViewerTeacher(subjectId!, classId!, inviteEmail, profile!.uid);
      setInviteEmail("");
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : "Không mời được giáo viên này.");
    } finally {
      setInviteSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/classes" className="text-sm text-brand-500 hover:underline">
        ← Về danh sách lớp
      </Link>

      {isViewer && (
        <p className="mt-2 mb-2 text-xs inline-block bg-surface-100 border border-surface-200 rounded-full px-3 py-1 text-slate-500">
          Chế độ chỉ xem — bạn được mời theo dõi lớp này, không thể sửa dữ liệu.
        </p>
      )}

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Học sinh ({students.length})
        </h1>
        <div className="flex gap-2">
          <Link to={`/classes/${classId}/written`} className="btn-secondary text-sm">
            Bài tập tự luận →
          </Link>
          <Link to={`/classes/${classId}/assignments`} className="btn-secondary text-sm">
            Đề / bài giao của lớp →
          </Link>
        </div>
      </div>

      {!isViewer && (
        <div className="card mb-6 space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Thêm học sinh (mỗi dòng 1 tên — dán trực tiếp từ Excel/Sheets)
          </label>
          <textarea
            className="input min-h-[100px]"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"Nguyễn Văn A\nTrần Thị B"}
          />
          <div className="flex justify-end">
            <button className="btn-primary" disabled={submitting} onClick={handleAdd}>
              {submitting ? "Đang thêm…" : "Thêm học sinh"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1 mb-6">
        {students.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-surface-0 border border-surface-200 rounded-md px-3 py-2"
          >
            <span className="text-slate-900">{s.fullName}</span>
            {!isViewer && (
              <button
                className="text-sm text-danger-500 hover:underline"
                onClick={() => removeStudent(subjectId, classId, s.id)}
              >
                Xoá
              </button>
            )}
          </div>
        ))}
        {students.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Lớp chưa có học sinh nào.</p>
        )}
      </div>

      {!isViewer && (
        <div className="card space-y-3">
          <div>
            <h2 className="font-medium text-slate-900">Giáo viên được mời xem lớp này</h2>
            <p className="text-sm text-slate-500 mt-1">
              Giáo viên được mời chỉ XEM (không sửa) được đúng lớp này: danh sách học sinh, đề
              trắc nghiệm (xem + làm thử, không ghi nhận kết quả), kết quả/tiến độ nộp bài. Họ
              đăng nhập bằng Gmail cá nhân — không cần Owner tạo tài khoản.
            </p>
          </div>

          <form className="flex gap-2" onSubmit={handleInvite}>
            <input
              type="email"
              className="input flex-1"
              placeholder="gmail.cua.giaovien@gmail.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button className="btn-primary text-sm whitespace-nowrap" disabled={inviteSubmitting}>
              {inviteSubmitting ? "Đang mời…" : "+ Mời"}
            </button>
          </form>
          {inviteError && <p className="text-sm text-danger-500">{inviteError}</p>}

          <div className="space-y-1">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between bg-surface-0 border border-surface-200 rounded-md px-3 py-2"
              >
                <div>
                  <span className="text-slate-900 text-sm">{inv.email}</span>
                  <span
                    className={
                      "ml-2 text-xs px-2 py-0.5 rounded-full " +
                      (inv.status === "accepted"
                        ? "bg-success-500/10 text-success-500"
                        : "bg-slate-200 text-slate-600")
                    }
                  >
                    {inv.status === "accepted" ? "Đã nhận lời mời" : "Đang chờ đăng nhập"}
                  </span>
                </div>
                <button
                  className="text-sm text-danger-500 hover:underline"
                  onClick={() => revokeInvite(inv.email)}
                >
                  Xoá quyền
                </button>
              </div>
            ))}
            {invites.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Chưa mời giáo viên nào xem lớp này.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
