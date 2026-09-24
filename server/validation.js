import { z } from 'zod';
import { SERVICE_ICONS, SOCIAL_PLATFORMS } from './render/icons.js';

// ---------- primitives ----------
export const text = (max = 500) => z.string({ error: 'Must be text' }).trim().max(max, `Keep it under ${max} characters`).default('');
export const required = (max = 500, label = 'This field') =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `Keep it under ${max} characters`);
export const bool = z.union([z.boolean(), z.number()]).transform(v => (v ? 1 : 0)).default(0);
export const status = z.enum(['draft', 'published', 'unpublished'], { error: 'Choose a valid status' }).default('published');
export const mediaId = z.union([z.number().int().positive(), z.null()]).default(null);

const isHttpUrl = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
/** Optional http(s) URL; '' allowed. */
export const url = z.string().trim().max(500).default('')
  .refine(v => v === '' || isHttpUrl(v), 'Enter a full URL starting with https://');
export const email = z.string().trim().max(200).default('')
  .refine(v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address');
/** Link used on the page: #anchor, mailto:, tel: or http(s). */
export const link = z.string().trim().max(500).default('')
  .refine(v => v === '' || /^#[\w-]*$/.test(v) || /^(mailto|tel):\S+$/.test(v) || isHttpUrl(v),
    'Use a #section link, mailto:/tel: link or a full https:// URL');
/** YYYY-MM or YYYY-MM-DD, or null. */
export const month = z.union([z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Use a valid date'), z.literal(''), z.null()])
  .transform(v => v || null).default(null);
export const list = (maxItems = 30, maxLen = 120) =>
  z.array(z.string().trim().max(maxLen)).max(maxItems, `At most ${maxItems} items`)
    .transform(a => [...new Set(a.filter(Boolean))]).default([]);
/** CSS value used inside an inline style attribute — no characters that could break out of it. */
export const cssValue = z.string().trim().max(200).default('')
  .refine(v => !/[;{}<>"\\]|url\s*\(|expression|javascript:/i.test(v), 'Only plain colors or gradients are allowed');

const dateOrder = (d) => !d.start_date || !d.end_date || d.is_current || d.end_date >= d.start_date;

// ---------- collections ----------
export const schemas = {
  skills: z.object({
    name: required(60, 'Skill name'),
    category: text(60),
    description: text(300),
    proficiency: z.union([z.number().int().min(0, 'Min 0').max(100, 'Max 100'), z.null()]).default(null),
    icon_text: text(4),
    icon_bg: cssValue,
    icon_shadow: cssValue,
    icon_media_id: mediaId,
    is_featured: bool,
    status,
  }),

  project_categories: z.object({
    label: required(60, 'Category name'),
    slug: z.string().trim().max(40).regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and dashes only').default(''),
  }),

  projects: z.object({
    title: required(140, 'Title'),
    slug: z.string().trim().max(80).regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and dashes only').default(''),
    short_description: required(400, 'Short description'),
    full_description: text(5000),
    category_id: z.union([z.number().int().positive(), z.null()]).default(null),
    client: text(120),
    project_date: month,
    project_url: url,
    github_url: url,
    behance_url: url,
    dribbble_url: url,
    tags: list(8, 40),
    tools: list(12, 40),
    thumbnail_media_id: mediaId,
    main_media_id: mediaId,
    featured_media_id: mediaId,
    image_alt: text(200),
    is_featured: bool,
    status: status.default('draft'),
    gallery: z.array(z.object({ media_id: z.number().int().positive(), caption: text(200) })).max(40, 'At most 40 gallery images').default([]),
  }).refine(p => p.status !== 'published' || p.thumbnail_media_id || p.main_media_id,
    { path: ['thumbnail_media_id'], message: 'A published project needs a thumbnail or main image' }),

  services: z.object({
    title: required(80, 'Title'),
    description: required(500, 'Description'),
    features: list(8, 40),
    tools: list(12, 40),
    icon: z.enum(Object.keys(SERVICE_ICONS)).default('globe'),
    icon_media_id: mediaId,
    cta_label: text(40).transform(v => v || 'Get a quote'),
    cta_url: link.transform(v => v || '#contact'),
    is_featured: bool,
    status,
  }),

  experiences: z.object({
    position: required(120, 'Position'),
    company: text(120),
    company_url: url,
    location: text(120),
    start_date: month,
    end_date: month,
    is_current: bool,
    description: required(800, 'Description'),
    responsibilities: list(20, 300),
    tools: list(20, 40),
    logo_media_id: mediaId,
    status,
  }).refine(dateOrder, { path: ['end_date'], message: 'End date must be after the start date' })
    .transform(d => (d.is_current ? { ...d, end_date: null } : d)),

  education: z.object({
    institution: required(160, 'Institution'),
    degree: text(160),
    field_of_study: text(160),
    start_date: month,
    end_date: month,
    is_current: bool,
    description: text(1500),
    location: text(120),
    website: url,
    logo_media_id: mediaId,
    status,
  }).refine(dateOrder, { path: ['end_date'], message: 'End date must be after the start date' })
    .transform(d => (d.is_current ? { ...d, end_date: null } : d)),

  testimonials: z.object({
    client_name: required(80, 'Client name'),
    client_position: text(80),
    company: text(80),
    quote: required(1000, 'Testimonial'),
    rating: z.number().int().min(1).max(5).default(5),
    avatar_initials: text(3),
    avatar_bg: cssValue,
    avatar_media_id: mediaId,
    company_logo_media_id: mediaId,
    testimonial_date: month,
    is_featured: bool,
    status,
  }).transform(t => ({
    ...t,
    avatar_initials: t.avatar_initials || t.client_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    avatar_bg: t.avatar_bg || 'linear-gradient(135deg,#FF5A36,#FFB199)',
  })),

  social_links: z.object({
    platform: z.enum(Object.keys(SOCIAL_PLATFORMS), { error: 'Choose a platform' }),
    label: text(60),
    url: z.string().trim().min(1, 'URL is required').max(500)
      .refine(v => isHttpUrl(v) || /^mailto:\S+@\S+$/.test(v), 'Enter a full https:// URL (or mailto: for email)'),
    show_on_site: bool.default(1),
    status,
  }),

  process_steps: z.object({
    title: required(60, 'Title'),
    description: required(400, 'Description'),
    status,
  }),

  stats: z.object({
    placement: z.enum(['hero', 'strip']),
    value: required(10, 'Value'),
    suffix: z.string().max(6, 'Keep the suffix short').default(''),
    label: required(60, 'Label'),
    status,
  }).refine(s => s.placement !== 'strip' || /^\d+(\.\d+)?$/.test(s.value),
    { path: ['value'], message: 'Stats strip values must be numbers (they animate as a counter)' }),

  facts: z.object({
    label: required(40, 'Label'),
    value: required(80, 'Value'),
    status,
  }),
};

// ---------- singletons ----------
export const profileSchema = z.object({
  full_name: required(80, 'Name'),
  job_title: required(80, 'Professional title'),
  signature_role: text(80),
  availability_status: text(80),
  short_intro: required(400, 'Short introduction'),
  bio_lead: required(800, 'Intro paragraph'),
  bio: text(5000),
  philosophy_title: text(80),
  philosophy_quote: text(400),
  city: text(80),
  country_code: text(3),
  email: z.string().trim().min(1, 'Email is required').max(200)
    .refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address'),
  phone_display: text(40),
  phone_intl: z.string().trim().max(40).default('').refine(v => v === '' || /^\+?[\d\s()-]{6,}$/.test(v), 'Use digits, spaces, dashes and an optional leading +'),
  website: url,
  working_mode: text(80),
  profile_media_id: mediaId,
});

export const settingsSchemas = {
  seo: z.object({
    title: required(160, 'Page title'),
    description: required(320, 'Meta description'),
    keywords: text(400),
    canonical_url: url.refine(v => v !== '', 'Site URL is required'),
    theme_color: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, 'Use a hex color like #0B0B14'),
    og_site_name: text(120),
    og_title: text(160),
    og_description: text(320),
    og_image: text(300),
    og_image_alt: text(200),
    twitter_title: text(160),
    twitter_description: text(320),
    person_description: text(400),
    knows_about: list(20, 60),
  }),
  branding: z.object({
    logo_mark: required(2, 'Logo letter'),
    logo_text: required(30, 'Logo text'),
    loader_tagline: text(60),
  }),
  hero: z.object({
    headline: required(200, 'Headline').refine(v => v.split(/\s+/).filter(Boolean).length <= 5,
      'The animated headline supports up to 5 words (the existing animation has 5 steps)'),
    primary_cta: required(30, 'Button text'),
    secondary_cta: required(30, 'Button text'),
    cv_cta: required(30, 'Button text'),
  }),
  about: z.object({
    resume_cta: required(40, 'Button text'),
    facts_title: required(40, 'Title'),
  }),
  marquee: z.object({ items: list(12, 40) }),
  work: z.object({ all_label: required(30, 'Label') }),
  contact: z.object({
    lead_before: text(300),
    lead_highlight: text(40),
    lead_after: text(200),
    form_access_key: text(80),
    form_from_name: text(80),
    form_subject: text(160),
    store_messages: z.boolean().default(true),
  }),
  footer: z.object({
    blurb: text(300),
    availability: text(120),
    credit: text(120),
  }),
};

export const sectionSchema = z.object({
  eyebrow: text(60),
  heading: text(120),
  heading_em: text(120),
  nav_label: text(30),
  in_footer: bool,
  is_visible: bool,
});

export const messageSchema = z.object({
  name: required(100, 'Name'),
  email: z.string().trim().max(200).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address'),
  subject: text(200),
  message: required(5000, 'Message'),
  botcheck: z.any().optional(),
});

/** Parses or throws a 400 with per-field messages. */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  const err = new Error(Object.values(fields)[0] || 'Please check the highlighted fields.');
  err.status = 400;
  err.fields = fields;
  throw err;
}
