import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@flowledger/shared';

/**
 * Wraps every route that needs an active CUSTOMER project connection
 * (see shared/src/firebase/customer.ts). A brand-new user lands here only
 * after ConnectingScreen has provisioned/connected their project and
 * signed them in there — if that hasn't happened yet, bounce to /login to
 * restart the flow rather than showing a broken app shell.
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
