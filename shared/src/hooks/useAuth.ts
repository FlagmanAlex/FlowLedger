import { useEffect, useState } from 'react';
import type { AuthUser } from '@flowledger/interfaces';
import { subscribeToAuthUser } from '../firebase/auth.js';

export interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthUser((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
