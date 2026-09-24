import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, CONTENT_FILE, IS_GITHUB } from './config.js';
import { openDatabase } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { loadSnapshot } from './db/snapshot.js';
import { getStore } from './storage/github.js';

export const contentFilePath = () => path.join(ROOT_DIR, CONTENT_FILE);

/**
 * Opens the database for the current storage mode.
 * - local:  the SQLite file (first run imports the original hardcoded content)
 * - github: in-memory DB loaded from content/cms.json bundled with the deployment
 *           (the admin API then keeps it in sync with the branch on GitHub)
 */
export function openContentDb({ fromSnapshot = IS_GITHUB, file } = {}) {
  const db = openDatabase(fromSnapshot ? ':memory:' : file);
  const snapFile = contentFilePath();
  let bundled = null;
  if (fromSnapshot && fs.existsSync(snapFile)) {
    bundled = fs.readFileSync(snapFile);
    loadSnapshot(db, JSON.parse(bundled.toString('utf8')));
  } else {
    seedIfEmpty(db);
  }
  if (IS_GITHUB) getStore().markBundled(db, bundled);
  return db;
}
