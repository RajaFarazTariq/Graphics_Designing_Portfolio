// Writes content/cms.json (the content file the Vercel deployment reads and commits to).
//   npm run content:snapshot            → from your local database (publish local edits)
//   npm run content:snapshot -- --seed  → from the original hardcoded content
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../db/index.js';
import { seedIfEmpty } from '../db/seed.js';
import { dumpSnapshot, serializeSnapshot } from '../db/snapshot.js';
import { contentFilePath } from '../bootstrap.js';

const fresh = process.argv.includes('--seed');
const db = openDatabase(fresh ? ':memory:' : undefined);
seedIfEmpty(db);
const file = contentFilePath();
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, serializeSnapshot(dumpSnapshot(db)));
db.close();
console.log(`Wrote ${path.relative(process.cwd(), file)} from ${fresh ? 'the original content' : 'the local database'}`);
