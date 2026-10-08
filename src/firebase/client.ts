import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Bài học từ V6.3.8: `src/firebase-client.ts` luôn nối thẳng Firestore
// production, không có chế độ emulator cho `vite dev` — không thể test UI an
// toàn trên dữ liệu giả. V7 SỬA LỖI NÀY: mặc định dev luôn dùng Emulator Suite
// trừ khi biến môi trường VITE_USE_PRODUCTION_FIREBASE=true được set tường minh.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

const useEmulator =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_PRODUCTION_FIREBASE !== "true";

if (useEmulator) {
  // Idempotent guard: Vite HMR có thể chạy module này nhiều lần.
  const g = globalThis as unknown as { __ESH_EMULATORS_CONNECTED__?: boolean };
  if (!g.__ESH_EMULATORS_CONNECTED__) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    g.__ESH_EMULATORS_CONNECTED__ = true;
    // eslint-disable-next-line no-console
    console.info(
      "[ESH Quiz Hub V7] Đang dùng Firebase Emulator Suite (dev an toàn, không đụng dữ liệu thật)."
    );
  }
} else if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[ESH Quiz Hub V7] CẢNH BÁO: đang nối THẲNG Firebase production từ môi trường dev " +
      "(VITE_USE_PRODUCTION_FIREBASE=true). Chỉ dùng khi thực sự cần thiết."
  );
}
