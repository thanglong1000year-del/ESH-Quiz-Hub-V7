/**
 * Kiểu dữ liệu lõi — dùng chung cho mọi môn học.
 *
 * QUAN TRỌNG: không có trường/kiểu nào ở đây được khoá cứng theo 1 môn cụ thể
 * (so với `math6-question-bank.tsx` / `curriculum-structure.ts` của V6.3.8,
 * vốn gắn chặt với chương trình Toán KNTT). Mọi thứ đặc thù theo môn nằm
 * trong `src/subjects/{subjectId}/` dưới dạng cấu hình dữ liệu, không phải code.
 */

export type Role = "owner" | "teacher" | "parent";

/**
 * Vai trò của giáo viên TRONG môn (chỉ có ý nghĩa khi role === "teacher"):
 * - "admin": giáo viên sở hữu môn (tạo bởi Owner) — toàn quyền: ngân hàng câu
 *   hỏi, lớp học, đề bài, mời thêm giáo viên khác vào môn mình.
 * - "viewer": giáo viên được admin mời — chỉ xem (không sửa) đúng 1 lớp được
 *   gán: danh sách học sinh, đề trắc nghiệm (xem + làm thử không ghi nhận
 *   kết quả), kết quả/tiến độ nộp bài (trắc nghiệm + tự luận theo tuần).
 *   Đăng nhập bằng tài khoản Gmail cá nhân (Google Sign-In), không có mật
 *   khẩu riêng do app cấp.
 */
export type TeacherRole = "admin" | "viewer";

/**
 * Một học sinh (con) mà phụ huynh xem được — khớp bằng email đã xác thực
 * với `parentEmail` trên document học sinh (xem Cloud Function
 * `syncParentProfile`). Chỉ lưu tên hiển thị để vẽ danh sách, KHÔNG lưu số
 * liệu điểm/tiến độ — số liệu luôn đọc lại qua `getChildProgressForParent`
 * để không bao giờ bị lệch với dữ liệu thật.
 */
export interface ParentChildRef {
  subjectId: string;
  classId: string;
  studentId: string;
  studentName: string;
  className: string;
  subjectName: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** Chỉ có ý nghĩa khi role === "teacher". Hiện tại 1 giáo viên sở hữu đúng 1 môn. */
  subjectId?: string;
  /** Chỉ có ý nghĩa khi role === "teacher". */
  teacherRole?: TeacherRole;
  /** Chỉ có ý nghĩa khi teacherRole === "viewer" — đúng 1 lớp được xem. */
  viewerClassId?: string;
  /** Chỉ có ý nghĩa khi role === "parent" — làm mới mỗi lần đăng nhập qua `syncParentProfile`. */
  children?: ParentChildRef[];
  createdAt: string; // ISO timestamp
}

/**
 * Lời mời giáo viên xem-lớp (viewer) — admin của môn tạo trực tiếp từ client
 * (xem firestore.rules: chỉ admin của đúng subjectId mới tạo được). Giáo viên
 * được mời đăng nhập bằng Gmail cá nhân; Cloud Function `claimTeacherInvite`
 * (Admin SDK) sẽ tìm đúng document này theo email đã xác thực của họ và tạo
 * `/users/{uid}` tương ứng — xem docs/DATA_MODEL.md mục "Mời giáo viên xem lớp".
 *
 * Doc id = email đã chuẩn hoá (lowercase, trim) — mỗi email chỉ có 1 lời mời
 * đang hoạt động tại một thời điểm.
 */
export interface TeacherInvite {
  id: string; // = email chuẩn hoá
  email: string;
  subjectId: string;
  classId: string;
  invitedBy: string; // uid của admin đã mời
  status: "pending" | "accepted";
  acceptedUid?: string;
  /** Tên hiển thị Google của người đã nhận lời mời — để admin xem mà không cần đọc /users/{uid} chéo. */
  acceptedDisplayName?: string;
  acceptedAt?: string;
  createdAt: string;
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
  /** Tuỳ chọn — cần ít nhất 1 email (học sinh hoặc phụ huynh) để nhận báo cáo (xem ReportCampaign). */
  studentEmail?: string;
  /**
   * Nhiều phụ huynh/người giám hộ có thể cùng xem 1 học sinh (ví dụ cả bố
   * và mẹ) — mỗi email đăng nhập đúng tài khoản của mình (xem
   * `syncParentProfile`), không chia sẻ 1 tài khoản chung. 1 phụ huynh có
   * nhiều con thì dùng CÙNG 1 email này cho mỗi con — đăng nhập 1 lần thấy
   * hết các con khớp email.
   */
  parentEmails?: string[];
  /** Mã bí mật trong link "Theo dõi tiến độ" gửi phụ huynh — đổi mã = thu hồi link cũ. */
  viewToken?: string;
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

/**
 * Báo cáo/campaign — nhắc giờ gửi báo cáo tiến độ (điểm trắc nghiệm trung
 * bình + tỉ lệ nộp bài tự luận theo tuần) cho học sinh/phụ huynh. Tính năng
 * lớn còn thiếu so với V6.3.8 (`report-campaign-*`), viết lại cho kiến trúc
 * đa môn — xem `functions/src/reportCampaign.ts`.
 *
 * Bài học từ lỗi V6.3.8: KHÔNG được đánh fail toàn bộ chiến dịch chỉ vì 1-2
 * học sinh thiếu email — chỉ học sinh đó bị bỏ qua (`skippedStudentIds`); và
 * `lastError` PHẢI hiển thị rõ trên UI (V6.3.8 ghi vào Firestore nhưng không
 * bao giờ hiện ra, khiến giáo viên không biết lý do thất bại thật).
 */
export type ReportRecipientMode = "student" | "parent" | "both";
export type ReportCampaignStatus = "scheduled" | "running" | "sent" | "failed";

export interface ReportCampaign extends SchoolYearScoped {
  id: string;
  classId: string;
  title: string;
  recipientMode: ReportRecipientMode;
  /** ISO — thời điểm chiến dịch sẽ tự chạy (scheduledReportCampaignRun quét mỗi 15 phút). */
  scheduledAt: string;
  status: ReportCampaignStatus;
  /** Lý do thất bại THẬT, luôn hiển thị trên UI — không được âm thầm ghi vào Firestore rồi thôi. */
  lastError?: string | null;
  lastRunAt?: string;
  targetCount?: number;
  sentCount?: number;
  skippedStudentIds?: string[];
  createdAt: string;
}
