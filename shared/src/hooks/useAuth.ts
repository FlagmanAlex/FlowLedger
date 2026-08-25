import { useEffect, useState } from 'react';
import type { AuthUser } from '@flowledger/interfaces';
import { subscribeToCustomerAuthUser } from '../firebase/auth.js';

export interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
}

/**
 * Tracks sign-in state against the currently connected CUSTOMER project
 * (see shared/src/firebase/customer.ts) — this is the workspace the user
 * is actually working in (their own, or one they joined), not the
 * control-plane identity used only during provisioning/onboarding.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCustomerAuthUser((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
