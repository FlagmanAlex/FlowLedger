import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callGoogleApi } from './googleApiClient.js';
import { isGoogleApiStatus } from './retry.js';

interface RulesetResponse {
  name: string;
}

/**
 * Публикует вложенный шаблон customer-project firestore.rules (см.
 * scripts/sync-templates.js) как активный ruleset в новом Firebase-проекте
 * покупателя через Firebase Rules API, затем релизит его в cloud.firestore —
 * эквивалент `firebase deploy --only firestore:rules`, но вызываемый
 * программно с OAuth-токеном покупателя.
 */
export async function deployFirestoreRules(accessToken: string, projectId: string): Promise<void> {
  const rulesContent = readFileSync(join(__dirname, 'templates', 'firestore.rules'), 'utf-8');

  const ruleset = await callGoogleApi<RulesetResponse>(
    accessToken,
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: 'POST',
      body: JSON.stringify({
        source: {
          files: [{ name: 'firestore.rules', content: rulesContent }],
        },
      }),
    },
  );

  const releaseName = `projects/${projectId}/releases/cloud.firestore`;

  try {
    // Обновляем существующий релиз (второй и последующие запуски).
    await callGoogleApi(accessToken, `https://firebaserules.googleapis.com/v1/${releaseName}`, {
      method: 'PATCH',
      body: JSON.stringify({ release: { name: releaseName, rulesetName: ruleset.name } }),
    });
  } catch (error) {
    // 404: у свежего проекта релиза cloud.firestore ещё нет — PATCH обновить
    // несуществующий ресурс не может, нужно создать его через POST.
    if (!isGoogleApiStatus(error, 404)) throw error;
    await callGoogleApi(accessToken, `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
    });
  }
}

interface TemplateIndexField {
  fieldPath?: string;
  order?: string;
  arrayConfig?: string;
}

interface TemplateIndex {
  collectionGroup: string;
  queryScope: string;
  fields: TemplateIndexField[];
}

/** Стабильная сравнимая сигнатура определения индекса (порядок полей важен
 *  для составных индексов Firestore, поэтому входит в ключ). */
function indexSignature(index: { queryScope?: string; fields?: TemplateIndexField[] }): string {
  const fields = (index.fields ?? []).map(
    (field) => `${field.fieldPath}:${field.order ?? ''}:${field.arrayConfig ?? ''}`,
  );
  return `${index.queryScope ?? ''}|${fields.join('>')}`;
}

/**
 * Создаёт составные индексы из вложенного firestore.indexes.json.
 * Firestore Admin API принимает по одному индексу за раз. Идемпотентно при
 * повторном запуске: существующие индексы (от предыдущего частичного
 * запуска) сначала перечисляются и пропускаются, вместо того чтобы валить
 * весь провижининг ошибкой ALREADY_EXISTS.
 */
export async function deployFirestoreIndexes(accessToken: string, projectId: string): Promise<void> {
  const indexesContent = readFileSync(
    join(__dirname, 'templates', 'firestore.indexes.json'),
    'utf-8',
  );
  const { indexes } = JSON.parse(indexesContent) as { indexes: TemplateIndex[] };

  for (const index of indexes) {
    const groupUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)` +
      `/collectionGroups/${index.collectionGroup}/indexes`;

    const wanted = indexSignature(index);
    const alreadyThere = (
      await callGoogleApi<{ indexes?: { queryScope?: string; fields?: TemplateIndexField[] }[] }>(
        accessToken,
        groupUrl,
      )
    ).indexes?.some(
      (candidate) => candidate.queryScope === index.queryScope && indexSignature(candidate) === wanted,
    );
    if (alreadyThere) continue;

    try {
      await callGoogleApi(accessToken, groupUrl, {
        method: 'POST',
        body: JSON.stringify({ queryScope: index.queryScope, fields: index.fields }),
      });
    } catch (error) {
      // 409: конкурентный/более ранний запуск только что создал этот самый индекс.
      if (!isGoogleApiStatus(error, 409)) throw error;
    }
  }
}
