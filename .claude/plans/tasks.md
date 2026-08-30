# FlowLedger — Tasks (активные)

Закрытые задачи и подзадачи — см. `.claude/archive/tasks/`.

## BYO-Firebase продукт — открытые пункты
Базовая реализация закрыта — см. `.claude/archive/tasks/byo-firebase-core.md` и план темы
`.claude/plans/02-byo-firebase.md`.

- [ ] 10. Полноценный native Google Sign-In с elevated scope для mobile-провижининга — см.
      `.claude/memory.md` → Известные TODO / ограничения
- [ ] 11. Google Cloud Console: OAuth consent screen, заявка на верификацию scope
      `cloud-platform`/`firebase` (внешний процесс, недели ожидания)
- [ ] 12. Сквозная проверка на реальном Firebase-проекте (см. `.claude/plans/02-byo-firebase.md` →
      Верификация) — требует реального Google Cloud аккаунта, не выполнено ни в одной сессии

## Не реализовано / следующие шаги
- [ ] Native Google Sign-In для mobile (см. пункт 10 выше)
- [ ] Security Rules unit-тесты (`@firebase/rules-unit-testing`)
- [ ] Бюджеты по категориям
- [ ] Регулярные операции (scheduled — но без Cloud Functions в проекте покупателя нужно решение)
- [ ] Экспорт CSV/Excel
- [ ] Push-уведомления (FCM)
- [ ] Вложения к операциям (Firebase Storage)
