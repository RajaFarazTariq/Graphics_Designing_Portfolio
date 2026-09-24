import { Router } from 'express';
import { loadContent } from '../render/content.js';
import { messageSchema, parse } from '../validation.js';
import { rateLimiter } from '../auth.js';
import { logActivity } from '../db/index.js';

const messageLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 5, message: 'Too many messages. Please try again later.' });

const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

export function publicRouter(db) {
  const router = Router();

  // Read-only JSON of everything that is published (no drafts, no admin data).
  router.get('/content', (req, res) => {
    const c = loadContent(db);
    const { form_access_key, store_messages, ...contactCopy } = c.settings.contact;
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      profile: pick(c.profile, ['full_name', 'job_title', 'signature_role', 'availability_status', 'short_intro', 'bio_lead', 'bio',
        'philosophy_title', 'philosophy_quote', 'city', 'country_code', 'email', 'phone_display', 'phone_intl', 'website',
        'working_mode', 'profile_image_url']),
      settings: { ...c.settings, contact: contactCopy },
      sections: Object.values(c.sections).map(s => pick(s, ['key', 'eyebrow', 'heading', 'heading_em', 'nav_label', 'is_visible'])),
      heroStats: c.heroStats.map(s => pick(s, ['value', 'suffix', 'label'])),
      stats: c.stripStats.map(s => pick(s, ['value', 'suffix', 'label'])),
      facts: c.facts.map(f => pick(f, ['label', 'value'])),
      skills: c.skills.map(s => pick(s, ['name', 'category', 'description', 'proficiency', 'icon_text', 'icon_url', 'is_featured'])),
      categories: c.categories.map(x => pick(x, ['slug', 'label'])),
      projects: c.projects.map(p => ({
        ...pick(p, ['title', 'slug', 'short_description', 'full_description', 'client', 'project_date', 'project_url', 'github_url',
          'behance_url', 'dribbble_url', 'tags', 'tools', 'thumbnail_url', 'main_url', 'featured_url', 'image_alt', 'is_featured',
          'category_slug', 'category_label']),
        gallery: p.gallery,
      })),
      process: c.process.map(s => pick(s, ['title', 'description'])),
      services: c.services.map(s => pick(s, ['title', 'description', 'features', 'tools', 'icon', 'icon_url', 'cta_label', 'cta_url', 'is_featured'])),
      experience: c.experiences.map(e => pick(e, ['position', 'company', 'company_url', 'location', 'start_date', 'end_date', 'is_current',
        'description', 'responsibilities', 'tools', 'logo_url'])),
      education: c.education.map(e => pick(e, ['institution', 'degree', 'field_of_study', 'start_date', 'end_date', 'is_current',
        'description', 'location', 'website', 'logo_url'])),
      testimonials: c.testimonials.map(t => pick(t, ['client_name', 'client_position', 'company', 'quote', 'rating', 'avatar_initials',
        'avatar_url', 'company_logo_url', 'testimonial_date', 'is_featured'])),
      socials: c.socials.map(s => pick(s, ['platform', 'label', 'url'])),
      resume: c.resume,
    });
  });

  // Copy of contact-form submissions for the admin inbox (the email delivery via Web3Forms is unchanged).
  router.post('/messages', (req, res) => {
    const contact = loadContent(db).settings.contact;
    if (!contact.store_messages) return res.status(202).json({ ok: true, stored: false });
    if (req.body?.botcheck) return res.status(202).json({ ok: true, stored: false });
    const limited = messageLimiter(req.ip);
    if (limited) return res.status(429).json({ error: limited.message });
    const data = parse(messageSchema, req.body);
    const info = db.prepare('INSERT INTO messages (name, email, subject, message, ip) VALUES (?, ?, ?, ?, ?)')
      .run(data.name, data.email, data.subject, data.message, String(req.ip || '').slice(0, 64));
    logActivity(db, 'messages', Number(info.lastInsertRowid), `Message from ${data.name}`, 'received');
    res.status(201).json({ ok: true, stored: true });
  });

  return router;
}
