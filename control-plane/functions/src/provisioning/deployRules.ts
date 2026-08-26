import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callGoogleApi } from './googleApiClient.js';
import { isGoogleApiStatus } from './retry.js';

interface RulesetResponse {
  name: string;
}

/**
 * Publishes the bundled customer-project firestore.rules (see
 * scripts/sync-templates.js) as the active ruleset in the customer's new
 * Firebase project via the Firebase Rules API, then releases it to
 * cloud.firestore — equivalent to `firebase deploy --only firestore:rules`
 * but callable programmatically with the customer's OAuth token.
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

  await callGoogleApi(
    accessToken,
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        release: {
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName: ruleset.name,
        },
      }),
    },
  );
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

/** Stable comparable signature of an index definition (field order matters
 *  for Firestore composite indexes, so it is part of the key). */
function indexSignature(index: { queryScope?: string; fields?: TemplateIndexField[] }): string {
  const fields = (index.fields ?? []).map(
    (field) => `${field.fieldPath}:${field.order ?? ''}:${field.arrayConfig ?? ''}`,
  );
  return `${index.queryScope ?? ''}|${fields.join('>')}`;
}

/**
 * Creates the composite indexes from the bundled firestore.indexes.json.
 * Firestore Admin API takes one index at a time. Idempotent on re-run:
 * existing indexes (from a previous partial run) are listed first and
 * skipped instead of failing the whole provisioning with ALREADY_EXISTS.
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
      // 409: a concurrent/earlier run created this very index just now.
      if (!isGoogleApiStatus(error, 409)) throw error;
    }
  }
}
