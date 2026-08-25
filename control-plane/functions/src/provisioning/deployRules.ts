import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callGoogleApi } from './googleApiClient.js';

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

/**
 * Creates the composite indexes from the bundled firestore.indexes.json.
 * Firestore Admin API takes one index at a time.
 */
export async function deployFirestoreIndexes(accessToken: string, projectId: string): Promise<void> {
  const indexesContent = readFileSync(
    join(__dirname, 'templates', 'firestore.indexes.json'),
    'utf-8',
  );
  const { indexes } = JSON.parse(indexesContent) as {
    indexes: { collectionGroup: string; queryScope: string; fields: unknown[] }[];
  };

  for (const index of indexes) {
    await callGoogleApi(
      accessToken,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${index.collectionGroup}/indexes`,
      {
        method: 'POST',
        body: JSON.stringify({ queryScope: index.queryScope, fields: index.fields }),
      },
    );
  }
}
