# FlowLedger — Tasks (активные)

Закрытые задачи и подзадачи — см. `.claude/archive/tasks/`.

Теги в квадратных скобках — какого(-их) workspace'а(-ов) касается пункт; у каждого workspace
свой `CLAUDE.md` (`client/`, `mobile/`, `shared/`, `interfaces/`, `control-plane/`), который
ссылается сюда же по тегу, а не дублирует текст.

## BYO-Firebase продукт — открытые пункты
Базовая реализация закрыта — см. `.claude/archive/tasks/byo-firebase-core.md` и план темы
`.claude/plans/02-byo-firebase.md`.

- [ ] 10. `[mobile]` Полноценный native Google Sign-In с elevated scope для
      mobile-провижининга — см. `.claude/memory.md` → Известные TODO / ограничения
- [ ] 11. `[control-plane]` Google Cloud Console: OAuth consent screen, заявка на верификацию
      scope `cloud-platform`/`firebase` (внешний процесс, недели ожидания)
- [ ] 12. `[control-plane]` Сквозная проверка на реальном Firebase-проекте (см.
      `.claude/plans/02-byo-firebase.md` → Верификация) — требует реального Google Cloud
      аккаунта, не выполнено ни в одной сессии

## Не реализовано / следующие шаги
- [ ] `[mobile]` Native Google Sign-In для mobile (см. пункт 10 выше)
- [ ] `[control-plane]` Security Rules unit-тесты (`@firebase/rules-unit-testing`) для
      `templates/customer-project/`
- [ ] `[interfaces, shared, client, mobile]` Бюджеты по категориям — сперва тип в `interfaces`,
      затем repository/hook в `shared`, затем UI в `client`/`mobile`
- [ ] `[interfaces, shared, client, mobile]` Регулярные операции (scheduled — но без Cloud
      Functions в проекте покупателя нужно решение)
- [ ] `[client, mobile]` Экспорт CSV/Excel
- [ ] `[mobile, shared]` Push-уведомления (FCM)
- [ ] `[interfaces, shared, client, mobile]` Вложения к операциям (Firebase Storage)
