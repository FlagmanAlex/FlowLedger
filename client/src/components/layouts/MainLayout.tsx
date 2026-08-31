import { Outlet, Link } from 'react-router-dom';
import { signOut, useAuth } from '@flowledger/shared';

export function MainLayout() {
  const { user } = useAuth();

  return (
    <div>
      <nav>
        <Link to="/">Дашборд</Link>
        <Link to="/transactions">Журнал операций</Link>
        <Link to="/wallets">Кошельки</Link>
        <Link to="/categories">Категории</Link>
        <Link to="/reports">Отчёты</Link>
        <Link to="/settings">Настройки</Link>
        {user && <button type="button" onClick={() => signOut()}>Выйти</button>}
      </nav>
      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
