import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// V7 chạy qua Firestore Emulator khi `npm run dev:full` (xem docs/DEV_SETUP.md).
// Không bao giờ nối thẳng Firestore production từ `vite dev` — bài học từ V6.3.8.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@subjects": path.resolve(__dirname, "./src/subjects"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  server: {
    port: 5173,
  },
});
