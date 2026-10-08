/**
 * Kiểu dữ liệu lõi — dùng chung cho mọi môn học.
 *
 * QUAN TRỌNG: không có trường/kiểu nào ở đây được khoá cứng theo 1 môn cụ thể
 * (so với `math6-question-bank.tsx` / `curriculum-structure.ts` của V6.3.8,
 * vốn gắn chặt với chương trình Toán KNTT). Mọi thứ đặc thù theo môn nằm
 * trong `src/subjects/{subjectId}/` dưới dạng cấu hình dữ liệu, không phải code.
 */

export type Role = "owner" | "teacher";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** Chỉ có ý nghĩa khi role === "teacher". Hiện tại 1 giáo viên sở hữu đúng 1 môn. */
  subjectId?: string;
  createdAt: string; // ISO timestamp
}

export interface PlatformConfig {
  /** Số tháng giữ bản lưu trữ archive trước khi xoá vĩnh viễn. Mặc định 6. */
  archiveRetentionMonths: number;
  defaultGradingScale: {
    max: number; // ví dụ 10
  };
  defaultAssignmentDurationMinutes: number;
  currentSchoolYear: string; // ví dụ "2027-2028" — Owner cập nhật khi mở năm học mới
}

export interface Subject {
  id: string;
  name: string; // ví dụ "Sinh học 10", "Lịch sử 11"
  slug: string;
  ownerTeacherId: string;
  status: "active" | "archived";
  createdAt: string;
}

export type QuestionType = "multiple_choice" | "essay";

export interface ValidationResult {
  status: "pending" | "passed" | "failed";
  checkedAt?: string;
  issues: string[]; // ví dụ ["Đáp án đúng không khớp option nào", "Trùng với câu hỏi #abc123"]
}

export interface QuestionBase {
  id: string;
  subjectId: string;
  createdBy: string; // uid giáo viên
  type: QuestionType;
  prompt: string;
  tags: string[];
  validation: ValidationResult;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // thùng rác (soft delete) — giữ nguyên tính năng từ V6.3.8
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: "multiple_choice";
  options: { id: string; text: string }[];
  correctOptionIds: string[]; // hỗ trợ cả single & multi-answer
}

export interface EssayQuestion extends QuestionBase {
  type: "essay";
  rubric?: string;
}

export type Question = MultipleChoiceQuestion | EssayQuestion;

export interface SchoolYearScoped {
  subjectId: string;
  schoolYear: string; // ví dụ "2027-2028"
}

export interface ClassRoom extends SchoolYearScoped {
  id: string;
  name: string;
  createdAt: string;
}

export interface Student extends SchoolYearScoped {
  id: string;
  classId: string;
  fullName: string;
  studentCode?: string;
}

export type AssignmentStatus = "draft" | "published" | "closed";

export interface Assignment extends SchoolYearScoped {
  id: string;
  classId: string;
  title: string;
  questionIds: string[];
  /** Bản sao câu hỏi đã lược bỏ đáp án đúng — an toàn để học sinh đọc. */
  questionsSnapshot: unknown[];
  durationMinutes: number;
  openAt: string;
  closeAt: string;
  status: AssignmentStatus;
  createdAt: string;
}

export interface Submission extends SchoolYearScoped {
  id: string;
  assignmentId: string;
  classId: string;
  /** Học sinh không có tài khoản Firebase Auth đầy đủ — lưu tên tự nhập. */
  studentName: string;
  answers: Record<string, string[] | string>;
  score: number | null;
  maxScore: number;
  submittedAt: string;
}

/**
 * "Bài tập tự luận" — mô hình V7 kế thừa trực tiếp từ bản sửa lại ở V6.3.8:
 * giáo viên KHÔNG chấm điểm/viết nhận xét câu tự luận, chỉ tick học sinh đã
 * nộp bài hay chưa theo từng tuần (tối đa 34 tuần/năm học). Đây là tính năng
 * độc lập với Đề bài trắc nghiệm (`Assignment`/`Submission`) — không liên
 * quan tới câu hỏi tự luận trong ngân hàng câu hỏi.
 */
export const WRITTEN_SUBMISSION_MAX_WEEK = 34;

export interface WrittenWeek extends SchoolYearScoped {
  id: string;
  classId: string;
  week: number; // 1..WRITTEN_SUBMISSION_MAX_WEEK
  title?: string;
  createdAt: string;
}

export interface WrittenSubmission extends SchoolYearScoped {
  /** Trùng với studentId — mỗi học sinh đúng 1 document/lớp. */
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  /** key = số tuần dạng chuỗi (ví dụ "5"), value = true nếu đã nộp. */
  weeks: Record<string, boolean>;
  updatedAt: string;
}

export interface AttendanceRecord extends SchoolYearScoped {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD
  presentStudentIds: string[];
  absentStudentIds: string[];
}
