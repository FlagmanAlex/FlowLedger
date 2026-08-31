import { useOutletContext } from 'react-router-dom';
import type { UseAuthResult } from '@flowledger/shared';

export function Settings() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();

  return (
    <div>
      <h1>Настройки</h1>

      <section>
        <h2>Профиль</h2>
        <p>{user?.displayName} ({user?.email})</p>
      </section>
    </div>
  );
}
