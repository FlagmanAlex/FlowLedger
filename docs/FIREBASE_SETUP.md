# Настройка Firebase

FlowLedger использует **один общий Firebase-проект** (Firestore + Firebase Auth) для всех
пользователей — изоляция данных между ними через поле `userId` и Security Rules
(`firestore.rules`), а не через отдельные проекты на покупателя (это архитектура, от которой
отказались — см. `.claude/archive/plans/` за историей).

## 1. Создание проекта в Firebase Console

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** →
   произвольное имя (например, `flowledger`).
2. **Build → Authentication → Get started → Sign-in method** → включить **Google**.
3. **Build → Firestore Database → Create database** → выбрать регион, **начать в production
   mode** (правила задеплоятся отдельно, см. ниже).
4. **Project settings → General → Your apps** → добавить **Web app** (даже если нужен только
   mobile — конфиг веб-приложения используется и клиентом, и Firebase JS SDK на мобильном).
   Скопировать `apiKey`/`authDomain`/`projectId`/`storageBucket`/`messagingSenderId`/`appId`.

Эти значения не секретны в привычном смысле (Firebase рассчитан на то, что конфиг веб-клиента
публичен — доступ реально ограничивают Security Rules), но всё равно передаются через `.env`/
`app.json`, а не хардкодятся, чтобы конфиг можно было менять без правки кода.

## 2. OAuth-клиент для Google Sign-In на mobile

Google Sign-In на web работает через `signInWithPopup` — дополнительной настройки не требует.
На mobile (Expo) нужен ID-токен от Google, для которого требуется **OAuth 2.0 Client ID типа
"Web application"** в [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
**того же проекта**, что и Firebase (Firebase создаёt такой автоматически при включении Google
Sign-In — найти его можно там же, в списке credentials, либо в Firebase Console → Authentication
→ Sign-in method → Google → Web SDK configuration). Это значение — `googleWebClientId` в
`mobile/app.json`.

Код входа (`mobile/src/screens/LoginScreen.tsx`, `expo-auth-session/providers/google`) не был
протестирован на реальном устройстве/эмуляторе в рамках миграции — после того как
`googleWebClientId` заполнен, нужна ручная проверка (`npx expo start`, вход через Google).

## 3. Переменные окружения

**client/** — скопировать `client/.env.example` в `client/.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**mobile/** — заполнить `mobile/app.json` → `expo.extra`:

```json
{
  "firebaseApiKey": "...",
  "firebaseAuthDomain": "...",
  "firebaseProjectId": "...",
  "firebaseStorageBucket": "...",
  "firebaseMessagingSenderId": "...",
  "firebaseAppId": "...",
  "googleWebClientId": "..."
}
```

## 4. Эмуляторы (локальная разработка)

```bash
npm run dev:emulators   # firestore:8080, auth:9099, UI на http://127.0.0.1:4000
npm run dev              # эмуляторы + client (5173) одновременно
```

Конфиг — `firebase.json`/`.firebaserc` в корне репозитория. `.firebaserc` содержит плейсхолдер
`"flowledger"` — заменить на реальный project ID (`firebase use --add`) перед деплоем в
продакшен-проект (для эмуляторов подходит и плейсхолдер).

## 5. Деплой Security Rules и индексов

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

Источник правды — `firestore.rules`/`firestore.indexes.json` в корне репозитория. Правила
проверяют владельца документа по `userId`, при этом клиент не может сам себе выставить
`plan: 'premium'` в `users/{uid}` — это поле рассчитано на изменение только доверенным бэкендом
(будущая интеграция Stripe/RevenueCat через Cloud Function/webhook с Admin SDK, который правила
Firestore не ограничивает).

## 6. Полезные ссылки

- [Firebase Console](https://console.firebase.google.com)
- [Firestore Security Rules reference](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase JS SDK — offline persistence в React Native](https://firebase.google.com/support/release-notes/js)
- [expo-auth-session — Google provider](https://docs.expo.dev/versions/latest/sdk/auth-session/)
