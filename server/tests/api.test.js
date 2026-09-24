// Server integration tests:  npm test
// Each run uses a throw-away database and upload folder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-test-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'CorrectHorse42';

const { openDatabase } = await import('../db/index.js');
const { seedIfEmpty } = await import('../db/seed.js');
const { ensureAdmin } = await import('../auth.js');
const { createApp } = await import('../app.js');

let server, base, db, cookie = '';
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function call(method, url, body, { csrf = true, auth = true, form } = {}) {
  const headers = {};
  if (csrf) headers['X-Requested-With'] = 'XMLHttpRequest';
  if (auth && cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie?.startsWith('cms_session=')) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text, headers: res.headers };
}

before(async () => {
  db = openDatabase(path.join(tmp, 'test.sqlite'));
  seedIfEmpty(db);
  await ensureAdmin(db);
  server = createApp(db).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('public page renders imported content', async () => {
  const r = await call('GET', '/', undefined, { auth: false });
  assert.equal(r.status, 200);
  assert.match(r.text, /AV — Monogram Logo/);
  assert.match(r.text, /01 — About Me/);
});

test('private files are never served', async () => {
  for (const p of ['/package.json', '/server/app.js', '/data/test.sqlite', '/.git/config', '/server/db/seed.js']) {
    assert.equal((await call('GET', p, undefined, { auth: false })).status, 404, p);
  }
  assert.equal((await call('GET', '/styles.css', undefined, { auth: false })).status, 200);
});

test('admin API requires auth and CSRF header', async () => {
  assert.equal((await call('GET', '/api/admin/dashboard', undefined, { auth: false })).status, 401);
  assert.equal((await call('POST', '/api/admin/auth/login', { email: 'a', password: 'b' }, { csrf: false })).status, 403);
  const p = await call('GET', '/preview', undefined, { auth: false });
  assert.equal(p.status, 302);
});

test('login lockout blocks even the correct password', async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await call('POST', '/api/admin/auth/login', { email: 'locked@test.local', password: 'nope' })).status, 401);
  }
  assert.equal((await call('POST', '/api/admin/auth/login', { email: 'locked@test.local', password: 'nope' })).status, 429);
});

