// GitHub-storage mode tests against an in-process fake of the GitHub REST API
// (refs, blobs, trees, commits, contents). Nothing touches the real GitHub.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

// ---------------- fake GitHub ----------------
const OWNER = 'RajaFarazTariq';
const REPO = `${OWNER}/portfolio-test`;
const blobs = new Map();   // sha -> Buffer
const trees = new Map();   // id -> Map(path -> blobSha)
const commits = new Map(); // id -> { tree, parent, message }
let head = null;
let failNextTree = false;
const blobSha = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const putBlob = (buf) => { const s = blobSha(buf); blobs.set(s, buf); return s; };
const newId = () => crypto.randomBytes(20).toString('hex');
function commitFiles(files, message = 'external') {
  const base = head ? new Map(trees.get(commits.get(head).tree)) : new Map();
  for (const [p, buf] of Object.entries(files)) { if (buf === null) base.delete(p); else base.set(p, putBlob(buf)); }
  const t = newId(); trees.set(t, base);
  const c = newId(); commits.set(c, { tree: t, parent: head, message });
  head = c;
}
const fileAt = (p, commit = head) => { const s = trees.get(commits.get(commit).tree).get(p); return s ? blobs.get(s) : null; };

const TOKENS = { 'good-token': { login: OWNER, name: 'Raja', push: true }, 'intruder-token': { login: 'someone-else', push: true }, 'readonly-token': { login: OWNER, push: false } };

const gh = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  const auth = TOKENS[(req.headers.authorization || '').replace('Bearer ', '')];
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (!auth) return send(401, { message: 'Bad credentials' });
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const r = `/repos/${REPO}`;
  if (p === '/user') return send(200, { login: auth.login, name: auth.name, avatar_url: '' });
  if (p === r) return send(200, { permissions: { push: auth.push } });
  if (p === `${r}/git/ref/heads/main`) return send(200, { object: { sha: head } });
  if (p.startsWith(`${r}/contents/`)) {
    const file = decodeURIComponent(p.slice(`${r}/contents/`.length));
    const ref = url.searchParams.get('ref');
    const at = commits.has(ref) ? ref : head;
    const buf = fileAt(file, at);
    if (!buf) return send(404, { message: 'Not Found' });
    if ((req.headers.accept || '').includes('raw')) { res.writeHead(200); return res.end(buf); }
    return send(200, { sha: blobSha(buf), content: buf.toString('base64'), encoding: 'base64' });
  }
  if (p.startsWith(`${r}/git/commits/`) && req.method === 'GET') return send(200, { sha: p.split('/').pop(), tree: { sha: commits.get(p.split('/').pop()).tree } });
  if (p === `${r}/git/blobs` && req.method === 'POST') return send(201, { sha: putBlob(Buffer.from(body.content, 'base64')) });
  if (p === `${r}/git/trees` && req.method === 'POST') {
    if (failNextTree) { failNextTree = false; return send(500, { message: 'Server Error' }); }
    const t = new Map(trees.get(body.base_tree));
    for (const e of body.tree) { if (e.sha === null) t.delete(e.path); else t.set(e.path, e.sha); }
    const id = newId(); trees.set(id, t); return send(201, { sha: id });
  }
  if (p === `${r}/git/commits` && req.method === 'POST') {
    const id = newId(); commits.set(id, { tree: body.tree, parent: body.parents[0], message: body.message }); return send(201, { sha: id });
  }
  if (p === `${r}/git/refs/heads/main` && req.method === 'PATCH') {
    if (commits.get(body.sha).parent !== head) return send(422, { message: 'Update is not a fast forward' });
    head = body.sha; return send(200, { object: { sha: head } });
  }
  send(404, { message: `fake: unhandled ${req.method} ${p}` });
});

// ---------------- app under test ----------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-gh-test-'));
let server, base, cookie = '', createApp, openContentDb, db;

async function call(method, url, body, { csrf = true, form } = {}) {
  const headers = {};
  if (csrf) headers['X-Requested-With'] = 'XMLHttpRequest';
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
  const sc = res.headers.get('set-cookie');
  if (sc?.startsWith('cms_session=')) cookie = sc.split(';')[0];
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString()); } catch { /* binary */ }
  return { status: res.status, json, buf, headers: res.headers };
}
const snapshot = () => JSON.parse(fileAt('content/cms.json').toString());

