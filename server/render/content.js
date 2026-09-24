// Loads everything the public page needs from the database into one view model.
import { getSetting, plain } from '../db/index.js';
import { DEFAULT_SITE_SETTINGS } from '../db/seed.js';

const parseList = (v) => {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

export function loadSettings(db) {
  const out = {};
  for (const [key, defaults] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    out[key] = { ...defaults, ...(getSetting(db, key) || {}) };
  }
  return out;
}

/**
 * @param {object} opts
 * @param {boolean} opts.preview include draft items (admin preview only)
 */
export function loadContent(db, { preview = false } = {}) {
  const statusSql = preview ? "status IN ('published','draft')" : "status = 'published'";
  const all = (sql, ...args) => db.prepare(sql).all(...args).map(plain);
  const mediaUrl = (id) => (id ? db.prepare('SELECT url FROM media WHERE id = ?').get(id)?.url || null : null);

  const profile = plain(db.prepare('SELECT * FROM profile WHERE id = 1').get()) || {};
  const settings = loadSettings(db);

  const sections = {};
  for (const s of all('SELECT * FROM sections ORDER BY position')) sections[s.key] = s;

  const stats = all(`SELECT * FROM stats WHERE ${statusSql} ORDER BY sort_order, id`);
  const facts = all(`SELECT * FROM facts WHERE ${statusSql} ORDER BY sort_order, id`);

  const skills = all(`SELECT * FROM skills WHERE ${statusSql} ORDER BY sort_order, id`)
    .map(s => ({ ...s, icon_url: mediaUrl(s.icon_media_id) }));

  const projects = all(`
    SELECT p.*, c.slug AS category_slug, c.label AS category_label,
           t.url AS thumbnail_url, t.alt_text AS thumbnail_alt, m.url AS main_url, f.url AS featured_url
      FROM projects p
      LEFT JOIN project_categories c ON c.id = p.category_id
      LEFT JOIN media t ON t.id = p.thumbnail_media_id
      LEFT JOIN media m ON m.id = p.main_media_id
      LEFT JOIN media f ON f.id = p.featured_media_id
     WHERE ${statusSql.replace('status', 'p.status')}
     ORDER BY p.sort_order, p.id`).map(p => ({
    ...p,
    tags: parseList(p.tags),
    tools: parseList(p.tools),
    gallery: all(`SELECT m.url, m.alt_text, pi.caption FROM project_images pi JOIN media m ON m.id = pi.media_id
                   WHERE pi.project_id = ? ORDER BY pi.sort_order, pi.id`, p.id),
  }));

  // Only categories that actually have visible projects get a filter button.
  const usedCats = new Set(projects.map(p => p.category_id).filter(Boolean));
  const categories = all('SELECT * FROM project_categories ORDER BY sort_order, id').filter(c => usedCats.has(c.id));

  const process = all(`SELECT * FROM process_steps WHERE ${statusSql} ORDER BY sort_order, id`);
  const services = all(`SELECT * FROM services WHERE ${statusSql} ORDER BY sort_order, id`)
    .map(s => ({ ...s, features: parseList(s.features), tools: parseList(s.tools), icon_url: mediaUrl(s.icon_media_id) }));
  const experiences = all(`SELECT * FROM experiences WHERE ${statusSql} ORDER BY sort_order, id`)
    .map(e => ({ ...e, responsibilities: parseList(e.responsibilities), tools: parseList(e.tools), logo_url: mediaUrl(e.logo_media_id) }));
  const education = all(`SELECT * FROM education WHERE ${statusSql} ORDER BY sort_order, id`)
    .map(e => ({ ...e, logo_url: mediaUrl(e.logo_media_id) }));
  const testimonials = all(`SELECT * FROM testimonials WHERE ${statusSql} ORDER BY sort_order, id`)
    .map(t => ({ ...t, avatar_url: mediaUrl(t.avatar_media_id), company_logo_url: mediaUrl(t.company_logo_media_id) }));
  const socials = all(`SELECT * FROM social_links WHERE ${statusSql} ORDER BY sort_order, id`);

  const resume = plain(db.prepare(`SELECT r.label, m.url FROM resumes r JOIN media m ON m.id = r.media_id
                                    WHERE r.is_active = 1`).get()) || null;

  return {
    preview,
    profile: { ...profile, profile_image_url: mediaUrl(profile.profile_media_id) },
    settings,
    sections,
    heroStats: stats.filter(s => s.placement === 'hero'),
    stripStats: stats.filter(s => s.placement === 'strip'),
    facts, skills, categories, projects, process, services, experiences, education, testimonials, socials, resume,
  };
}
