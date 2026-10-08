import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { createHash } from "node:crypto";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Lớp kiểm tra tự động cơ bản cho câu hỏi giáo viên tự soạn (đã chốt
 * 2026-10-08): định dạng, đáp án hợp lệ, trùng lặp. Không cần Owner duyệt
 * tay — đây KHÔNG phải "zero-defect verifier" tập trung như V6.3.8, chỉ chặn
 * lỗi rõ ràng để học sinh không gặp câu hỏi hỏng.
 *
 * Trigger trên mọi write vào questionBank; ghi kết quả vào field `validation`
 * của chính document đó (không tạo vòng lặp vì ta chỉ set lại nếu có thay đổi).
 */
export const validateQuestion = onDocumentWritten(
  "subjects/{subjectId}/questionBank/{questionId}",
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return; // document bị xoá — không cần validate

    const data = after.data();
    if (!data) return;

    // Tránh vòng lặp: nếu write này chỉ là do chính function set lại `validation`
    // thì bỏ qua (so sánh timestamp đã check gần nhất vs updatedAt).
    if (data.validation?.checkedAt && data.validation.checkedAt === data.updatedAt) {
      return;
    }

    const issues: string[] = [];

    // 1. Kiểm tra định dạng cơ bản
    if (!data.prompt || typeof data.prompt !== "string" || data.prompt.trim().length < 5) {
      issues.push("Nội dung câu hỏi quá ngắn hoặc trống.");
    }

    if (data.type === "multiple_choice") {
      const options = Array.isArray(data.options) ? data.options : [];
      if (options.length < 2) {
        issues.push("Câu trắc nghiệm cần ít nhất 2 lựa chọn.");
      }
      const optionIds = new Set(options.map((o: { id?: string }) => o.id));
      const correctIds: string[] = Array.isArray(data.correctOptionIds)
        ? data.correctOptionIds
        : [];

      // 2. Kiểm tra đáp án hợp lệ
      if (correctIds.length === 0) {
        issues.push("Chưa chọn đáp án đúng.");
      }
      for (const id of correctIds) {
        if (!optionIds.has(id)) {
          issues.push(`Đáp án đúng "${id}" không khớp với lựa chọn nào đã nhập.`);
        }
      }
      const seenTexts = new Set<string>();
      for (const o of options) {
        const t = String(o.text ?? "").trim().toLowerCase();
        if (!t) issues.push("Có lựa chọn bị để trống.");
        if (seenTexts.has(t)) issues.push("Có 2 lựa chọn trùng nội dung nhau.");
        seenTexts.add(t);
      }
    }

    if (data.type === "essay" && (!data.prompt || data.prompt.trim().length < 10)) {
      issues.push("Câu tự luận cần đề bài rõ ràng (tối thiểu 10 ký tự).");
    }

    // 3. Kiểm tra trùng lặp trong cùng môn — dựa trên hash nội dung đã chuẩn hoá.
    const subjectId = event.params.subjectId as string;
    const questionId = event.params.questionId as string;
    const normalizedPrompt = String(data.prompt ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const promptHash = createHash("sha256").update(normalizedPrompt).digest("hex");

    const dupSnapshot = await db
      .collection("subjects")
      .doc(subjectId)
      .collection("questionBank")
      .where("promptHash", "==", promptHash)
      .get();

    const hasDuplicate = dupSnapshot.docs.some((d) => d.id !== questionId);
    if (hasDuplicate) {
      issues.push("Trùng nội dung với một câu hỏi khác đã có trong ngân hàng câu hỏi.");
    }

    const nowIso = new Date().toISOString();
    await after.ref.update({
      promptHash,
      validation: {
        status: issues.length === 0 ? "passed" : "failed",
        checkedAt: data.updatedAt ?? nowIso,
        issues,
      },
    });
  }
);