before(async () => {
  await new Promise(r => gh.listen(0, r));
  Object.assign(process.env, {
    CMS_STORAGE: 'github', GITHUB_API_URL: `http://127.0.0.1:${gh.address().port}`, GITHUB_REPO: REPO, GITHUB_BRANCH: 'main',
    JWT_SECRET: 'test-secret-'.repeat(4), DATA_DIR: path.join(tmp, 'data'), UPLOAD_DIR: path.join(tmp, 'uploads'),
  });
  ({ createApp } = await import('../app.js'));
  ({ openContentDb } = await import('../bootstrap.js'));
  // The fake repo starts with the same content/cms.json the deployment is bundled with.
  commitFiles({ 'content/cms.json': fs.readFileSync(new URL('../../content/cms.json', import.meta.url)), 'index.html': Buffer.from('x') }, 'initial');
  db = openContentDb();
  server = createApp(db).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); gh.close(); db?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('config reports GitHub mode and password login is disabled', async () => {
  const cfg = await call('GET', '/api/admin/auth/config');
  assert.equal(cfg.json.storage, 'github');
  assert.deepEqual(cfg.json.allowedUsers, [OWNER]);
  assert.equal(cfg.json.maxImageMb, 4);
  assert.equal((await call('POST', '/api/admin/auth/login', { email: 'a@b.c', password: 'x' })).status, 400);
});

test('only the repo owner with push access can sign in', async () => {
  assert.equal((await call('POST', '/api/admin/auth/token', { token: 'intruder-token' })).status, 403);
  assert.equal((await call('POST', '/api/admin/auth/token', { token: 'readonly-token' })).status, 403);
  assert.equal((await call('POST', '/api/admin/auth/token', { token: 'nope' })).status, 401);
  assert.equal(cookie, '');
  const ok = await call('POST', '/api/admin/auth/token', { token: 'good-token' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.login, OWNER);
  assert.doesNotMatch(cookie, /good-token/); // token is encrypted inside the cookie
  assert.equal((await call('GET', '/api/admin/auth/me')).json.user.login, OWNER);
});

test('a save becomes exactly one commit with the updated snapshot', async () => {
  const before = head;
  const r = await call('POST', '/api/admin/skills', { name: 'Procreate', description: 'Digital painting' });
  assert.equal(r.status, 201);
  assert.notEqual(head, before);
  assert.equal(r.headers.get('x-cms-commit'), head);
  assert.equal(commits.get(head).parent, before);
  assert.match(commits.get(head).message, /created skills “Procreate”/);
  assert.ok(snapshot().tables.skills.some(s => s.name === 'Procreate'));
  assert.ok(!('users' in snapshot().tables) && !('messages' in snapshot().tables));
});

test('validation errors and reads do not commit', async () => {
  const before = head;
  assert.equal((await call('POST', '/api/admin/skills', { name: '' })).status, 400);
  assert.equal((await call('GET', '/api/admin/skills')).status, 200);
  assert.equal(head, before);
});

test('uploads are committed with the snapshot and previewable before deploy', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const f = new FormData(); f.append('files', new Blob([png]), 'Dot.png');
  const r = await call('POST', '/api/admin/media', undefined, { form: f });
  assert.equal(r.status, 201);
  const url = r.json.items[0].url;
  assert.ok(fileAt(url)?.equals(png), 'image file committed');
  assert.ok(snapshot().tables.media.some(m => m.url === url), 'media row committed in the same commit');
  fs.rmSync(path.join(tmp, 'uploads', path.basename(url))); // force fetching from "GitHub"
  const raw = await call('GET', `/api/admin/raw?path=${encodeURIComponent(url)}`);
  assert.equal(raw.status, 200);
  assert.ok(raw.buf.equals(png));
  assert.equal((await call('GET', '/api/admin/raw?path=../package.json')).status, 400);

  const del = await call('DELETE', `/api/admin/media/${r.json.items[0].id}`);
  assert.equal(del.status, 204);
  assert.equal(fileAt(url), null, 'file removed from the repo');
});

test('changes made elsewhere are picked up (other instance / manual edit)', async () => {
  const snap = snapshot();
  snap.tables.skills.find(s => s.name === 'Procreate').description = 'Edited on GitHub';
  commitFiles({ 'content/cms.json': Buffer.from(JSON.stringify(snap)) });
  const list = await call('GET', '/api/admin/skills?q=Procreate');
  assert.equal(list.json.items[0].description, 'Edited on GitHub');
});

test('code-only commits in between do not block saving', async () => {
  commitFiles({ 'README.md': Buffer.from('docs change') });
  const r = await call('PUT', '/api/admin/sections/process', { is_visible: false });
  assert.equal(r.status, 200);
  assert.equal(snapshot().tables.sections.find(s => s.key === 'process').is_visible, 0);
  assert.equal(fileAt('README.md').toString(), 'docs change');
});

test('if GitHub fails, the change is rolled back and reported', async () => {
  const before = head;
  failNextTree = true;
  const r = await call('POST', '/api/admin/skills', { name: 'Ghost Skill' });
  assert.equal(r.status, 502);
  assert.match(r.json.error, /Not saved/);
  assert.equal(head, before);
  const list = await call('GET', '/api/admin/skills?q=Ghost');
  assert.equal(list.json.items.length, 0, 'in-memory copy was restored from GitHub');
});

test('preview requires a session and contact messages are never stored', async () => {
  assert.equal((await call('GET', '/api/preview')).status, 200);
  const saved = cookie; cookie = '';
  assert.equal((await call('GET', '/api/preview')).status, 302);
  cookie = saved;
  const before = head;
  const m = await call('POST', '/api/public/messages', { name: 'Jane', email: 'j@x.co', message: 'Hi' }, { csrf: false });
  assert.equal(m.json.stored, false);
  assert.equal(head, before);
});
