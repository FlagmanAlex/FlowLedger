import { useState } from 'react';
import {
  useCreateInvite,
  useInviteLink,
  useLeaveSharedAccess,
  useMembers,
  usePendingInvites,
  useRemoveMember,
  useRevokeInvite,
  useUserDoc,
  type UseAuthResult,
} from '@flowledger/shared';
import { IconCircle } from '@/components/ui/IconCircle';
import { colorForId } from '@/lib/palette';
import './SharingSettings.css';

interface SharingSettingsProps {
  user: NonNullable<UseAuthResult['user']>;
  ownerId: string;
  isSharedAccess: boolean;
}

/** Настройки общего доступа к базе (Settings → «Общий доступ»). Владелец
 *  видит участников и может выпустить/отозвать ссылку-приглашение;
 *  участник, использующий чужую базу, видит только кнопку выхода из
 *  общего доступа. */
export function SharingSettings({ user, ownerId, isSharedAccess }: SharingSettingsProps) {
  if (isSharedAccess) {
    return <LeaveSharedAccessCard user={user} ownerId={ownerId} />;
  }
  return <OwnerSharingCard user={user} ownerId={ownerId} />;
}

function LeaveSharedAccessCard({ user, ownerId }: { user: NonNullable<UseAuthResult['user']>; ownerId: string }) {
  const { data: owner } = useUserDoc(ownerId);
  const leave = useLeaveSharedAccess();

  return (
    <section className="neo-card">
      <h2 className="section-title">Общий доступ</h2>
      <p className="sharing-hint">
        Вы используете общую базу {owner ? <strong>{owner.displayName || owner.email}</strong> : 'другого пользователя'}.
      </p>
      <button
        type="button"
        className="neo-button"
        disabled={leave.isPending}
        onClick={() => leave.mutate({ ownerId, memberUid: user.uid })}
      >
        {leave.isPending ? 'Выходим...' : 'Покинуть общий доступ'}
      </button>
    </section>
  );
}

function OwnerSharingCard({ user, ownerId }: { user: NonNullable<UseAuthResult['user']>; ownerId: string }) {
  const { data: members } = useMembers(ownerId);
  const { data: pendingInvites } = usePendingInvites(ownerId);
  const createInvite = useCreateInvite(ownerId, user.displayName || user.email);
  const revokeInvite = useRevokeInvite(ownerId);
  const removeMember = useRemoveMember(ownerId);

  const activeInvite = pendingInvites?.[0];
  const inviteLink = useInviteLink(activeInvite?.id);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="neo-card">
      <h2 className="section-title">Общий доступ</h2>
      <p className="sharing-hint">
        Пригласите близких (например, жену или мужа) — они увидят и смогут вести те же кошельки,
        категории и операции, что и вы.
      </p>

      {members && members.length > 0 && (
        <div className="sharing-members">
          {members.map((m) => (
            <div key={m.uid} className="list-row">
              <IconCircle label={m.displayName || m.email} color={colorForId(m.uid)} size={36} />
              <div className="list-row__main">
                <div className="list-row__title">{m.displayName || 'Без имени'}</div>
                <div className="list-row__subtitle">{m.email}</div>
              </div>
              <button
                type="button"
                className="neo-button neo-button--sm"
                onClick={() => removeMember.mutate(m.uid)}
                disabled={removeMember.isPending}
              >
                Отозвать
              </button>
            </div>
          ))}
        </div>
      )}

      {activeInvite && inviteLink ? (
        <div className="invite-link-box">
          <input className="neo-input" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
          <div className="invite-link-actions">
            <button type="button" className="neo-button neo-button--sm" onClick={handleCopy}>
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              type="button"
              className="neo-button neo-button--sm"
              onClick={() => revokeInvite.mutate(activeInvite.id)}
              disabled={revokeInvite.isPending}
            >
              Отозвать ссылку
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="neo-button neo-button--accent"
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? 'Создаём ссылку...' : 'Создать ссылку-приглашение'}
        </button>
      )}
    </section>
  );
}
