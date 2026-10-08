import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import { createClass, subscribeClasses } from "@shared/lib/classes";
import type { ClassRoom } from "@shared/types/core";

export default function ClassesPage() {
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;
  const schoolYear = config.currentSchoolYear;

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    return subscribeClasses(subjectId, schoolYear, setClasses);
  }, [subjectId, schoolYear]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!subjectId || !name.trim()) return;
    setSubmitting(true);
    try {
      await createClass(subjectId, schoolYear, name.trim());
      setName("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!subjectId) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/" className="text-sm text-brand-500 hover:underline">
        ← Về trang môn học
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Lớp học</h1>
        <p className="text-sm text-slate-500">Năm học hiện hành: {schoolYear}</p>
      </div>

      <form onSubmit={handleCreate} className="card flex gap-2 mb-6">
        <input
          className="input flex-1"
          placeholder="Tên lớp, ví dụ: 10A1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={submitting} className="btn-primary whitespace-nowrap">
          + Tạo lớp
        </button>
      </form>

      <div className="grid sm:grid-cols-2 gap-3">
        {classes.map((c) => (
          <Link
            key={c.id}
            to={`/classes/${c.id}`}
            className="card hover:border-brand-300 transition-colors"
          >
            <p className="font-medium text-slate-900">{c.name}</p>
            <p className="text-sm text-slate-500">Xem danh sách học sinh →</p>
          </Link>
        ))}
        {classes.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2 text-center py-8">
            Chưa có lớp nào trong năm học {schoolYear}. Tạo lớp đầu tiên ở trên.
          </p>
        )}
      </div>
    </div>
  );
}
