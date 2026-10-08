import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/client";

/**
 * Chỉ Owner tạo môn học mới (đã chốt trong kế hoạch kiến trúc).
 * Lưu ý: việc tạo tài khoản giáo viên sở hữu môn này vẫn là bước riêng
 * (Owner tạo tài khoản + gán subjectId) — form này chỉ tạo khung môn học.
 */
export default function CreateSubjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [ownerTeacherId, setOwnerTeacherId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !ownerTeacherId.trim()) {
      setError("Vui lòng nhập đầy đủ tên môn và UID giáo viên sở hữu.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "subjects"), {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
        ownerTeacherId: ownerTeacherId.trim(),
        status: "active",
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError("Không tạo được môn học. Thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Tạo môn học mới</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên môn học
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Sinh học 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              UID giáo viên sở hữu
            </label>
            <input
              className="input"
              value={ownerTeacherId}
              onChange={(e) => setOwnerTeacherId(e.target.value)}
              placeholder="UID từ Firebase Authentication"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tạo tài khoản giáo viên trước ở Firebase Authentication, rồi dán UID vào đây.
            </p>
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Đang tạo…" : "Tạo môn học"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
