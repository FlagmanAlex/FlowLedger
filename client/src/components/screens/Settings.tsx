import { useOutletContext } from 'react-router-dom';
import { signOut } from '@flowledger/shared';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { SharingSettings } from '@/components/ui/SharingSettings';
import { colorForId } from '@/lib/palette';
import { useTheme } from '@/lib/theme';
import './Settings.css';

export function Settings() {
  const { user, ownerId, isSharedAccess } = useOutletContext<MainOutletContext>();
  const { theme, setTheme } = useTheme();

  return (
    <div className="page">
      <h1 className="page__title">Настройки</h1>

      <section className="neo-card">
        <h2 className="section-title">Оформление</h2>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__item${theme === 'dark' ? ' is-active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            Тёмная
          </button>
          <button
            type="button"
            className={`segmented__item${theme === 'light' ? ' is-active' : ''}`}
            onClick={() => setTheme('light')}
          >
            Светлая
          </button>
        </div>
      </section>

      <section className="neo-card">
        <h2 className="section-title">Профиль</h2>
        <div className="profile-card">
          <IconCircle
            label={user?.displayName ?? user?.email ?? '?'}
            color={colorForId(user?.uid ?? '')}
            size={52}
            fontSize={20}
          />
          <div>
            <div className="profile-name">{user?.displayName ?? 'Без имени'}</div>
            <div className="profile-email">{user?.email}</div>
          </div>
        </div>
      </section>

      {user && ownerId && (
        <SharingSettings user={user} ownerId={ownerId} isSharedAccess={isSharedAccess} />
      )}

      <button type="button" className="neo-button" onClick={() => signOut()}>
        Выйти
      </button>
    </div>
  );
}
