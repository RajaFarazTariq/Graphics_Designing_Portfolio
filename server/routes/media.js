import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { imageSize } from 'image-size';
import { UPLOAD_DIR, LIMITS } from '../config.js';
import { logActivity, plain, getSetting } from '../db/index.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Detect the real type from file contents (never trust the extension / browser mime type).
function sniff(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (hex.startsWith('89504e470d0a1a0a')) return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (hex.startsWith('47494638')) return { mime: 'image/gif', ext: 'gif', kind: 'image' };
  if (hex.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', ext: 'webp', kind: 'image' };
  if (buf.subarray(4, 12).toString() === 'ftypavif') return { mime: 'image/avif', ext: 'avif', kind: 'image' };
  if (buf.subarray(0, 5).toString() === '%PDF-') return { mime: 'application/pdf', ext: 'pdf', kind: 'document' };
  return null;
}

/** Every place a media item can be referenced. */
export function mediaUsage(db, id) {
  const media = db.prepare('SELECT url FROM media WHERE id = ?').get(id);
  const uses = [];
  const add = (sql, label, ...args) => {
    for (const r of db.prepare(sql).all(...args)) uses.push({ type: label, id: r.id ?? null, title: r.title });
  };
  add('SELECT id, full_name AS title FROM profile WHERE profile_media_id = ?', 'Profile image', id);
  add('SELECT id, name AS title FROM skills WHERE icon_media_id = ?', 'Skill icon', id);
  add(`SELECT id, title FROM projects WHERE ? IN (thumbnail_media_id, main_media_id, featured_media_id)`, 'Project image', id);
  add(`SELECT p.id, p.title FROM project_images pi JOIN projects p ON p.id = pi.project_id WHERE pi.media_id = ?`, 'Project gallery', id);
  add('SELECT id, title FROM services WHERE icon_media_id = ?', 'Service icon', id);
  add('SELECT id, position AS title FROM experiences WHERE logo_media_id = ?', 'Experience logo', id);
  add('SELECT id, institution AS title FROM education WHERE logo_media_id = ?', 'Education logo', id);
  add('SELECT id, client_name AS title FROM testimonials WHERE ? IN (avatar_media_id, company_logo_media_id)', 'Testimonial image', id);
  add('SELECT id, label AS title FROM resumes WHERE media_id = ?', 'Resume', id);
  if (media && getSetting(db, 'seo')?.og_image === media.url) uses.push({ type: 'Social share image (SEO)', id: null, title: 'Site settings' });
  // de-duplicate (a project can use the same image as thumbnail and gallery)
  const seen = new Set();
  return uses.filter(u => { const k = `${u.type}:${u.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Stores a buffer in the library, reusing an existing identical file. */
export function storeFile(db, file, { allow = ['image', 'document'] } = {}) {
  const type = sniff(file.buffer);
  if (!type || !allow.includes(type.kind)) {
    throw httpError(415, `"${file.originalname}" is not a supported file. Use ${allow.includes('image') ? 'JPG, PNG, WebP, GIF or AVIF images' : ''}${allow.length === 2 ? ' or ' : ''}${allow.includes('document') ? 'PDF documents' : ''}.`);
  }
  const limit = type.kind === 'image' ? LIMITS.imageBytes : LIMITS.documentBytes;
  if (file.size > limit) throw httpError(413, `"${file.originalname}" is larger than ${Math.round(limit / 1024 / 1024)} MB.`);

  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const existing = db.prepare('SELECT * FROM media WHERE hash = ?').get(hash);
  if (existing) return { ...plain(existing), duplicate: true };

  let width = null, height = null;
  if (type.kind === 'image') {
    try { ({ width, height } = imageSize(file.buffer)); } catch { throw httpError(415, `"${file.originalname}" looks corrupted.`); }
  }
  const base = path.basename(file.originalname, path.extname(file.originalname))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
  const filename = `${base}-${hash.slice(0, 10)}.${type.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  const info = db.prepare(`INSERT INTO media (url, original_name, mime_type, kind, size, width, height, hash, alt_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`uploads/${filename}`, file.originalname.slice(0, 200), type.mime, type.kind,
    file.size, width, height, hash, '');
  const id = Number(info.lastInsertRowid);
  logActivity(db, 'media', id, file.originalname, 'uploaded');
  return plain(db.prepare('SELECT * FROM media WHERE id = ?').get(id));
}

/** Removes a media row and — for uploaded (non-original) files — the file on disk. */
export function removeMedia(db, id) {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  if (!row) return;
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  if (!row.is_original && row.url.startsWith('uploads/')) {
    const file = path.join(UPLOAD_DIR, path.basename(row.url));
    fs.rm(file, { force: true }, () => {});
  }
  logActivity(db, 'media', id, row.original_name, 'deleted');
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(LIMITS.imageBytes, LIMITS.documentBytes), files: 20 },
});

export function mediaRouter(db, { onChange }) {
  const router = Router();

  router.get('/', (req, res) => {
    const where = [];
    const args = [];
    const q = String(req.query.q || '').trim();
    if (q) { where.push('(original_name LIKE ? OR alt_text LIKE ? OR url LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (req.query.kind) { where.push('kind = ?'); args.push(String(req.query.kind)); }
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 40, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const sort = req.query.sort === 'name' ? 'original_name COLLATE NOCASE ASC' : req.query.sort === 'size' ? 'size DESC' : 'created_at DESC, id DESC';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS n FROM media ${whereSql}`).get(...args).n;
    const items = db.prepare(`SELECT * FROM media ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize)
      .map(m => ({ ...plain(m), usage_count: mediaUsage(db, m.id).length }));
    res.json({ items, total, page, pageSize });
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
    if (!row) throw httpError(404, 'File not found.');
    res.json({ ...plain(row), usage: mediaUsage(db, row.id) });
  });

  router.post('/', upload.array('files', 20), (req, res) => {
    if (!req.files?.length) throw httpError(400, 'Choose at least one file to upload.');
    const allow = req.query.kind === 'image' ? ['image'] : req.query.kind === 'document' ? ['document'] : ['image', 'document'];
    const results = [];
    const errors = [];
    for (const file of req.files) {
      try { results.push(storeFile(db, file, { allow })); }
      catch (e) { errors.push(e.message); }
    }
    if (!results.length) throw httpError(errors.length === 1 ? 415 : 400, errors.join(' '));
    res.status(201).json({ items: results, errors });
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    if (!row) throw httpError(404, 'File not found.');
    const alt = String(req.body?.alt_text ?? row.alt_text).trim().slice(0, 200);
    const name = String(req.body?.original_name ?? row.original_name).trim().slice(0, 200) || row.original_name;
    db.prepare("UPDATE media SET alt_text = ?, original_name = ?, updated_at = datetime('now') WHERE id = ?").run(alt, name, id);
    onChange();
    res.json(plain(db.prepare('SELECT * FROM media WHERE id = ?').get(id)));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM media WHERE id = ?').get(id)) throw httpError(404, 'File not found.');
    const usage = mediaUsage(db, id);
    if (usage.length) {
      const err = httpError(409, `This file is still used in ${usage.length} place(s). Replace it there first.`);
      err.usage = usage;
      throw err;
    }
    removeMedia(db, id);
    onChange();
    res.status(204).end();
  });

  return router;
}
