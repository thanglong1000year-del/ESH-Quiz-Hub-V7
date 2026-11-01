/**
 * Báo cáo/campaign — xem `functions/src/reportCampaign.ts` cho logic chạy
 * thật (Admin SDK). Phía client chỉ tạo/đọc/xoá cấu hình chiến dịch và gọi
 * callable `runReportCampaignNow` để chạy ngay.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/client";
import type { ReportCampaign, ReportRecipientMode } from "@shared/types/core";

function campaignsRef(subjectId: string, classId: string) {
  return collection(db, "subjects", subjectId, "classes", classId, "reportCampaigns");
}

export function subscribeReportCampaigns(
  subjectId: string,
  classId: string,
  onChange: (campaigns: ReportCampaign[]) => void
): Unsubscribe {
  const q = query(campaignsRef(subjectId, classId), orderBy("scheduledAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReportCampaign));
  });
}

export async function createReportCampaign(
  subjectId: string,
  classId: string,
  schoolYear: string,
  input: { title: string; recipientMode: ReportRecipientMode; scheduledAt: string }
) {
  await addDoc(campaignsRef(subjectId, classId), {
    subjectId,
    schoolYear,
    classId,
    title: input.title,
    recipientMode: input.recipientMode,
    scheduledAt: input.scheduledAt,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  });
}

export async function deleteReportCampaign(subjectId: string, classId: string, campaignId: string) {
  await deleteDoc(doc(db, "subjects", subjectId, "classes", classId, "reportCampaigns", campaignId));
}

interface RunNowResult {
  ok: boolean;
  sentCount: number;
  skippedStudentIds: string[];
  targetCount: number;
}

export async function runReportCampaignNow(subjectId: string, classId: string, campaignId: string) {
  const call = httpsCallable<{ subjectId: string; classId: string; campaignId: string }, RunNowResult>(
    functions,
    "runReportCampaignNow"
  );
  const result = await call({ subjectId, classId, campaignId });
  return result.data;
}
