/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Необязательно: свой Web OAuth client id (по умолчанию — flowledger2). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
