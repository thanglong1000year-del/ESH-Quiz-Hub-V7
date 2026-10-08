import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import LoginPage from "@/app/pages/LoginPage";
import OwnerDashboard from "@/app/pages/OwnerDashboard";
import TeacherDashboard from "@/app/pages/TeacherDashboard";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
      Đang tải…
    </div>
  );
}

function RoleRouter() {
  const { profile, loading } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (profile?.role === "owner") return <OwnerDashboard />;
  return <TeacherDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RoleRouter />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
