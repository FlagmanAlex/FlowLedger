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

### `interfaces/src/debt.interface.ts` + `interfaces/src/counterparty.interface.ts`
```ts
export type DebtDirection = 'lent' | 'borrowed'; // lent — я дал в долг, borrowed — я взял в долг
export type DebtStatus = 'active' | 'closed';

export interface Debt {
  id: string;
  userId: string;              // владелец базы (workspace), как и в остальных коллекциях
  walletId: string;            // кошелёк, к которому привязан долг — валюта долга = валюта кошелька
  direction: DebtDirection;
  counterpartyId: string;      // ссылка на Counterparty — как holderId у Wallet
  principal: number;           // исходная сумма долга
  remainingAmount: number;     // текущий остаток — обновляется атомарно вместе с балансом кошелька
  dueDate?: string;
  status: DebtStatus;          // 'closed' проставляется автоматически при remainingAmount === 0
  createdBy: string;           // фактический автор (см. Transaction.createdBy)
  createdAt: string;
}

// counterparty.interface.ts — отдельная сущность, по образцу Holder у кошельков
export interface Counterparty {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: string;
}
```
Валюта отдельным полем не хранится — берётся из `Wallet.currency` привязанного `walletId` (как и у
обычных транзакций), чтобы не рассинхронизироваться.

**Изменено 2026-09-05 (по фидбеку пользователя):** первая версия хранила `counterpartyName: string`
+ `counterpartyType: 'person'|'bank'` прямо на `Debt`, со свободным текстовым полем и чипами
банк/физлицо в форме. Это разошлось с исходной постановкой задачи — контрагент должен быть
**отдельной коллекцией** с пикером и инлайн-добавлением прямо в форме, тем же паттерном, что
`Holder`/`Currency` у кошельков (чипы существующих + «+ Добавить» с текстовым полем на месте, без
перехода на отдельный экран). Переделано: `Counterparty` — новая top-level коллекция
(`counterpartiesCollection()`, `counterparties.repo.ts`, `useCounterparties.ts`, блок в
`firestore.rules` — всё по образцу `holders.repo.ts`), `Debt.counterpartyId` — ссылка на неё вместо
хранения имени внутри самого долга. Разделение банк/физлицо убрано целиком (`DebtCounterpartyType`
не существует) — оно ни на что не влияло, кроме иконки, и было лишним шагом в форме.

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
- `client/src/components/ui/DebtModal.tsx` — создание долга: направление (дал/взял — segmented
  control), контрагент (чипы `Counterparty` + инлайн «+ Добавить», как владелец/валюта в
  `WalletModal.tsx`), кошелёк (`WalletPicker`), сумма, опционально дата возврата.
- Погашение — отдельная лёгкая форма/модалка (сумма погашения ≤ остатка) поверх карточки долга,
  создающая транзакцию `debt_repayment`, по образцу `TransferModal.tsx`.
- Пункт `NAV_ITEMS` в `MainLayout.tsx` + маршрут `debts` в `App.tsx`.
- Операции долга (`debt_lend`/`debt_borrow`/`debt_repayment`) также должны корректно отображаться в
  общем журнале (`Transactions`/Journal) — как минимум с понятной подписью (контрагент вместо
  категории).
- **Редактирование после создания** (добавлено 2026-09-05, по фидбеку пользователя — изначально
  редактируемыми были только контрагент/тип/срок, что оказалось слишком узко): сумма/кошелёк/дата/
  описание правятся через открывающую операцию (`useDebtOpeningTransaction` находит её по
  `debtId` среди связанных транзакций, `updateDebtOpening` в `debts.repo.ts` вызывает обычный
  `updateTransaction` — тот уже атомарно пересчитывает и баланс кошелька, и `Debt.remainingAmount`
  по дельте by amount — плюс отдельно сдвигает `Debt.principal` на ту же дельту, чтобы прогресс-бар
  остался осмысленным). Guard: новая сумма не может быть меньше уже погашенной части
  (`principal - remainingAmount`), иначе `remainingAmount` ушёл бы в минус. Направление
  (`lent`/`borrowed`) после создания принципиально не редактируется — оно определяет знак
  движения кошелька у каждого уже сделанного погашения (снимок `debtDirection` на транзакции), и
  просто поменять поле на `Debt` эти знаки бы не развернуло; для такой (редкой) правки — удалить
  долг и завести заново, а не чинить задним числом.

## Mobile
Откладывается до переноса дизайн-системы на `mobile/` (см. `web-design-system.md`, пункт
«`[mobile]` Перенос того же дизайна в Expo/RN» в `tasks.md`) — `shared`-слой общий, отдельной
реализации логики не потребуется, только UI на RN.

## Открытые вопросы (не блокируют старт)
- Нужен ли отдельный экран/фильтр «долги, срок которых подходит» (по `dueDate`) — не решено, не
  первый этап.
- Проценты/график платежей — осознанно не в первой версии (см. Контекст).
