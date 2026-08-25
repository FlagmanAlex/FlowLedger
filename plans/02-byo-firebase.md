# План: продукт с BYO-Firebase на клиента

Статус: базовая реализация выполнена, см. `tasks.md`. Полный план и обоснование архитектуры — см.
историю сессии; сюда вынесена выжимка для будущей навигации.

## Суть пивота
Продукт продаётся клиентам, каждый из которых подключает СВОЙ Firebase-проект — изоляция данных
физическая (отдельные базы), а не логическая (`tenantId`). Вендор поддерживает только тонкий
`control-plane/` для провижининга; сам продукт (Firestore+Auth в проекте покупателя) не требует
Cloud Functions и укладывается в бесплатный план Firebase Spark.

## Ключевые компоненты
- `control-plane/` — вендорский Firebase-проект + Cloud Function `createCustomerProject`
  (оркестрация Google Cloud Management API от имени покупателя)
- `templates/customer-project/` — источник правды для Rules/Indexes, деплоятся программно в новый
  проект покупателя
- `shared/src/firebase/{controlPlane,customer}.ts` — два раздельных Firebase App instance
- Приглашение участников — peer-to-peer через ссылку с закодированным `firebaseConfig`, без
  control-plane и без Cloud Functions в проекте покупателя (Security Rules проверяют email из
  Google-токена)

## Не выполнено в этой сессии (нет доступа к реальному Google Cloud/Firebase аккаунту)
- Реальный деплой `control-plane` в Firebase
- Настройка OAuth consent screen + заявка на верификацию scope `cloud-platform`
- Сквозной e2e прогон provisioning flow с реальным Google-аккаунтом
- Native Google Sign-In с elevated scope на mobile

См. `memory.md` за подробным списком TODO и архитектурных заметок.
