import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import {
  addStudentsBulk,
  progressLink,
  regenerateViewToken,
  removeStudent,
  subscribeStudents,
  updateStudentContact,
} from "@shared/lib/classes";
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

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  async function handleCopyProgressLink(student: Student) {
    const token =
      student.viewToken ?? (await regenerateViewToken(subjectId!, classId!, student.id));
    const link = progressLink(subjectId!, classId!, student.id, token);
    const message = `Kính gửi phụ huynh em ${student.fullName}, thầy/cô gửi link theo dõi tiến độ học tập của em (điểm bài trắc nghiệm, bài tập tự luận theo tuần). Số liệu tự cập nhật mỗi lần mở: ${link}`;
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(student.id);
      setTimeout(() => setCopiedId((id) => (id === student.id ? null : id)), 2000);
    } catch {
      window.prompt("Copy tin nhắn dưới đây để gửi phụ huynh:", message);
    }
  }

  async function handleRevokeProgressLink(student: Student) {
    if (!window.confirm(`Tạo link mới cho ${student.fullName}? Link cũ đã gửi sẽ không mở được nữa.`)) {
      return;
    }
    await regenerateViewToken(subjectId!, classId!, student.id);
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
          {!isViewer && (
            <Link to={`/classes/${classId}/reports`} className="btn-secondary text-sm">
              Báo cáo/campaign →
            </Link>
          )}
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
          <div key={s.id} className="bg-surface-0 border border-surface-200 rounded-md px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-900">{s.fullName}</span>
                {(s.studentEmail || s.parentEmail) && (
                  <span className="ml-2 text-xs text-slate-400">
                    {s.studentEmail && `HS: ${s.studentEmail}`}
                    {s.studentEmail && s.parentEmail && " · "}
                    {s.parentEmail && `PH: ${s.parentEmail}`}
                  </span>
                )}
              </div>
              {isViewer && s.viewToken && (
                <button
                  className="text-sm text-brand-500 hover:underline"
                  onClick={() => handleCopyProgressLink(s)}
                >
                  {copiedId === s.id ? "Đã copy ✓" : "Copy link phụ huynh"}
                </button>
              )}
              {!isViewer && (
                <div className="flex gap-3">
                  <button
                    className="text-sm text-brand-500 hover:underline"
                    onClick={() => handleCopyProgressLink(s)}
                  >
                    {copiedId === s.id ? "Đã copy ✓" : "Copy link phụ huynh"}
                  </button>
                  <button
                    className="text-sm text-slate-500 hover:underline"
                    title="Tạo link mới — link cũ đã gửi sẽ không mở được nữa"
                    onClick={() => handleRevokeProgressLink(s)}
                  >
                    Đổi link
                  </button>
                  <button
                    className="text-sm text-brand-500 hover:underline"
                    onClick={() => setEditingContactId(editingContactId === s.id ? null : s.id)}
                  >
                    {editingContactId === s.id ? "Đóng" : "Email"}
                  </button>
                  <button
                    className="text-sm text-danger-500 hover:underline"
                    onClick={() => removeStudent(subjectId, classId, s.id)}
                  >
                    Xoá
                  </button>
                </div>
              )}
            </div>
            {editingContactId === s.id && (
              <StudentContactForm
                student={s}
                onSave={async (contact) => {
                  await updateStudentContact(subjectId, classId, s.id, contact);
                  setEditingContactId(null);
                }}
              />
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

/** Form nhỏ sửa email học sinh/phụ huynh — dữ liệu dùng để gửi Báo cáo/campaign. */
function StudentContactForm({
  student,
  onSave,
}: {
  student: Student;
  onSave: (contact: { studentEmail?: string; parentEmail?: string }) => Promise<void>;
}) {
  const [studentEmail, setStudentEmail] = useState(student.studentEmail ?? "");
  const [parentEmail, setParentEmail] = useState(student.parentEmail ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-surface-200 pt-2">
      <div>
        <label className="block text-xs text-slate-500">Email học sinh</label>
        <input
          type="email"
          className="input text-sm"
          value={studentEmail}
          onChange={(e) => setStudentEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Email phụ huynh</label>
        <input
          type="email"
          className="input text-sm"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
        />
      </div>
      <button
        className="btn-primary text-sm"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({ studentEmail, parentEmail });
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Đang lưu…" : "Lưu"}
      </button>
    </div>
  );
}
