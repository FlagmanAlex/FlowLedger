import { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type UseAuthResult } from '@flowledger/shared';

const AuthContext = createContext<UseAuthResult>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthUser(): UseAuthResult {
  return useContext(AuthContext);
}
