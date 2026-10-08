import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./firebase/client";
import { AuthProvider } from "@shared/lib/auth-context";
import App from "@/app/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
