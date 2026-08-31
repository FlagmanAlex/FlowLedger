import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@flowledger/shared';

/** Защищает все маршруты, требующие входа — редиректит на /login, пока
 *  Firebase Auth не подтвердит сессию. */
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
