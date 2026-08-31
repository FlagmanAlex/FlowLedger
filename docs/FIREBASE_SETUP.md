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

## 2. OAuth-клиенты для Google Sign-In на mobile

Google Sign-In на web работает через `signInWithPopup` — дополнительной настройки не требует.

На mobile (Expo, `expo-auth-session/providers/google`) нужен ID-токен от Google, а на нативных
платформах (iOS/Android, в отличие от web) `expo-auth-session` требует **отдельный,
platform-specific OAuth 2.0 Client ID** — одного `googleWebClientId` недостаточно, без
`iosClientId`/`androidClientId` вызов падает с `Client Id property ... must be defined` уже при
рендере экрана логина. Нужно завести три клиента в
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) **того же проекта**,
что и Firebase:

- **Web application** — создаётся автоматически при включении Google Sign-In в Firebase
  (Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration) →
  `googleWebClientId`.
- **iOS** — bundle ID `com.flowledger.mobile` (см. `mobile/app.json` → `expo.ios.bundleIdentifier`)
  → `googleIosClientId`.
- **Android** — package `com.flowledger.mobile` (см. `mobile/app.json` → `expo.android.package`)
  + SHA-1 отпечаток keystore, которым подписывается сборка (для локальной разработки — debug
  keystore, `keytool -list -v -keystore ~/.android/debug.keystore`) → `googleAndroidClientId`.

Код входа (`mobile/src/screens/LoginScreen.tsx`) не был протестирован на реальном
устройстве/эмуляторе в рамках миграции — после того как все три `google*ClientId` заполнены,
нужна ручная проверка (`npx expo start`, вход через Google).

Проверить перед тестом отдельно: `expo-auth-session`'s Google-провайдер сейчас не значится в
основном гайде Expo по Google-аутентификации (актуальный гайд рекомендует
`@react-native-google-signin/google-signin`, что требует custom native code и dev build вместо
Expo Go) — если после заведения трёх клиентов реальный вход всё равно не заработает в Expo Go,
это ожидаемо повод для миграции на другую библиотеку, а не баг в текущем коде.

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
  "googleWebClientId": "...",
  "googleIosClientId": "...",
  "googleAndroidClientId": "..."
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
