import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const YEAR_SCOPED_COLLECTIONS = ["classes", "assignments", "submissions", "attendance"];

/**
 * Quy trình đóng năm học (đã chốt trong kế hoạch kiến trúc):
 *   1. [Chưa cài đặt ở đây] Xuất báo cáo tổng kết PDF/Excel — xem Giai đoạn 4 (báo cáo/campaign).
 *   2. Archive: copy toàn bộ dữ liệu `schoolYear` cũ vào
 *      `subjects/{subjectId}/archives/{schoolYear}` (snapshot, immutable).
 *   3. Xoá dữ liệu year-scoped gốc SAU KHI đã archive thành công.
 *   4. Dữ liệu bền vững (questionBank, curriculum, users) không bị đụng tới.
 *
 * Archive giữ read-only trong `platformConfig.archiveRetentionMonths` tháng
 * (mặc định 6) trước khi một job dọn dẹp định kỳ xoá vĩnh viễn — xem
 * `scheduledArchivePurge.ts`.
 *
 * Chỉ Owner được gọi — kiểm tra role qua Firestore, không qua custom claims
 * để tránh một lớp cấu hình nữa phải đồng bộ thủ công (bài học từ rules phức
 * tạp của V6.3.8).
 */
export const rolloverSchoolYear = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");

    const callerProfile = await db.collection("users").doc(uid).get();
    if (callerProfile.data()?.role !== "owner") {
      throw new HttpsError("permission-denied", "Chỉ Owner được đóng năm học.");
    }

    const { subjectId, schoolYear } = request.data as {
      subjectId?: string;
      schoolYear?: string;
    };
    if (!subjectId || !schoolYear) {
      throw new HttpsError("invalid-argument", "Thiếu subjectId hoặc schoolYear.");
    }

    const subjectRef = db.collection("subjects").doc(subjectId);
    const archiveRef = subjectRef.collection("archives").doc(schoolYear);

    if ((await archiveRef.get()).exists) {
      throw new HttpsError(
        "already-exists",
        `Năm học ${schoolYear} của môn này đã được đóng trước đó.`
      );
    }

    // Bước 2: Archive — gom dữ liệu year-scoped thành 1 snapshot.
    const snapshot: Record<string, unknown[]> = {};
    for (const col of YEAR_SCOPED_COLLECTIONS) {
      const docs = await subjectRef
        .collection(col)
        .where("schoolYear", "==", schoolYear)
        .get();
      snapshot[col] = docs.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const configSnap = await db.collection("platformConfig").doc("default").get();
    const retentionMonths = (configSnap.data()?.archiveRetentionMonths as number) ?? 6;
    const purgeAt = Timestamp.fromMillis(
      Date.now() + retentionMonths * 30 * 24 * 60 * 60 * 1000
    );

    await archiveRef.set({
      schoolYear,
      subjectId,
      createdAt: new Date().toISOString(),
      createdBy: uid,
      purgeAt,
      data: snapshot,
    });

    // Bước 3: Xoá dữ liệu gốc year-scoped (chỉ sau khi archive đã ghi thành công).
    const batchDeletes: Promise<unknown>[] = [];
    for (const col of YEAR_SCOPED_COLLECTIONS) {
      const docs = await subjectRef
        .collection(col)
        .where("schoolYear", "==", schoolYear)
        .get();
      for (const d of docs.docs) {
        batchDeletes.push(d.ref.delete());
      }
    }
    await Promise.all(batchDeletes);

    return {
      ok: true,
      archivedCounts: Object.fromEntries(
        Object.entries(snapshot).map(([k, v]) => [k, v.length])
      ),
      purgeAt: purgeAt.toDate().toISOString(),
    };
  }
);
