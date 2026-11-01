import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import {
  addStudentsBulk,
  bulkUpdateParentEmails,
  progressLink,
  regenerateViewToken,
  removeStudent,
  subscribeStudents,
  updateStudentContact,
} from "@shared/lib/classes";
import { parseParentContactBulkText, parseStudentRosterBulkText } from "@shared/lib/bulk-import";
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
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const [parentBulkInput, setParentBulkInput] = useState("");
  const [parentBulkSubmitting, setParentBulkSubmitting] = useState(false);
  const [parentBulkErrors, setParentBulkErrors] = useState<string[]>([]);
  const [parentBulkResult, setParentBulkResult] = useState<string | null>(null);

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
    const { items, errors } = parseStudentRosterBulkText(bulkInput);
    setBulkErrors(errors);
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await addStudentsBulk(subjectId!, classId!, config.currentSchoolYear, items);
      setBulkInput("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleParentBulkUpdate() {
    const { items, errors } = parseParentContactBulkText(parentBulkInput);
    setParentBulkErrors(errors);
    setParentBulkResult(null);
    if (items.length === 0) return;
    setParentBulkSubmitting(true);
    try {
      const { matched, unmatched } = await bulkUpdateParentEmails(subjectId!, classId!, items);
      setParentBulkResult(
        `Đã cập nhật email phụ huynh cho ${matched} học sinh.` +
          (unmatched.length > 0
            ? ` Không tìm thấy tên: ${unmatched.join(", ")} — kiểm tra lại chính tả, dấu cách.`
            : "")
      );
      setParentBulkInput("");
    } finally {
      setParentBulkSubmitting(false);
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
            Thêm học sinh hàng loạt (mỗi dòng 1 học sinh)
          </label>
          <p className="text-xs text-slate-500">
            💡 Dán trực tiếp từ Excel/Sheets. Cách đơn giản nhất: mỗi dòng chỉ cần tên. Muốn thêm
            luôn email thì mỗi dòng ghi <strong>Tên, Email học sinh, Email phụ huynh</strong> (email
            có thể để trống, thêm sau cũng được). Có nhiều phụ huynh cùng muốn xem (ví dụ cả bố và
            mẹ) thì ghi nhiều email cách nhau bằng dấu <strong>;</strong> trong cột cuối.
          </p>
          <textarea
            className="input min-h-[100px]"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"Nguyễn Văn A\nTrần Thị B, tranthib@gmail.com, bo@gmail.com;me@gmail.com"}
          />
          {bulkErrors.length > 0 && (
            <ul className="text-xs text-danger-500 list-disc pl-4">
              {bulkErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
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
                {(s.studentEmail || (s.parentEmails && s.parentEmails.length > 0)) && (
                  <span className="ml-2 text-xs text-slate-400">
                    {s.studentEmail && `HS: ${s.studentEmail}`}
                    {s.studentEmail && s.parentEmails && s.parentEmails.length > 0 && " · "}
                    {s.parentEmails && s.parentEmails.length > 0 && `PH: ${s.parentEmails.join(", ")}`}
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

      {!isViewer && students.length > 0 && (
        <div className="card mb-6 space-y-2">
          <h2 className="font-medium text-slate-900">Cập nhật email phụ huynh hàng loạt</h2>
          <p className="text-xs text-slate-500">
            💡 Dùng khi đã có danh sách lớp nhưng mới nhận được danh sách email phụ huynh sau — mỗi
            dòng ghi <strong>Tên học sinh, Email phụ huynh</strong>, hệ thống tự khớp theo đúng tên đã
            có trong lớp (không phân biệt hoa/thường) và THÊM VÀO (không xoá email đã có trước đó).
            Có nhiều phụ huynh cùng muốn xem (ví dụ cả bố và mẹ) thì ghi nhiều email cách nhau bằng
            dấu <strong>;</strong> trong cột email. Sau khi có email, phụ huynh có thể tự tạo tài
            khoản đăng nhập xem kết quả tại trang "Dành cho phụ huynh" (an toàn hơn link, vì không
            thể bị gửi giả mạo) — hoặc vẫn dùng link "Copy link phụ huynh" như trước, tuỳ ý.
          </p>
          <textarea
            className="input min-h-[80px]"
            value={parentBulkInput}
            onChange={(e) => setParentBulkInput(e.target.value)}
            placeholder={"Nguyễn Văn A, bo@gmail.com;me@gmail.com\nTrần Thị B, mehocsinhb@gmail.com"}
          />
          {parentBulkErrors.length > 0 && (
            <ul className="text-xs text-danger-500 list-disc pl-4">
              {parentBulkErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {parentBulkResult && <p className="text-sm text-success-500">{parentBulkResult}</p>}
          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={parentBulkSubmitting}
              onClick={handleParentBulkUpdate}
            >
              {parentBulkSubmitting ? "Đang cập nhật…" : "Cập nhật email phụ huynh"}
            </button>
          </div>
        </div>
      )}

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

/** Form nhỏ sửa email học sinh/phụ huynh — dữ liệu dùng để gửi Báo cáo/campaign và cho phụ huynh đăng nhập. */
function StudentContactForm({
  student,
  onSave,
}: {
  student: Student;
  onSave: (contact: { studentEmail?: string; parentEmails: string[] }) => Promise<void>;
}) {
  const [studentEmail, setStudentEmail] = useState(student.studentEmail ?? "");
  const [parentEmailsText, setParentEmailsText] = useState((student.parentEmails ?? []).join(", "));
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
        <label className="block text-xs text-slate-500">
          Email phụ huynh (cách nhau bằng dấu phẩy nếu có nhiều)
        </label>
        <input
          className="input text-sm"
          placeholder="bo@gmail.com, me@gmail.com"
          value={parentEmailsText}
          onChange={(e) => setParentEmailsText(e.target.value)}
        />
      </div>
      <button
        className="btn-primary text-sm"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const parentEmails = parentEmailsText
              .split(/[,;]/)
              .map((e) => e.trim())
              .filter(Boolean);
            await onSave({ studentEmail, parentEmails });
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
