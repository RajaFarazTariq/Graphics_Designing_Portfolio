import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { transaction, logActivity, plain, getSetting, setSetting } from '../db/index.js';
import { slugify } from '../db/seed.js';
import { loadSettings } from '../render/content.js';
import { SERVICE_ICONS, SOCIAL_PLATFORMS } from '../render/icons.js';
import { schemas, profileSchema, settingsSchemas, sectionSchema, parse } from '../validation.js';
import {
  requireAuth, requireCsrfHeader, issueSession, clearSession, checkPassword, hashPassword,
  passwordProblem, rateLimiter, sessionUser, INITIAL_PASSWORD_FILE,
} from '../auth.js';
import { collectionRouter } from './collections.js';
import { mediaRouter, upload, storeFile, removeMedia, mediaUsage } from './media.js';

const httpError = (status, message, fields) => Object.assign(new Error(message), { status, fields });
const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many failed sign-in attempts. Try again in a few minutes.' });
const ipLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many failed sign-in attempts from this network. Try again later.' });
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

export function adminRouter(db, { onChange }) {
  const router = Router();
  router.use(requireCsrfHeader);

  // ---------------- auth (public endpoints) ----------------
  router.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) throw httpError(400, 'Enter your email and password.');
    const key = `${req.ip}|${email}`;
    const blocked = loginLimiter.blocked(key) || ipLimiter.blocked(req.ip);
    if (blocked) { res.set('Retry-After', String(blocked.retryAfter)); throw httpError(429, blocked.message); }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Unknown emails still pay the bcrypt cost so response timing doesn't reveal which accounts exist.
    const ok = await checkPassword(password, user ? user.password_hash : DUMMY_HASH) && !!user;
    if (!ok) ipLimiter(req.ip);
    if (!ok) {
      const limited = loginLimiter(key);
      if (limited) { res.set('Retry-After', String(limited.retryAfter)); throw httpError(429, limited.message); }
      throw httpError(401, 'Incorrect email or password.');
    }
    loginLimiter.reset(key);
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    issueSession(res, user);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  router.post('/auth/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

  router.get('/auth/me', (req, res) => {
    const user = sessionUser(db, req);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, last_login_at: user.last_login_at } });
  });

  // ---------------- everything below requires a session ----------------
  router.use(requireAuth(db));

  router.put('/auth/password', async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await checkPassword(String(current_password || ''), user.password_hash))) {
      throw httpError(400, 'Current password is incorrect.', { current_password: 'Incorrect password' });
    }
    const problem = passwordProblem(new_password);
    if (problem) throw httpError(400, problem, { new_password: problem });
    if (new_password !== confirm_password) throw httpError(400, 'Passwords do not match.', { confirm_password: 'Does not match' });
    if (new_password === current_password) throw httpError(400, 'Choose a password different from the current one.', { new_password: 'Same as current' });
    db.prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?")
      .run(await hashPassword(new_password), user.id);
    fs.rm(INITIAL_PASSWORD_FILE, { force: true }, () => {});
    logActivity(db, 'account', user.id, 'Password', 'changed');
    // Other sessions are now invalid; keep this one signed in.
    issueSession(res, db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));
    res.json({ ok: true });
  });

  router.put('/auth/account', async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.', { email: 'Invalid email' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (email !== user.email && !(await checkPassword(String(req.body?.current_password || ''), user.password_hash))) {
      throw httpError(400, 'Enter your current password to change the sign-in email.', { current_password: 'Required to change email' });
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, user.id)) throw httpError(409, 'That email is already in use.');
    db.prepare("UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?").run(name, email, user.id);
    res.json({ user: { id: user.id, email, name } });
  });

  // ---------------- meta (choices for the admin forms) ----------------
  router.get('/meta', (req, res) => {
    res.json({
      serviceIcons: Object.entries(SERVICE_ICONS).map(([key, v]) => ({ key, label: v.label, body: v.body })),
      socialPlatforms: Object.entries(SOCIAL_PLATFORMS).map(([key, v]) => ({ key, label: v.label, body: v.body })),
    });
  });

  // ---------------- dashboard ----------------
  router.get('/dashboard', (req, res) => {
    const n = (sql) => db.prepare(sql).get().n;
    res.json({
      counts: {
        projects: n('SELECT COUNT(*) AS n FROM projects'),
        projects_published: n("SELECT COUNT(*) AS n FROM projects WHERE status = 'published'"),
        projects_draft: n("SELECT COUNT(*) AS n FROM projects WHERE status = 'draft'"),
        projects_featured: n('SELECT COUNT(*) AS n FROM projects WHERE is_featured = 1'),
        skills: n('SELECT COUNT(*) AS n FROM skills'),
        experiences: n('SELECT COUNT(*) AS n FROM experiences'),
        education: n('SELECT COUNT(*) AS n FROM education'),
        services: n('SELECT COUNT(*) AS n FROM services'),
        testimonials: n('SELECT COUNT(*) AS n FROM testimonials'),
        messages: n('SELECT COUNT(*) AS n FROM messages'),
        messages_unread: n('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0'),
        media: n('SELECT COUNT(*) AS n FROM media'),
        hidden_sections: n('SELECT COUNT(*) AS n FROM sections WHERE is_visible = 0'),
      },
      activity: db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 12').all().map(plain),
      messages: db.prepare('SELECT id, name, email, subject, is_read, created_at FROM messages ORDER BY id DESC LIMIT 5').all().map(plain),
      resume: plain(db.prepare('SELECT r.id, r.label, m.url FROM resumes r JOIN media m ON m.id = r.media_id WHERE r.is_active = 1').get()) || null,
    });
  });

  // ---------------- profile ----------------
  const mediaRef = (id) => (id ? plain(db.prepare('SELECT id, url, original_name, alt_text, width, height FROM media WHERE id = ?').get(id)) || null : null);
  router.get('/profile', (req, res) => {
    const p = plain(db.prepare('SELECT * FROM profile WHERE id = 1').get());
    res.json({ ...p, profile_media: mediaRef(p.profile_media_id) });
  });
  router.put('/profile', (req, res) => {
    const data = parse(profileSchema, req.body);
    const keys = Object.keys(data);
    db.prepare(`UPDATE profile SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = 1`)
      .run(...keys.map(k => data[k]));
    logActivity(db, 'profile', 1, data.full_name, 'updated');
    onChange();
    const p = plain(db.prepare('SELECT * FROM profile WHERE id = 1').get());
    res.json({ ...p, profile_media: mediaRef(p.profile_media_id) });
  });

  // ---------------- site settings ----------------
  router.get('/settings', (req, res) => res.json(loadSettings(db)));
  router.put('/settings/:key', (req, res) => {
    const schema = settingsSchemas[req.params.key];
    if (!schema) throw httpError(404, 'Unknown settings group.');
    const data = parse(schema, req.body);
    setSetting(db, req.params.key, data);
    logActivity(db, 'settings', null, req.params.key, 'updated');
    onChange();
    res.json(loadSettings(db)[req.params.key]);
  });

  // ---------------- sections ----------------
  router.get('/sections', (req, res) => res.json(db.prepare('SELECT * FROM sections ORDER BY position').all().map(plain)));
  router.put('/sections/:key', (req, res) => {
    const row = db.prepare('SELECT * FROM sections WHERE key = ?').get(req.params.key);
    if (!row) throw httpError(404, 'Unknown section.');
    const data = parse(sectionSchema, { ...plain(row), ...req.body });
    if (row.eyebrow && !data.heading) throw httpError(400, 'Section heading cannot be empty.', { heading: 'Required' });
    db.prepare(`UPDATE sections SET eyebrow = ?, heading = ?, heading_em = ?, nav_label = ?, in_footer = ?, is_visible = ?,
      updated_at = datetime('now') WHERE key = ?`)
      .run(data.eyebrow, data.heading, data.heading_em, data.nav_label, data.in_footer, data.is_visible, req.params.key);
    logActivity(db, 'sections', null, row.name, data.is_visible !== row.is_visible ? (data.is_visible ? 'shown' : 'hidden') : 'updated');
    onChange();
    res.json(plain(db.prepare('SELECT * FROM sections WHERE key = ?').get(req.params.key)));
  });

  // ---------------- collections ----------------
  const withMedia = (fields) => (row) => {
    for (const f of fields) row[f.replace(/_id$/, '')] = mediaRef(row[f]);
    return row;
  };

  router.use('/skills', collectionRouter(db, {
    table: 'skills', schema: schemas.skills, titleField: 'name', searchFields: ['name', 'category', 'description'],
    filterFields: ['category'], mediaFields: ['icon_media_id'], uniqueFields: ['name'],
    decorate: withMedia(['icon_media_id']), onChange,
  }));

  router.use('/project-categories', collectionRouter(db, {
    table: 'project_categories', schema: schemas.project_categories, titleField: 'label', hasStatus: false,
    patchFields: [], uniqueFields: ['slug', 'label'],
    beforeSave: (data) => ({ ...data, slug: data.slug || slugify(data.label) }),
    decorate: (row) => ({ ...row, project_count: db.prepare('SELECT COUNT(*) AS n FROM projects WHERE category_id = ?').get(row.id).n }),
    onChange,
  }));

  const projectMedia = ['thumbnail_media_id', 'main_media_id', 'featured_media_id'];
  router.use('/projects', collectionRouter(db, {
    table: 'projects', schema: schemas.projects, titleField: 'title', jsonFields: ['tags', 'tools'],
    searchFields: ['title', 'short_description', 'client', 'tags', 'tools'], filterFields: ['category_id'],
    mediaFields: projectMedia,
    beforeSave: (data, id, db) => {
      const { gallery, ...rest } = data;
      let slug = rest.slug || slugify(rest.title);
      const base = slug; let n = 2;
      while (db.prepare('SELECT 1 FROM projects WHERE slug = ? AND id != ?').get(slug, id ?? 0)) slug = `${base}-${n++}`;
      if (rest.category_id && !db.prepare('SELECT 1 FROM project_categories WHERE id = ?').get(rest.category_id)) {
        throw httpError(400, 'Selected category no longer exists.', { category_id: 'Not found' });
      }
      for (const g of gallery) {
        if (!db.prepare('SELECT 1 FROM media WHERE id = ?').get(g.media_id)) throw httpError(400, 'A gallery image no longer exists.');
      }
      return { ...rest, slug };
    },
    afterSave: (id, data, db) => {
      db.prepare('DELETE FROM project_images WHERE project_id = ?').run(id);
      const ins = db.prepare('INSERT OR IGNORE INTO project_images (project_id, media_id, caption, sort_order) VALUES (?, ?, ?, ?)');
      data.gallery.forEach((g, i) => ins.run(id, g.media_id, g.caption || '', i));
    },
    afterDuplicate: (src, id, db) => {
      db.prepare(`INSERT INTO project_images (project_id, media_id, caption, sort_order)
        SELECT ?, media_id, caption, sort_order FROM project_images WHERE project_id = ?`).run(id, src);
    },
    decorate: (row, db) => {
      withMedia(projectMedia)(row);
      row.category = plain(db.prepare('SELECT id, slug, label FROM project_categories WHERE id = ?').get(row.category_id)) || null;
      row.gallery = db.prepare(`SELECT pi.media_id, pi.caption, m.url, m.original_name, m.width, m.height FROM project_images pi
        JOIN media m ON m.id = pi.media_id WHERE pi.project_id = ? ORDER BY pi.sort_order, pi.id`).all(row.id).map(plain);
      return row;
    },
    onChange,
  }));

  router.use('/services', collectionRouter(db, {
    table: 'services', schema: schemas.services, titleField: 'title', jsonFields: ['features', 'tools'],
    searchFields: ['title', 'description'], mediaFields: ['icon_media_id'], uniqueFields: ['title'],
    decorate: withMedia(['icon_media_id']), onChange,
  }));

  router.use('/experiences', collectionRouter(db, {
    table: 'experiences', schema: schemas.experiences, titleField: 'position', jsonFields: ['responsibilities', 'tools'],
    searchFields: ['position', 'company', 'description'], mediaFields: ['logo_media_id'],
    patchFields: ['status', 'is_current'], decorate: withMedia(['logo_media_id']), onChange,
  }));

  router.use('/education', collectionRouter(db, {
    table: 'education', schema: schemas.education, titleField: 'institution',
    searchFields: ['institution', 'degree', 'field_of_study'], mediaFields: ['logo_media_id'],
    patchFields: ['status', 'is_current'], decorate: withMedia(['logo_media_id']), onChange,
  }));

  router.use('/testimonials', collectionRouter(db, {
    table: 'testimonials', schema: schemas.testimonials, titleField: 'client_name',
    searchFields: ['client_name', 'company', 'quote'], mediaFields: ['avatar_media_id', 'company_logo_media_id'],
    decorate: withMedia(['avatar_media_id', 'company_logo_media_id']), onChange,
  }));

  router.use('/social-links', collectionRouter(db, {
    table: 'social_links', schema: schemas.social_links, titleField: 'platform', searchFields: ['platform', 'label', 'url'],
    patchFields: ['status', 'show_on_site'], uniqueFields: ['url'], onChange,
  }));

  router.use('/process-steps', collectionRouter(db, {
    table: 'process_steps', schema: schemas.process_steps, titleField: 'title', searchFields: ['title', 'description'], onChange,
  }));

  router.use('/stats', collectionRouter(db, {
    table: 'stats', schema: schemas.stats, titleField: 'label', filterFields: ['placement'], onChange,
  }));

  router.use('/facts', collectionRouter(db, {
    table: 'facts', schema: schemas.facts, titleField: 'label', onChange,
  }));

  // ---------------- media ----------------
  router.use('/media', mediaRouter(db, { onChange }));

  // ---------------- resumes ----------------
  const resumeRow = (id) => plain(db.prepare(`SELECT r.*, m.url, m.original_name, m.size, m.is_original FROM resumes r
    JOIN media m ON m.id = r.media_id WHERE r.id = ?`).get(id));

  router.get('/resumes', (req, res) => {
    res.json(db.prepare(`SELECT r.*, m.url, m.original_name, m.size, m.is_original FROM resumes r
      JOIN media m ON m.id = r.media_id ORDER BY r.is_active DESC, r.created_at DESC, r.id DESC`).all().map(plain));
  });

  router.post('/resumes', upload.single('file'), (req, res) => {
    if (!req.file) throw httpError(400, 'Choose a PDF file to upload.');
    const id = transaction(db, () => {
      const media = storeFile(db, req.file, { allow: ['document'] });
      if (db.prepare('SELECT 1 FROM resumes WHERE media_id = ?').get(media.id)) throw httpError(409, 'This exact file is already uploaded as a resume.');
      const label = String(req.body?.label || '').trim().slice(0, 120) || req.file.originalname;
      const hasActive = db.prepare('SELECT 1 FROM resumes WHERE is_active = 1').get();
      const activate = req.body?.activate === 'true' || !hasActive;
      if (activate) db.prepare('UPDATE resumes SET is_active = 0 WHERE is_active = 1').run();
      const rid = Number(db.prepare('INSERT INTO resumes (media_id, label, is_active) VALUES (?, ?, ?)').run(media.id, label, activate ? 1 : 0).lastInsertRowid);
      logActivity(db, 'resumes', rid, label, activate ? 'uploaded and activated' : 'uploaded');
      return rid;
    });
    onChange();
    res.status(201).json(resumeRow(id));
  });

  router.patch('/resumes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!resumeRow(id)) throw httpError(404, 'Resume not found.');
    const label = String(req.body?.label || '').trim().slice(0, 120);
    if (!label) throw httpError(400, 'Label is required.', { label: 'Required' });
    db.prepare("UPDATE resumes SET label = ?, updated_at = datetime('now') WHERE id = ?").run(label, id);
    res.json(resumeRow(id));
  });

  router.post('/resumes/:id/activate', (req, res) => {
    const id = Number(req.params.id);
    const row = resumeRow(id);
    if (!row) throw httpError(404, 'Resume not found.');
    transaction(db, () => {
      db.prepare('UPDATE resumes SET is_active = 0 WHERE is_active = 1').run();
      db.prepare("UPDATE resumes SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      logActivity(db, 'resumes', id, row.label, 'set as active');
    });
    onChange();
    res.json(resumeRow(id));
  });

  router.delete('/resumes/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = resumeRow(id);
    if (!row) throw httpError(404, 'Resume not found.');
    transaction(db, () => {
      db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
      logActivity(db, 'resumes', id, row.label, 'deleted');
      if (mediaUsage(db, row.media_id).length === 0) removeMedia(db, row.media_id);
    });
    onChange();
    res.status(204).end();
  });

  // ---------------- messages ----------------
  router.get('/messages', (req, res) => {
    const where = [];
    const args = [];
    const q = String(req.query.q || '').trim();
    if (q) { where.push('(name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)'); args.push(...Array(4).fill(`%${q}%`)); }
    if (req.query.unread === '1') where.push('is_read = 0');
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    res.json({
      total: db.prepare(`SELECT COUNT(*) AS n FROM messages ${whereSql}`).get(...args).n,
      page, pageSize,
      items: db.prepare(`SELECT * FROM messages ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize).map(plain),
    });
  });
  router.patch('/messages/:id', (req, res) => {
    db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(req.body?.is_read ? 1 : 0, Number(req.params.id));
    res.json({ ok: true });
  });
  router.post('/messages/mark-all-read', (req, res) => {
    db.prepare('UPDATE messages SET is_read = 1 WHERE is_read = 0').run();
    res.json({ ok: true });
  });
  router.delete('/messages/:id', (req, res) => {
    db.prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
