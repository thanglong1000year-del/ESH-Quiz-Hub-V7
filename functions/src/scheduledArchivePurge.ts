import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Dọn dẹp archive đã hết hạn lưu trữ (purgeAt < now) — xoá vĩnh viễn.
 * Chạy hàng ngày. Đây là bước cuối của vòng đời dữ liệu theo năm học.
 */
export const scheduledArchivePurge = onSchedule(
  { schedule: "every day 03:00", timeZone: "Asia/Ho_Chi_Minh", region: "asia-southeast1" },
  async () => {
    const now = Timestamp.now();
    const expired = await db
      .collectionGroup("archives")
      .where("purgeAt", "<=", now)
      .get();

    for (const doc of expired.docs) {
      await doc.ref.delete();
    }

    console.log(`[scheduledArchivePurge] Đã xoá ${expired.size} archive hết hạn.`);
  }
);
