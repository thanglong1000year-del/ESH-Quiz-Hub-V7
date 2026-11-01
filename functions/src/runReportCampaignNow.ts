import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { runReportCampaign } from "./reportCampaign.js";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

interface RunNowInput {
  subjectId: string;
  classId: string;
  campaignId: string;
}

/**
 * Admin bấm "Gửi ngay" trên `ReportCampaignsPage` — chạy chiến dịch lập tức
 * thay vì chờ `scheduledReportCampaignRun`. Dùng chung logic với bản tự động
 * (`runReportCampaign`) để không lệch hành vi giữa 2 đường chạy.
 */
export const runReportCampaignNow = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");

    const { subjectId, classId, campaignId } = request.data as RunNowInput;
    if (!subjectId || !classId || !campaignId) {
      throw new HttpsError("invalid-argument", "Thiếu subjectId, classId hoặc campaignId.");
    }

    const callerSnap = await db.collection("users").doc(uid).get();
    const caller = callerSnap.data();
    const isOwner = caller?.role === "owner";
    const isSubjectAdmin =
      caller?.role === "teacher" && caller?.teacherRole === "admin" && caller?.subjectId === subjectId;

    if (!isOwner && !isSubjectAdmin) {
      throw new HttpsError("permission-denied", "Chỉ giáo viên admin của môn này mới gửi được báo cáo.");
    }

    try {
      const result = await runReportCampaign(db, { subjectId, classId, campaignId });
      return result;
    } catch (caught) {
      throw new HttpsError("internal", caught instanceof Error ? caught.message : "Không chạy được chiến dịch.");
    }
  }
);
