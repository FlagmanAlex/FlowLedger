interface QueryErrorProps {
  error: unknown;
  /** Что именно не удалось загрузить — подставляется в сообщение. */
  label: string;
}

/** Единообразный показ ошибки запроса вместо бесконечной загрузки/пустого
 *  экрана — на мобильном нет доступа к devtools, поэтому текст ошибки
 *  Firestore (permission-denied, resource-exhausted, unavailable и т.п.)
 *  должен быть виден прямо в интерфейсе. */
export function QueryError({ error, label }: QueryErrorProps) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className="state-message" role="alert">
      {label}: {message}
    </p>
  );
}