test('login succeeds with correct credentials', async () => {
  const r = await call('POST', '/api/admin/auth/login', { email: 'admin@test.local', password: 'CorrectHorse42' });
  assert.equal(r.status, 200);
  assert.ok(cookie);
  assert.match(r.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(r.headers.get('set-cookie'), /SameSite=Strict/i);
});

test('validation returns field errors', async () => {
  const r = await call('POST', '/api/admin/projects', { title: '', short_description: 'x', project_url: 'nope', status: 'published' });
  assert.equal(r.status, 400);
  assert.ok(r.json.fields.title);
  assert.ok(r.json.fields.project_url);
  assert.ok(r.json.fields.thumbnail_media_id);
});

test('drafts are hidden publicly but shown in preview', async () => {
  const created = await call('POST', '/api/admin/projects', { title: 'Secret Draft Work', short_description: 'Draft', status: 'draft' });
  assert.equal(created.status, 201);
  assert.doesNotMatch((await call('GET', '/', undefined, { auth: false })).text, /Secret Draft Work/);
  assert.match((await call('GET', '/preview')).text, /Secret Draft Work/);
  const pub = await call('GET', '/api/public/content', undefined, { auth: false });
  assert.ok(!pub.json.projects.some(p => p.title === 'Secret Draft Work'));
  assert.equal((await call('DELETE', `/api/admin/projects/${created.json.id}`)).status, 204);
});

test('media: sniffing, de-duplication and in-use protection', async () => {
  const bad = new FormData();
  bad.append('files', new Blob([Buffer.from('not an image')]), 'evil.jpg');
  assert.equal((await call('POST', '/api/admin/media', undefined, { form: bad })).status, 415);

  const up = () => { const f = new FormData(); f.append('files', new Blob([PNG_1PX]), 'dot.png'); return call('POST', '/api/admin/media', undefined, { form: f }); };
  const first = await up();
  assert.equal(first.status, 201);
  const second = await up();
  assert.equal(second.json.items[0].id, first.json.items[0].id);
  assert.equal(second.json.items[0].duplicate, true);

  const mediaId = first.json.items[0].id;
  const skill = await call('POST', '/api/admin/skills', { name: 'TestTool', icon_media_id: mediaId });
  assert.equal(skill.status, 201);
  const del = await call('DELETE', `/api/admin/media/${mediaId}`);
  assert.equal(del.status, 409);
  assert.equal(del.json.usage[0].type, 'Skill icon');
  await call('DELETE', `/api/admin/skills/${skill.json.id}`);
  assert.equal((await call('DELETE', `/api/admin/media/${mediaId}`)).status, 204);
});

test('duplicate names are rejected', async () => {
  const r = await call('POST', '/api/admin/skills', { name: 'photoshop' });
  assert.equal(r.status, 409);
});

test('reorder and section visibility reach the public page', async () => {
  const list = (await call('GET', '/api/admin/services?pageSize=100')).json.items;
  await call('POST', '/api/admin/services/reorder', { ids: list.map(s => s.id).reverse() });
  const html = (await call('GET', '/', undefined, { auth: false })).text;
  assert.ok(html.indexOf('Cover Letter Design') < html.indexOf('<h3>Logo Design</h3>'));

  await call('PUT', '/api/admin/sections/testimonials', { is_visible: false });
  const hidden = (await call('GET', '/', undefined, { auth: false })).text;
  assert.doesNotMatch(hidden, /id="testimonials"/);
  assert.doesNotMatch(hidden, /href="#testimonials"/);
  assert.match(hidden, /07 — Contact/);
  await call('PUT', '/api/admin/sections/testimonials', { is_visible: true });
  await call('POST', '/api/admin/services/reorder', { ids: list.map(s => s.id) });
});

test('rendered text is escaped', async () => {
  const r = await call('POST', '/api/admin/process-steps', { title: '<script>alert(1)</script>', description: 'x" onmouseover="y' });
  assert.equal(r.status, 201);
  const html = (await call('GET', '/', undefined, { auth: false })).text;
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  await call('DELETE', `/api/admin/process-steps/${r.json.id}`);
  assert.equal((await call('PUT', '/api/admin/settings/hero', { headline: 'a b', primary_cta: 'x', secondary_cta: 'y', cv_cta: 'z' })).status, 200);
  const css = await call('POST', '/api/admin/skills', { name: 'CssInject', icon_bg: 'red;} body{display:none' });
  assert.equal(css.status, 400);
});

test('password change invalidates old sessions', async () => {
  const oldCookie = cookie;
  const r = await call('PUT', '/api/admin/auth/password', { current_password: 'CorrectHorse42', new_password: 'EvenBetter99x', confirm_password: 'EvenBetter99x' });
  assert.equal(r.status, 200);
  const stale = await fetch(base + '/api/admin/dashboard', { headers: { Cookie: oldCookie } });
  assert.equal(stale.status, 401);
  assert.equal((await call('GET', '/api/admin/dashboard')).status, 200); // new cookie issued
});

test('contact messages are stored with honeypot + validation', async () => {
  assert.equal((await call('POST', '/api/public/messages', { name: 'A', email: 'bad', message: 'hi' }, { auth: false, csrf: false })).status, 400);
  assert.equal((await call('POST', '/api/public/messages', { name: 'Bot', email: 'b@b.co', message: 'spam', botcheck: 1 }, { auth: false, csrf: false })).json.stored, false);
  assert.equal((await call('POST', '/api/public/messages', { name: 'Jane', email: 'jane@x.co', message: 'Hello!' }, { auth: false, csrf: false })).status, 201);
  const inbox = await call('GET', '/api/admin/messages');
  assert.equal(inbox.json.items[0].name, 'Jane');
});
