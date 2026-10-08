import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import { usePlatformConfig } from "@shared/lib/platform";
import { subscribeStudents } from "@shared/lib/classes";
import {
  WRITTEN_SUBMISSION_MAX_WEEK,
  addWrittenWeek,
  removeWrittenWeek,
  subscribeWrittenSubmissions,
  subscribeWrittenWeeks,
  toggleWrittenSubmission,
} from "@shared/lib/written-submissions";
import type { Student, WrittenSubmission, WrittenWeek } from "@shared/types/core";

/**
 * Bài tập tự luận — chỉ tick học sinh đã nộp bài hay chưa theo từng tuần,
 * KHÔNG chấm điểm/viết nhận xét (mô hình kế thừa từ bản sửa lại ở V6.3.8).
 */
export default function WrittenSubmissionsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const { config } = usePlatformConfig();
  const subjectId = profile?.subjectId;

  const [students, setStudents] = useState<Student[]>([]);
  const [weeks, setWeeks] = useState<WrittenWeek[]>([]);
  const [submissions, setSubmissions] = useState<WrittenSubmission[]>([]);

  const [weekInput, setWeekInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [weekError, setWeekError] = useState("");
  const [savingWeek, setSavingWeek] = useState(false);
  const [togglingKey, setTogglingKey] = useState("");

  useEffect(() => {
    if (!subjectId || !classId) return;
    const unsubStudents = subscribeStudents(subjectId, classId, setStudents);
    const unsubWeeks = subscribeWrittenWeeks(subjectId, classId, setWeeks);
    const unsubSubmissions = subscribeWrittenSubmissions(subjectId, classId, setSubmissions);
    return () => {
      unsubStudents();
      unsubWeeks();
      unsubSubmissions();
    };
  }, [subjectId, classId]);

  const submissionByStudentId = useMemo(() => {
    const map = new Map<string, WrittenSubmission>();
    submissions.forEach((item) => map.set(item.studentId, item));
    return map;
  }, [submissions]);

  if (!subjectId || !classId) return null;

  async function handleAddWeek(event: FormEvent) {
    event.preventDefault();
    setWeekError("");

    const weekNumber = Number(weekInput);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > WRITTEN_SUBMISSION_MAX_WEEK) {
      setWeekError(`Tuần phải từ 1 đến ${WRITTEN_SUBMISSION_MAX_WEEK}.`);
      return;
    }

    setSavingWeek(true);
    try {
      await addWrittenWeek(subjectId!, classId!, config.currentSchoolYear, weekNumber, titleInput);
      setWeekInput("");
      setTitleInput("");
    } catch (caught) {
      setWeekError(caught instanceof Error ? caught.message : "Không thêm được tuần tự luận.");
    } finally {
      setSavingWeek(false);
    }
  }

  async function handleRemoveWeek(weekId: string) {
    await removeWrittenWeek(subjectId!, classId!, weekId);
  }

  async function handleToggle(student: Student, week: number, next: boolean) {
    const key = `${student.id}::${week}`;
    setTogglingKey(key);
    try {
      await toggleWrittenSubmission(subjectId!, classId!, config.currentSchoolYear, student, week, next);
    } finally {
      setTogglingKey("");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to={`/classes/${classId}`} className="text-sm text-brand-500 hover:underline">
        ← Về lớp học
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Bài tập tự luận</h1>
        <p className="text-sm text-slate-500 mt-1">
          Chỉ đánh dấu học sinh đã nộp bài tự luận theo từng tuần — không chấm điểm, không nhận xét.
        </p>
      </div>

      <div className="card mb-6 space-y-3">
        <h2 className="font-medium text-slate-900">Tuần có giao bài tự luận</h2>

        <form className="flex flex-wrap items-end gap-3" onSubmit={handleAddWeek}>
          <label className="text-sm">
            <span className="block text-slate-700 mb-1">Tuần (1–{WRITTEN_SUBMISSION_MAX_WEEK})</span>
            <input
              type="number"
              min={1}
              max={WRITTEN_SUBMISSION_MAX_WEEK}
              className="input w-24"
              value={weekInput}
              onChange={(e) => setWeekInput(e.target.value)}
            />
          </label>
          <label className="text-sm flex-1 min-w-[180px]">
            <span className="block text-slate-700 mb-1">Tiêu đề (tuỳ chọn)</span>
            <input
              type="text"
              className="input"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Ví dụ: Tự luận chương 2"
            />
          </label>
          <button className="btn-primary" type="submit" disabled={savingWeek}>
            {savingWeek ? "Đang lưu…" : "Thêm tuần"}
          </button>
        </form>

        {weekError && <p className="text-sm text-danger-500">{weekError}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {weeks.map((w) => (
            <span
              key={w.id}
              className="inline-flex items-center gap-1 text-xs bg-surface-100 border border-surface-200 rounded-full px-3 py-1"
            >
              Tuần {w.week}
              {w.title ? ` · ${w.title}` : ""}
              <button
                type="button"
                className="text-danger-500 hover:underline ml-1"
                onClick={() => handleRemoveWeek(w.id)}
                aria-label={`Xoá tuần ${w.week}`}
              >
                ×
              </button>
            </span>
          ))}
          {weeks.length === 0 && (
            <p className="text-sm text-slate-500">Lớp này chưa có tuần tự luận nào.</p>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-medium text-slate-900 mb-3">Bảng nộp bài tự luận</h2>

        {students.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Lớp chưa có học sinh nào.</p>
        ) : weeks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Hãy thêm tuần tự luận ở trên trước.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">Học sinh</th>
                {weeks.map((w) => (
                  <th key={w.id} className="py-2 px-2 text-center font-medium whitespace-nowrap">
                    Tuần {w.week}
                    {w.title && (
                      <>
                        <br />
                        <span className="text-xs font-normal text-slate-400">{w.title}</span>
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const record = submissionByStudentId.get(student.id);
                return (
                  <tr key={student.id} className="border-t border-surface-200">
                    <td className="py-2 pr-3 text-slate-900 whitespace-nowrap">{student.fullName}</td>
                    {weeks.map((w) => {
                      const key = `${student.id}::${w.week}`;
                      const checked = Boolean(record?.weeks?.[String(w.week)]);
                      return (
                        <td key={w.id} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${student.fullName} nộp bài tuần ${w.week}`}
                            checked={checked}
                            disabled={togglingKey === key}
                            onChange={(e) => handleToggle(student, w.week, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
