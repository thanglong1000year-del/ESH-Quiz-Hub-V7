import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import { addStudentsBulk, removeStudent, subscribeStudents } from "@shared/lib/classes";
import type { Student } from "@shared/types/core";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;

  const [students, setStudents] = useState<Student[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!subjectId || !classId) return;
    return subscribeStudents(subjectId, classId, setStudents);
  }, [subjectId, classId]);

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/classes" className="text-sm text-brand-500 hover:underline">
        ← Về danh sách lớp
      </Link>

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

      <div className="space-y-1">
        {students.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-surface-0 border border-surface-200 rounded-md px-3 py-2"
          >
            <span className="text-slate-900">{s.fullName}</span>
            <button
              className="text-sm text-danger-500 hover:underline"
              onClick={() => removeStudent(subjectId, classId, s.id)}
            >
              Xoá
            </button>
          </div>
        ))}
        {students.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Lớp chưa có học sinh nào.</p>
        )}
      </div>
    </div>
  );
}
