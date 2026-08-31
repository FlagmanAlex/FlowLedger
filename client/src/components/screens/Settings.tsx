import { useOutletContext } from 'react-router-dom';
import { signOut, type UseAuthResult } from '@flowledger/shared';
import { IconCircle } from '@/components/ui/IconCircle';
import { colorForId } from '@/lib/palette';
import './Settings.css';

export function Settings() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();

  return (
    <div className="page">
      <h1 className="page__title">Настройки</h1>

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

      <button type="button" className="neo-button" onClick={() => signOut()}>
        Выйти
      </button>
    </div>
  );
}
