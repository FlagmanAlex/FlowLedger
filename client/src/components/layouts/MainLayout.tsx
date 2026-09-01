import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { signOut, useAuth, useOwnerId, type UseAuthResult } from '@flowledger/shared';
import './MainLayout.css';

/** Контекст, который экраны внутри MainLayout читают через useOutletContext.
 *  ownerId — чья база сейчас активна (своя или база владельца, к которой
 *  дан общий доступ по приглашению) — именно им, а не user.uid, нужно
 *  скоупить все запросы к wallets/categories/transactions. */
export interface MainOutletContext {
  user: UseAuthResult['user'];
  ownerId: string | undefined;
  isSharedAccess: boolean;
}

const NAV_ITEMS = [
  { to: '/transactions', label: 'Журнал' },
  { to: '/wallets', label: 'Кошельки' },
  { to: '/categories', label: 'Категории' },
  { to: '/reports', label: 'Отчёты' },
  { to: '/settings', label: 'Настройки' },
];

export function MainLayout() {
  const { user } = useAuth();
  const { ownerId, isSharedAccess } = useOwnerId(user);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/" className="sidebar__brand" onClick={() => setIsMenuOpen(false)}>
          <div className="sidebar__badge">FL</div>
          <span className="sidebar__title">FlowLedger</span>
        </Link>

        <button
          type="button"
          className="topbar__menu-toggle"
          aria-label="Открыть меню"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {isMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)} />
      )}

      <aside className={`sidebar${isMenuOpen ? ' is-open' : ''}`}>
        <Link to="/" className="sidebar__brand" onClick={() => setIsMenuOpen(false)}>
          <div className="sidebar__badge">FL</div>
          <span className="sidebar__title">FlowLedger</span>
        </Link>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
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
        <Outlet context={{ user, ownerId, isSharedAccess }} />
      </main>
    </div>
  );
}
