// Generic CRUD router used by every repeatable collection.
import { Router } from 'express';
import { transaction, logActivity, plain } from '../db/index.js';
import { parse } from '../validation.js';

const httpError = (status, message, fields) => Object.assign(new Error(message), { status, fields });

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {object} cfg
 * @param {string} cfg.table
 * @param {import('zod').ZodType} cfg.schema
 * @param {string} cfg.titleField         column shown in activity log / duplicate suffix
 * @param {string[]} [cfg.jsonFields]     stored as JSON text
 * @param {string[]} [cfg.searchFields]
 * @param {string[]} [cfg.filterFields]   exact-match query filters
 * @param {string[]} [cfg.mediaFields]    media id columns (validated to exist)
 * @param {string[]} [cfg.patchFields]    fields allowed in quick PATCH toggles
 * @param {string[]} [cfg.uniqueFields]   case-insensitive duplicate prevention
 * @param {boolean} [cfg.hasStatus=true]
 * @param {(data, id, db) => object} [cfg.beforeSave]  may transform data (runs inside the transaction)
 * @param {(id, data, db) => void} [cfg.afterSave]
 * @param {(row, db) => object} [cfg.decorate]
 * @param {(id, db) => void} [cfg.beforeDelete]       throw to block
 * @param {(sourceId, newId, db) => void} [cfg.afterDuplicate]
 * @param {() => void} [cfg.onChange]
 */
