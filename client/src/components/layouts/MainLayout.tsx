import { Outlet, NavLink } from 'react-router-dom';
import { signOut, useAuth } from '@flowledger/shared';
import './MainLayout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/transactions', label: 'Журнал' },
  { to: '/wallets', label: 'Кошельки' },
  { to: '/categories', label: 'Категории' },
  { to: '/reports', label: 'Отчёты' },
  { to: '/settings', label: 'Настройки' },
];

export function MainLayout() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__badge">FL</div>
          <span className="sidebar__title">FlowLedger</span>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <button
            type="button"
            className="neo-button neo-button--sm sidebar__signout"
            onClick={() => signOut()}
          >
            Выйти
          </button>
        )}
      </aside>

      <main className="content">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
