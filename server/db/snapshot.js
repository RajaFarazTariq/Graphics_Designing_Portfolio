// Converts the CMS database to/from a JSON snapshot (content/cms.json).
// The snapshot holds content only — never admin accounts or contact messages.
import { transaction, plain } from './index.js';

// Parents before children so foreign keys resolve on load.
export const SNAPSHOT_TABLES = [
  'media', 'profile', 'site_settings', 'sections', 'stats', 'facts', 'skills', 'project_categories',
  'projects', 'project_images', 'process_steps', 'services', 'experiences', 'education', 'testimonials',
  'social_links', 'resumes', 'activity_log',
];
const ACTIVITY_KEEP = 100;

export function dumpSnapshot(db) {
  const tables = {};
  for (const t of SNAPSHOT_TABLES) {
    const sql = t === 'activity_log'
      ? `SELECT * FROM (SELECT * FROM activity_log ORDER BY id DESC LIMIT ${ACTIVITY_KEEP}) ORDER BY id`
      : `SELECT * FROM ${t} ORDER BY rowid`;
    tables[t] = db.prepare(sql).all().map(plain);
  }
  return { format: 'portfolio-cms', version: 1, tables };
}

export const serializeSnapshot = (snap) => JSON.stringify(snap, null, 2) + '\n';

/** Replaces all content tables with the snapshot's rows. */
export function loadSnapshot(db, snap) {
  if (!snap || snap.format !== 'portfolio-cms' || !snap.tables) throw new Error('Not a portfolio CMS snapshot');
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    transaction(db, () => {
      for (const t of [...SNAPSHOT_TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run();
      for (const t of SNAPSHOT_TABLES) {
        const rows = snap.tables[t] || [];
        if (!rows.length) continue;
        const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
        for (const row of rows) {
          const keys = cols.filter(c => c in row);
          db.prepare(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
            .run(...keys.map(k => row[k]));
        }
      }
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
