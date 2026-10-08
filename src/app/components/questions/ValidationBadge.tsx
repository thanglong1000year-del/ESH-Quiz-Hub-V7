import type { ValidationResult } from "@shared/types/core";

export default function ValidationBadge({ validation }: { validation: ValidationResult }) {
  const styles: Record<ValidationResult["status"], string> = {
    passed: "bg-success-500/10 text-success-500",
    failed: "bg-danger-500/10 text-danger-500",
    pending: "bg-warning-500/10 text-warning-500",
  };
  const labels: Record<ValidationResult["status"], string> = {
    passed: "Hợp lệ",
    failed: "Có lỗi",
    pending: "Đang kiểm tra…",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[validation.status]}`}>
      {labels[validation.status]}
    </span>
  );
}
