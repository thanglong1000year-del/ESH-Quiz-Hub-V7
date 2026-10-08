import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/client";
import type { UserProfile } from "@shared/types/core";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Đổi user (hoặc đăng xuất) → huỷ lắng nghe hồ sơ cũ trước.
      unsubProfile?.();
      unsubProfile = null;

      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, user, loading: true }));

      // Lắng nghe hồ sơ /users/{uid} để lấy role — không dùng custom claims
      // nhằm tránh một lớp cấu hình nữa phải đồng bộ (bài học rules phức
      // tạp từ V6.3.8).
      unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        setState({
          user,
          profile: snap.exists() ? (snap.data() as UserProfile) : null,
          loading: false,
        });
      });
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook đi
// kèm Provider trong cùng file là pattern chuẩn của React Context, không
// phải lỗi; tắt cảnh báo fast-refresh vì --max-warnings 0 coi nó là lỗi CI.
export function useAuth() {
  return useContext(AuthContext);
}
