import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@shared/lib/auth-context";
import LoginPage from "@/app/pages/LoginPage";
import OwnerDashboard from "@/app/pages/OwnerDashboard";
import TeacherDashboard from "@/app/pages/TeacherDashboard";
import QuestionBankPage from "@/app/pages/teacher/QuestionBankPage";
import ClassesPage from "@/app/pages/teacher/ClassesPage";
import ClassDetailPage from "@/app/pages/teacher/ClassDetailPage";
import AssignmentsPage from "@/app/pages/teacher/AssignmentsPage";
import AssignmentResultsPage from "@/app/pages/teacher/AssignmentResultsPage";
import TakeAssignmentPage from "@/app/pages/student/TakeAssignmentPage";

function RequireAuth({ children }: { children: ReactNode }) {
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
        {/* Công khai — học sinh làm bài, không cần tài khoản giáo viên/owner. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/take/:subjectId/:assignmentId" element={<TakeAssignmentPage />} />

        {/* Cần đăng nhập (Owner hoặc Teacher). */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <RoleRouter />
            </RequireAuth>
          }
        />
        <Route
          path="/questions"
          element={
            <RequireAuth>
              <QuestionBankPage />
            </RequireAuth>
          }
        />
        <Route
          path="/classes"
          element={
            <RequireAuth>
              <ClassesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/classes/:classId"
          element={
            <RequireAuth>
              <ClassDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/classes/:classId/assignments"
          element={
            <RequireAuth>
              <AssignmentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/assignments/:assignmentId/results"
          element={
            <RequireAuth>
              <AssignmentResultsPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
