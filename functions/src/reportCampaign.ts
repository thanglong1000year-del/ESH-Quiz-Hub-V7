import type { Firestore } from "firebase-admin/firestore";
import { computeStudentProgress } from "./studentProgress.js";

/**
 * Logic lõi chạy 1 chiến dịch báo cáo — dùng chung giữa callable
 * `runReportCampaignNow` (admin bấm "Gửi ngay") và `scheduledReportCampaignRun`
 * (tự quét theo `scheduledAt`). Ghi mail vào collection `mail` theo đúng quy
 * ước của Firebase Extension "Trigger Email" (Owner cần tự cài extension này
 * trên project Firebase thật — xem README).
 *
 * Hai bài học rút ra từ lỗi thật của V6.3.8 (`reportCampaignRunBlockingError`):
 * 1. KHÔNG đánh fail toàn bộ chiến dịch chỉ vì 1 vài học sinh thiếu email —
 *    chỉ bỏ qua đúng những học sinh đó (`skippedStudentIds`), vẫn gửi cho
 *    những em còn lại.
 * 2. `lastError` phải là lý do THẬT và luôn hiển thị trên UI (xem
 *    `ReportCampaignsPage.tsx`) — V6.3.8 có ghi field này vào Firestore
 *    nhưng UI chưa bao giờ hiện ra, khiến giáo viên không biết vì sao fail.
 *
 * Hạn chế đã biết: bài làm trắc nghiệm (`submissions`) chỉ lưu `studentName`
 * (chuỗi tự nhập khi làm bài ẩn danh), không có `studentId` — nên điểm trung
 * bình ở đây khớp theo TÊN, giống cách `AssignmentResultsPage` đang hiển thị.
 * Hai học sinh trùng tên trong 1 lớp sẽ bị gộp điểm — chấp nhận được ở quy mô
 * 1 lớp, nhưng nên biết trước khi đọc báo cáo.
 */

export interface RunReportCampaignParams {
  subjectId: string;
  classId: string;
  campaignId: string;
}

export interface RunReportCampaignResult {
  ok: boolean;
  sentCount: number;
  skippedStudentIds: string[];
  targetCount: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildReportHtml(input: {
  studentName: string;
  campaignTitle: string;
  avgScore: number | null;
  submissionCount: number;
  submittedWeeks: number;
  totalWeeks: number;
}) {
  const scoreLine =
    input.avgScore != null
      ? `Điểm trung bình trắc nghiệm: <strong>${input.avgScore.toFixed(1)}/10</strong> (${input.submissionCount} bài đã làm).`
      : `Chưa có bài trắc nghiệm nào được ghi nhận.`;
  const writtenLine =
    input.totalWeeks > 0
      ? `Bài tập tự luận: đã nộp <strong>${input.submittedWeeks}/${input.totalWeeks}</strong> tuần được giao.`
      : `Lớp chưa khai báo tuần giao bài tự luận nào.`;

  return `
    <div style="font-family:sans-serif;line-height:1.6;color:#1e293b">
      <h2 style="margin:0 0 8px">${escapeHtml(input.campaignTitle)}</h2>
      <p>Báo cáo tiến độ học tập của <strong>${escapeHtml(input.studentName)}</strong>:</p>
      <ul>
        <li>${scoreLine}</li>
        <li>${writtenLine}</li>
      </ul>
    </div>
  `.trim();
}

export async function runReportCampaign(
  db: Firestore,
  { subjectId, classId, campaignId }: RunReportCampaignParams
): Promise<RunReportCampaignResult> {
  const campaignRef = db
    .collection("subjects")
    .doc(subjectId)
    .collection("classes")
    .doc(classId)
    .collection("reportCampaigns")
    .doc(campaignId);

  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) {
    throw new Error("Không tìm thấy chiến dịch báo cáo.");
  }
  const campaign = campaignSnap.data()!;

