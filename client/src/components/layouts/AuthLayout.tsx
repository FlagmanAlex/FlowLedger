import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@flowledger/shared';

/**
 * Wraps every protected route. While the onUserCreate Cloud Function is
 * still provisioning a brand-new user's tenant, useAuth briefly reports a
 * signed-in Firebase user but no tenant claim yet — show a spinner instead
 * of bouncing them back to /login.
 */
export function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Загрузка...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={{ user }} />;
}
