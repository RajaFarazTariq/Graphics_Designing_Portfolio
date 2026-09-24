// Proves the CMS-rendered page is identical to the original hand-written index.html.
// Seeds a throw-away database from the original content, renders it, and compares
// markup token-by-token (whitespace runs collapsed, entities decoded, JSON-LD compared as data).
//
//   npm run verify:ui            → compare against index.html in the working tree
//   npm run verify:ui -- --live  → compare the current live database instead (shows your edits)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { ROOT_DIR, DB_PATH } from '../config.js';
import { openDatabase } from '../db/index.js';
import { seedIfEmpty } from '../db/seed.js';
import { loadContent } from '../render/content.js';
import { renderPortfolio } from '../render/portfolio.js';

const live = process.argv.includes('--live');
let dbFile = DB_PATH;
let tmpDir = null;
if (!live) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-verify-'));
  dbFile = path.join(tmpDir, 'verify.sqlite');
}
const db = openDatabase(dbFile);
seedIfEmpty(db);
const rendered = renderPortfolio(loadContent(db));
db.close();
if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });

const original = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

const LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
function normalise(html) {
  const ld = JSON.parse(LD.exec(html)[1]);
  const body = html.replace(LD, '<script type="application/ld+json">[json-ld]</script>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '>\n<')        // newline-separated tokens for readable diffs;
    .split('\n').map(s => s.trim()); // "> <" and ">\n<" render identically
  return { ld, body };
}

const a = normalise(original);
const b = normalise(rendered);

let failures = 0;
try { assert.deepStrictEqual(b.ld, a.ld); console.log('✓ structured data (JSON-LD) identical'); }
catch (e) { failures++; console.log('✗ JSON-LD differs:\n' + e.message); }

const max = Math.max(a.body.length, b.body.length);
let shown = 0;
for (let i = 0; i < max; i++) {
  if (a.body[i] !== b.body[i]) {
    failures++;
    if (shown++ < 15) console.log(`✗ token ${i}\n   original: ${a.body[i]}\n   rendered: ${b.body[i]}`);
  }
}
if (a.body.length === b.body.length && failures === 0) {
  console.log(`✓ markup identical (${a.body.length} tokens compared)`);
  process.exit(0);
}
console.log(`\n${failures} difference(s) found`);
process.exit(1);
