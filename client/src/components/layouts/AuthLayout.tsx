import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@flowledger/shared';

/** Защищает все маршруты, требующие входа — редиректит на /login, пока
 *  Firebase Auth не подтвердит сессию. Текущий путь передаётся в state,
 *  чтобы Login мог вернуть пользователя обратно (нужно для ссылки-
 *  приглашения /invite/:id — иначе она терялась бы при незалогиненном
 *  переходе по ней). */
export function AuthLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="auth-loading">Загрузка...</p>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user }} />;
}
