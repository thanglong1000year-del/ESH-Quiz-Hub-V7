import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/client";
import { useAuth } from "@shared/lib/auth-context";
import { fetchChildProgress, type ChildProgress } from "@shared/lib/parent-auth";
import type { ParentChildRef } from "@shared/types/core";
import StudentProgressView from "@/app/components/parent/StudentProgressView";

export default function ParentDashboardPage() {
  const { profile, loading } = useAuth();
  const children = profile?.role === "parent" ? profile.children ?? [] : [];
  const [manualSelection, setManualSelection] = useState<ParentChildRef | null>(null);
  const selected = manualSelection ?? children[0] ?? null;
  const [data, setData] = useState<ChildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setData(null);
    setError(null);
    fetchChildProgress(selected)
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được tiến độ học tập.")
      );
  }, [selected]);

  if (loading) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center text-slate-400 text-sm">Đang tải…</div>;
  }

  if (profile?.role !== "parent") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-danger-500">Tài khoản này không phải tài khoản phụ huynh.</p>
        <button className="btn-secondary text-sm" onClick={() => signOut(auth)}>
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Tiến độ học tập</h1>
        <button className="text-sm text-slate-500 hover:underline" onClick={() => signOut(auth)}>
          Đăng xuất
        </button>
      </div>

      {children.length === 0 && (
        <div className="card">
          <p className="text-sm text-slate-700">
            Chưa tìm thấy học sinh nào dùng email <strong>{profile.email}</strong> làm email phụ
            huynh. Liên hệ giáo viên bộ môn của con để được thêm email này vào danh sách lớp, sau
            đó đăng xuất rồi đăng nhập lại.
          </p>
        </div>
      )}

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.studentId}
              className={
                "text-sm px-3 py-1.5 rounded-md border " +
                (selected?.studentId === c.studentId
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-surface-0 border-surface-200 text-slate-700")
              }
              onClick={() => setManualSelection(c)}
            >
              {c.studentName}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger-500">{error}</p>}
      {selected && !data && !error && (
        <p className="text-sm text-slate-400 text-center py-8">Đang tải…</p>
      )}
      {data && <StudentProgressView data={data} />}
    </div>
  );
}
