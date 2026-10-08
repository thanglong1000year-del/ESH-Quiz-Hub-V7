import type { Config } from "tailwindcss";

// Design system V7 — nền tảng, mọi môn học kế thừa chung bộ token này
// (đã chốt: "nâng cấp giao diện đẹp/chuyên nghiệp hơn V6.3.8", xây ngay từ
// Giai đoạn 0 để tránh phải restyle lại nhiều module như từng xảy ra).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#b3d1ff",
          300: "#80b3ff",
          400: "#4d8fff",
          500: "#2563eb", // primary
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        success: { 500: "#16a34a" },
        warning: { 500: "#d97706" },
        danger: { 500: "#dc2626" },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