  await campaignRef.update({ status: "running" });

  try {
    const [studentsSnap, submissionsSnap, writtenSnap] = await Promise.all([
      db.collection("subjects").doc(subjectId).collection("classes").doc(classId).collection("students").get(),
      db
        .collection("subjects")
        .doc(subjectId)
        .collection("submissions")
        .where("classId", "==", classId)
        .get(),
      db
        .collection("subjects")
        .doc(subjectId)
        .collection("classes")
        .doc(classId)
        .collection("writtenSubmissions")
        .get(),
    ]);

    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & {
      id: string;
      fullName: string;
      studentEmail?: string;
      parentEmail?: string;
    });

    if (students.length === 0) {
      await campaignRef.update({
        status: "failed",
        lastError: "Lớp chưa có học sinh nào — không có ai để gửi báo cáo.",
        lastRunAt: new Date().toISOString(),
        targetCount: 0,
        sentCount: 0,
        skippedStudentIds: [],
      });
      return { ok: false, sentCount: 0, skippedStudentIds: [], targetCount: 0 };
    }

    const submissionsByName = new Map<string, { score: number | null }[]>();
    submissionsSnap.docs.forEach((d) => {
      const s = d.data() as { studentName: string; score: number | null };
      const list = submissionsByName.get(s.studentName) ?? [];
      list.push({ score: s.score });
      submissionsByName.set(s.studentName, list);
    });

    const writtenByStudentId = new Map(
      writtenSnap.docs.map((d) => [d.id, d.data() as { weeks?: Record<string, boolean> }])
    );

    const skipped: string[] = [];
    const mailWrites: Promise<unknown>[] = [];
    let sentCount = 0;

    for (const student of students) {
      const recipients: string[] = [];
      if ((campaign.recipientMode === "student" || campaign.recipientMode === "both") && student.studentEmail) {
        recipients.push(student.studentEmail);
      }
      if ((campaign.recipientMode === "parent" || campaign.recipientMode === "both") && student.parentEmail) {
        recipients.push(student.parentEmail);
      }

      if (recipients.length === 0) {
        skipped.push(student.id);
        continue;
      }

      const progress = computeStudentProgress(
        (submissionsByName.get(student.fullName) ?? []).map((s) => s.score),
        writtenByStudentId.get(student.id)?.weeks ?? {}
      );

      const html = buildReportHtml({
        studentName: student.fullName,
        campaignTitle: campaign.title,
        ...progress,
      });

      mailWrites.push(
        db.collection("mail").add({
          to: recipients,
          message: {
            subject: `Báo cáo tiến độ — ${student.fullName}`,
            html,
          },
        })
      );
      sentCount += 1;
    }

    await Promise.all(mailWrites);

    if (sentCount === 0) {
      const lastError = `Không học sinh nào có email phù hợp với hình thức gửi "${campaign.recipientMode}" — toàn bộ ${students.length} học sinh bị bỏ qua. Kiểm tra lại email học sinh/phụ huynh trong danh sách lớp.`;
      await campaignRef.update({
        status: "failed",
        lastError,
        lastRunAt: new Date().toISOString(),
        targetCount: students.length,
        sentCount: 0,
        skippedStudentIds: skipped,
      });
      return { ok: false, sentCount: 0, skippedStudentIds: skipped, targetCount: students.length };
    }

    await campaignRef.update({
      status: "sent",
      lastError: null,
      lastRunAt: new Date().toISOString(),
      targetCount: students.length,
      sentCount,
      skippedStudentIds: skipped,
    });

    return { ok: true, sentCount, skippedStudentIds: skipped, targetCount: students.length };
  } catch (caught) {
    const lastError = caught instanceof Error ? caught.message : "Lỗi không xác định khi chạy chiến dịch.";
    await campaignRef.update({
      status: "failed",
      lastError,
      lastRunAt: new Date().toISOString(),
    });
    throw caught;
  }
}
