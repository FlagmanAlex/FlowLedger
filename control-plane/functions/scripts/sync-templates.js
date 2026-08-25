// Copies the canonical customer-project Firestore rules/indexes (source of
// truth: templates/customer-project/) into src/templates/ so they get
// bundled with the Cloud Function — `firebase deploy` only uploads this
// functions/ directory, not sibling repo folders.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', '..', 'templates', 'customer-project');
const dest = path.join(__dirname, '..', 'lib', 'templates');

fs.mkdirSync(dest, { recursive: true });
for (const file of ['firestore.rules', 'firestore.indexes.json']) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log('Synced customer-project templates into control-plane/functions/lib/templates/');
