import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { runReportCampaign } from "./reportCampaign.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Quét mọi chiến dịch báo cáo "scheduled" đã tới giờ chạy (`scheduledAt`),
 * ở mọi môn/lớp cùng lúc (`collectionGroup`). Chạy mỗi 15 phút — đủ sát giờ
 * đặt mà không cần cron chính xác tới phút.
 *
 * Một chiến dịch lỗi không chặn các chiến dịch khác — mỗi `runReportCampaign`
 * tự bắt lỗi của riêng nó (xem reportCampaign.ts).
 */
export const scheduledReportCampaignRun = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Asia/Ho_Chi_Minh", region: "asia-southeast1" },
  async () => {
    const now = Timestamp.now().toDate().toISOString();
    const due = await db
      .collectionGroup("reportCampaigns")
      .where("status", "==", "scheduled")
      .where("scheduledAt", "<=", now)
      .get();

    for (const doc of due.docs) {
      const data = doc.data() as { subjectId: string; classId: string };
      try {
        await runReportCampaign(db, {
          subjectId: data.subjectId,
          classId: data.classId,
          campaignId: doc.id,
        });
      } catch (caught) {
        console.error(`[scheduledReportCampaignRun] Chiến dịch ${doc.id} lỗi:`, caught);
      }
    }

    console.log(`[scheduledReportCampaignRun] Đã xử lý ${due.size} chiến dịch đến giờ chạy.`);
  }
);