export function collectionRouter(db, cfg) {
  const {
    table, schema, titleField, jsonFields = [], searchFields = [titleField], filterFields = [],
    mediaFields = [], patchFields = ['status', 'is_featured'], uniqueFields = [], hasStatus = true,
    beforeSave, afterSave, decorate, beforeDelete, afterDuplicate, onChange = () => {},
  } = cfg;
  const router = Router();
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  const sortable = ['sort_order', 'created_at', 'updated_at', titleField].filter(c => columns.has(c));

  const hydrate = (row) => {
    if (!row) return row;
    const out = plain(row);
    for (const f of jsonFields) { try { out[f] = JSON.parse(out[f] || '[]'); } catch { out[f] = []; } }
    return decorate ? decorate(out, db) : out;
  };
  const getRow = (id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  const mustGet = (id) => {
    const row = getRow(id);
    if (!row) throw httpError(404, 'This item no longer exists.');
    return row;
  };

  function checkMedia(data) {
    for (const f of mediaFields) {
      if (data[f] && !db.prepare('SELECT 1 FROM media WHERE id = ?').get(data[f])) {
        throw httpError(400, 'Selected file no longer exists in the media library.', { [f]: 'File not found' });
      }
    }
  }

  function checkUnique(data, id) {
    for (const f of uniqueFields) {
      if (!data[f]) continue;
      const clash = db.prepare(`SELECT id FROM ${table} WHERE ${f} = ? COLLATE NOCASE AND id != ?`).get(data[f], id ?? 0);
      if (clash) throw httpError(409, `An item with this ${f.replace(/_/g, ' ')} already exists.`, { [f]: 'Already exists' });
    }
  }

  function write(data, id) {
    const record = { ...data };
    for (const f of jsonFields) if (f in record) record[f] = JSON.stringify(record[f] ?? []);
    const keys = Object.keys(record).filter(k => columns.has(k) && k !== 'id');
    if (id) {
      db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')}${columns.has('updated_at') ? ", updated_at = datetime('now')" : ''} WHERE id = ?`)
        .run(...keys.map(k => record[k]), id);
      return id;
    }
    const nextOrder = columns.has('sort_order')
      ? (db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM ${table}`).get().n) : null;
    if (nextOrder !== null && !keys.includes('sort_order')) { keys.push('sort_order'); record.sort_order = nextOrder; }
    const info = db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
      .run(...keys.map(k => record[k]));
    return Number(info.lastInsertRowid);
  }

  function save(input, id) {
    const data = parse(schema, input);
    checkMedia(data);
    return transaction(db, () => {
      if (id) mustGet(id);
      const final = beforeSave ? beforeSave(data, id, db) : data;
      checkUnique(final, id);
      const savedId = write(final, id);
      afterSave?.(savedId, data, db);
      logActivity(db, table, savedId, final[titleField], id ? 'updated' : 'created');
      return savedId;
    });
  }

  // ---- list ----
  router.get('/', (req, res) => {
    const where = [];
    const args = [];
    const q = String(req.query.q || '').trim();
    if (q) {
      where.push(`(${searchFields.map(f => `${f} LIKE ?`).join(' OR ')})`);
      searchFields.forEach(() => args.push(`%${q}%`));
    }
    if (hasStatus && req.query.status) { where.push('status = ?'); args.push(String(req.query.status)); }
    if (columns.has('is_featured') && req.query.featured !== undefined && req.query.featured !== '') {
      where.push('is_featured = ?'); args.push(req.query.featured === '1' || req.query.featured === 'true' ? 1 : 0);
    }
    for (const f of filterFields) {
      if (req.query[f] !== undefined && req.query[f] !== '') {
        if (req.query[f] === 'none') where.push(`${f} IS NULL`);
        else { where.push(`${f} = ?`); args.push(String(req.query[f])); }
      }
    }
    const [sortField, sortDir] = String(req.query.sort || 'sort_order:asc').split(':');
    const orderBy = `${sortable.includes(sortField) ? sortField : 'sort_order'} ${sortDir === 'desc' ? 'DESC' : 'ASC'}, id ASC`;
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${whereSql}`).get(...args).n;
    const items = db.prepare(`SELECT * FROM ${table} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize).map(hydrate);
    res.json({ items, total, page, pageSize });
  });

  router.get('/:id', (req, res) => res.json(hydrate(mustGet(Number(req.params.id)))));

  router.post('/', (req, res) => {
    const id = save(req.body);
    onChange();
    res.status(201).json(hydrate(getRow(id)));
  });

  router.put('/:id', (req, res) => {
    const id = save(req.body, Number(req.params.id));
    onChange();
    res.json(hydrate(getRow(id)));
  });

  // Quick toggles (publish / feature / show) without resubmitting the whole form.
  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = mustGet(id);
    const changes = {};
    for (const f of patchFields) {
      if (!(f in (req.body || {}))) continue;
      const v = req.body[f];
      if (f === 'status') {
        if (!['draft', 'published', 'unpublished'].includes(v)) throw httpError(400, 'Invalid status');
        changes.status = v;
      } else {
        changes[f] = v ? 1 : 0;
      }
    }
    if (!Object.keys(changes).length) throw httpError(400, 'Nothing to update.');
    // Re-validate the full record so a quick "publish" can't bypass required-field rules.
    const merged = { ...hydrate(row), ...changes };
    delete merged.id;
    parse(schema, merged);
    transaction(db, () => {
      write(changes, id);
      logActivity(db, table, id, row[titleField], changes.status ? `set to ${changes.status}` : 'updated');
    });
    onChange();
    res.json(hydrate(getRow(id)));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = mustGet(id);
    transaction(db, () => {
      beforeDelete?.(id, db);
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      logActivity(db, table, id, row[titleField], 'deleted');
    });
    onChange();
    res.status(204).end();
  });

  router.post('/reorder', (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw httpError(400, 'Provide the new order as a list of ids.');
    const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
    transaction(db, () => {
      ids.forEach((id, i) => stmt.run(i, id));
      logActivity(db, table, null, `${ids.length} items`, 'reordered');
    });
    onChange();
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', (req, res) => {
    const sourceId = Number(req.params.id);
    const src = plain(mustGet(sourceId));
    const newId = transaction(db, () => {
      const copy = { ...src };
      delete copy.id; delete copy.created_at; delete copy.updated_at;
      copy[titleField] = `${src[titleField]} (copy)`;
      if (hasStatus && columns.has('status')) copy.status = 'draft';
      if ('slug' in copy) {
        let base = `${src.slug}-copy`, slug = base, n = 2;
        while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(slug)) slug = `${base}-${n++}`;
        copy.slug = slug;
      }
      for (const f of uniqueFields) {
        if (f !== titleField && copy[f]) copy[f] = `${copy[f]} (copy)`;
      }
      delete copy.sort_order;
      const keys = Object.keys(copy);
      keys.push('sort_order');
      const order = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM ${table}`).get().n;
      const info = db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
        .run(...keys.map(k => (k === 'sort_order' ? order : copy[k])));
      const id = Number(info.lastInsertRowid);
      afterDuplicate?.(sourceId, id, db);
      logActivity(db, table, id, copy[titleField], 'duplicated');
      return id;
    });
    onChange();
    res.status(201).json(hydrate(getRow(newId)));
  });

  return router;
}
