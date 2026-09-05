# План: экран «Долги» (займы физлицам/банкам)

## Контекст
Идея пользователя (2026-09-05): отдельный экран учёта долгов — когда пользователь даёт в долг или
берёт в долг, контрагент может быть как частным лицом, так и банком. Заводится по аналогии с
кошельками (владелец/holder, валюта). Решения по модели (уточнено у пользователя):
- Долг **обязательно** привязан к кошельку — сумма движется по балансу этого кошелька как обычная
  операция (а не отдельный учёт в стороне от балансов).
- Частичное погашение фиксируется через общий журнал транзакций (не отдельная под-коллекция
  платежей).
- Первый этап — простая модель: без процентов и графика платежей.

## Модель данных

### `interfaces/src/debt.interface.ts` (новый файл)
```ts
export type DebtDirection = 'lent' | 'borrowed'; // lent — я дал в долг, borrowed — я взял в долг
export type DebtCounterpartyType = 'person' | 'bank';
export type DebtStatus = 'active' | 'closed';

export interface Debt {
  id: string;
  userId: string;              // владелец базы (workspace), как и в остальных коллекциях
  walletId: string;            // кошелёк, к которому привязан долг — валюта долга = валюта кошелька
  direction: DebtDirection;
  counterpartyType: DebtCounterpartyType;
  counterpartyName: string;    // имя человека или название банка
  principal: number;           // исходная сумма долга
  remainingAmount: number;     // текущий остаток — обновляется атомарно вместе с балансом кошелька
  dueDate?: string;
  status: DebtStatus;          // 'closed' проставляется автоматически при remainingAmount === 0
  createdBy: string;           // фактический автор (см. Transaction.createdBy)
  createdAt: string;
}
```
Валюта отдельным полем не хранится — берётся из `Wallet.currency` привязанного `walletId` (как и у
обычных транзакций), чтобы не рассинхронизироваться.

### Расширение `interfaces/src/transaction.interface.ts`
```ts
export type TransactionType =
  | 'income' | 'expense' | 'transfer'
  | 'debt_lend'      // выдача займа: деньги уходят из walletId, создаёт/пополняет Debt(direction='lent')
  | 'debt_borrow'    // получение займа: деньги приходят в walletId, создаёт/пополняет Debt(direction='borrowed')
  | 'debt_repayment'; // погашение — направление эффекта на баланс зависит от Debt.direction

// + новое поле:
debtId?: string; // только для debt_lend / debt_borrow / debt_repayment
```
Знак движения по кошельку для `debt_repayment` определяется через связанный `Debt.direction`:
- `lent` + repayment → нам возвращают деньги → баланс кошелька растёт, `remainingAmount` падает.
- `borrowed` + repayment → мы отдаём деньги → баланс кошелька падает, `remainingAmount` падает.

`debt_lend`/`debt_borrow` — операции создания долга (аналог первого перевода): `debt_lend` списывает
`principal` с кошелька, `debt_borrow` зачисляет `principal` на кошелёк.

## Атомарность (баланс кошелька + остаток долга)
По аналогии с `shared/src/repositories/transactions.repo.ts` (там `runTransaction` + `increment()`
без Cloud Functions, т.к. остаёмся на бесплатном Spark-плане) — при create/update/delete транзакций
с `debtId` в той же `runTransaction`:
1. считать дельту баланса кошелька (как для остальных типов);
2. считать дельту `remainingAmount` соответствующего `Debt`;
3. если `remainingAmount` дошёл до 0 — выставить `status: 'closed'` (и обратно в `'active'`, если
   операцию отредактировали/удалили и остаток снова не ноль).

## Firestore
- Новая top-level коллекция `debts`, конвертер и `debtsCollection()` в
  `shared/src/repositories/collections.ts` — по образцу `walletsCollection()`.
- `shared/src/repositories/debts.repo.ts` — простой CRUD (`listDebts(userId)`, `createDebt`,
  `updateDebt`, `archiveDebt`/`deleteDebt`) по образцу `wallets.repo.ts`/`holders.repo.ts`, плюс
  логика в `transactions.repo.ts` для операций с `debtId` (см. выше).
- `shared/src/hooks/useDebts.ts` — react-query, `queryKey: ['debts', userId]`, hook принимает
  `userId: string | undefined` (общий паттерн проекта).
- `firestore.rules` — блок для `debts`, идентичный существующим (`hasAccess(resource.data.userId)` /
  `hasAccess(request.resource.data.userId)`, запрет смены `userId` на update) — как у
  `wallets`/`categories`/`transactions`/`recurringTemplates`.
- Все repo/hooks работают через `ownerId` (не `user.uid`), чтобы сразу быть совместимыми с общим
  доступом (family sharing, `activeOwnerId`/`hasAccess`).

## Client UI
- `client/src/components/screens/Debts.tsx` — список долгов, группировка по статусу
  (активные/погашенные) и/или по `direction` (дал/взял), карточка: контрагент, сумма/остаток,
  прогресс погашения (`.progress-track`/`.progress-fill` из примитивов), дата возврата если задана.
  По образцу `Wallets.tsx` (свайп-действия, `ReorderableList` не обязателен — сортировка по дате).
- `client/src/components/ui/DebtModal.tsx` — создание долга: направление (dan/взял — segmented
  control), тип контрагента (person/bank — chips), имя контрагента, кошелёк (`WalletPicker`),
  сумма, опционально дата возврата. По образцу `WalletModal.tsx`.
- Погашение — отдельная лёгкая форма/модалка (сумма погашения ≤ остатка) поверх карточки долга,
  создающая транзакцию `debt_repayment`, по образцу `TransferModal.tsx`.
- Пункт `NAV_ITEMS` в `MainLayout.tsx` + маршрут `debts` в `App.tsx`.
- Операции долга (`debt_lend`/`debt_borrow`/`debt_repayment`) также должны корректно отображаться в
  общем журнале (`Transactions`/Journal) — как минимум с понятной подписью (контрагент вместо
  категории).

## Mobile
Откладывается до переноса дизайн-системы на `mobile/` (см. `web-design-system.md`, пункт
«`[mobile]` Перенос того же дизайна в Expo/RN» в `tasks.md`) — `shared`-слой общий, отдельной
реализации логики не потребуется, только UI на RN.

## Открытые вопросы (не блокируют старт)
- Нужен ли отдельный экран/фильтр «долги, срок которых подходит» (по `dueDate`) — не решено, не
  первый этап.
- Проценты/график платежей — осознанно не в первой версии (см. Контекст).
