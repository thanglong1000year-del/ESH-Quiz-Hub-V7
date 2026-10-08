import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/client";
import type { PlatformConfig } from "@shared/types/core";

const DEFAULT_CONFIG: PlatformConfig = {
  archiveRetentionMonths: 6,
  defaultGradingScale: { max: 10 },
  defaultAssignmentDurationMinutes: 45,
  currentSchoolYear: "2027-2028",
};

/**
 * Cấu hình nền tảng do Owner quản lý (bao gồm `currentSchoolYear` — năm học
 * hiện hành mà mọi dữ liệu mới tạo ra sẽ gắn vào).
 */
export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(db, "platformConfig", "default"), (snap) => {
      setConfig(snap.exists() ? (snap.data() as PlatformConfig) : DEFAULT_CONFIG);
      setLoading(false);
    });
  }, []);

  return { config, loading };
}
