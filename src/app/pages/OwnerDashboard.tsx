import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase/client";
import type { Subject } from "@shared/types/core";
import CreateSubjectDialog from "@/app/components/CreateSubjectDialog";

/**
 * Trang Owner: tạo môn học mới, xem danh sách môn đã có.
 * Mỗi môn là một không gian dữ liệu độc lập — Owner chỉ thấy metadata
 * (tên, ai sở hữu, trạng thái), không đi sâu vào nội dung từng môn
 * (ngân hàng câu hỏi, lớp học...) từ trang này.
 */
export default function OwnerDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "subjects"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subject));
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Các môn học</h1>
          <p className="text-sm text-slate-500">
            Mỗi môn là một không gian dữ liệu độc lập, cô lập hoàn toàn với các môn khác.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setDialogOpen(true)}>
          + Tạo môn học mới
        </button>
      </div>

      <div className="grid gap-3">
        {subjects.map((s) => (
          <div key={s.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{s.name}</p>
              <p className="text-sm text-slate-500">Giáo viên sở hữu: {s.ownerTeacherId}</p>
            </div>
            <span
              className={
                "text-xs px-2 py-1 rounded-full " +
                (s.status === "active"
                  ? "bg-success-500/10 text-success-500"
                  : "bg-slate-200 text-slate-600")
              }
            >
              {s.status === "active" ? "Đang hoạt động" : "Đã lưu trữ"}
            </span>
          </div>
        ))}
        {subjects.length === 0 && (
          <p className="text-sm text-slate-500">Chưa có môn học nào. Tạo môn đầu tiên để bắt đầu.</p>
        )}
      </div>

      {dialogOpen && <CreateSubjectDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
