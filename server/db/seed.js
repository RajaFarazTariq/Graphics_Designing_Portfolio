// =========================================================
// First-run import of the content that was hardcoded in index.html.
// Runs only when the database has no profile row, so it never
// overwrites anything edited in the Admin Panel.
// =========================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { imageSize } from 'image-size';
import { ROOT_DIR } from '../config.js';
import { transaction, setSetting } from './index.js';

export const DEFAULT_SITE_SETTINGS = {
  seo: {
    title: 'Aatiqa Aslam — Creative Graphic Designer · Logo, Brand & Visual Identity',
    description: 'Aatiqa Aslam is a creative graphic designer based in Islamabad, crafting thoughtful logos, brand identities, social media content, and print design for clients worldwide.',
    keywords: 'Aatiqa Aslam, graphic designer, logo design, brand identity, social media design, book cover design, freelance designer, Pakistan, Islamabad',
    canonical_url: 'https://aatiqaaslam.com/',
    theme_color: '#0B0B14',
    og_site_name: 'Aatiqa Aslam — Portfolio',
    og_title: 'Aatiqa Aslam — Creative Graphic Designer',
    og_description: 'Crafting thoughtful logos, brand identities, social media, and print design from Islamabad — for clients worldwide.',
    og_image: 'og-image.jpg',
    og_image_alt: 'Aatiqa Aslam — Creative Graphic Designer based in Islamabad',
    twitter_title: 'Aatiqa Aslam — Creative Graphic Designer',
    twitter_description: 'Crafting thoughtful logos, brand identities, social media, and print design from Islamabad.',
    person_description: 'Freelance graphic designer specializing in logo design, brand identity, social media content, and print design.',
    knows_about: ['Logo Design', 'Brand Identity', 'Social Media Design', 'Print Design', 'Visual Identity', 'Typography'],
  },
  branding: {
    logo_mark: 'A',
    logo_text: 'atiqa',
    loader_tagline: 'Crafting visual stories',
  },
  hero: {
    headline: 'Crafting *visual*\nstories that\n*resonate.*',
    primary_cta: 'View Projects',
    secondary_cta: 'Hire Me',
    cv_cta: 'Download CV',
  },
  about: {
    resume_cta: 'View Full Resume',
    facts_title: 'Quick Facts',
  },
  marquee: {
    items: ['Branding', 'Logo Design', 'Visual Identity', 'Print Design', 'Social Media', 'Typography'],
  },
  work: {
    all_label: 'All Work',
  },
  contact: {
    lead_before: "Got a project in mind? I'd love to hear about it. Send a brief and I'll get back within",
    lead_highlight: '24 hours',
    lead_after: '.',
    form_access_key: 'a7187cb9-c10d-4014-a758-a3a3c44f42c7',
    form_from_name: 'Portfolio Contact Form',
    form_subject: 'New inquiry from your portfolio site',
    store_messages: true,
  },
  footer: {
    blurb: 'Freelance graphic designer crafting visuals worth remembering. Based in Islamabad — working worldwide.',
    availability: 'Available for freelance projects worldwide',
    credit: 'Designed & built with care.',
  },
};

const SECTIONS = [
  // key, name, eyebrow, heading, heading_em, nav_label, in_footer
  ['marquee',      'Marquee strip',     '',               '',                         '',                         '',         0],
  ['about',        'About',             'About Me',       'A designer obsessed with', 'crafting brands that resonate.', 'About', 1],
  ['skills',       'Tools & Skills',    'Tools & Skills', 'The toolkit behind',       'every project.',           'Skills',   1],
  ['stats',        'Stats strip',       '',               '',                         '',                         '',         0],
  ['work',         'Projects (Work)',   'Selected Work',  'A glimpse of my',          'recent projects.',         'Work',     1],
  ['process',      'Process',           'How I Work',     'From brief to',            'brand, in 4 steps.',       '',         0],
  ['services',     'Services',          'Services',       'What I can help',          'you build.',               'Services', 1],
  ['experience',   'Experience',        'Experience',     'A short',                  'creative journey.',        '',         0],
  ['testimonials', 'Testimonials',      'Testimonials',   'Kind words from',          'kind clients.',            'Reviews',  0],
  ['contact',      'Contact',           'Contact',        "Let's create",             'something great.',         'Contact',  1],
];

const GRADIENTS = {
  ps: 'linear-gradient(135deg,#001E36,#31A8FF)',
  ai: 'linear-gradient(135deg,#330000,#FF9A00)',
  fg: 'linear-gradient(135deg,#1ABCFE,#0ACF83 40%,#F24E1E 70%,#A259FF)',
  cv: 'linear-gradient(135deg,#00C4CC,#7D2AE8)',
};

const PROJECTS = [
  ['logo', 'av-logo.jpg', 'AV monogram logo', ['Logo', 'Monogram'], 'AV — Monogram Logo', 'A bold metallic monogram on a textured dark surface, exploring depth and refined letterform construction.', ['Illustrator', 'Photoshop']],
  ['logo', 'dk-logo.jpg', 'DK logo design', ['Logo', 'Mark'], 'DK — Brand Logo', 'A confident lettermark balancing clean geometry with character — designed to read instantly at any scale.', ['Illustrator', 'Photoshop']],
  ['logo', 'la-logo.jpg', 'LA logo design', ['Logo', 'Lettermark'], 'LA — Identity Mark', 'A polished lettermark presented on a premium mockup, with attention to spacing, weight and visual rhythm.', ['Illustrator', 'Photoshop']],
  ['logo', 'lb-logo.jpg', 'LB logo design', ['Logo', 'Lettermark'], 'LB — Brand Mark', 'A clean, modern LB mark designed with a focus on legibility and a contemporary visual feel.', ['Illustrator', 'Photoshop']],
  ['logo', 'n-logo.jpg', 'N letter logo', ['Logo', 'Letter'], 'N — Letter Logo', 'A crisp single-letter mark engineered for versatility — works equally well in print, screen and signage.', ['Illustrator', 'Photoshop']],
  ['logo', 'tri-logo.jpg', 'Tri triangle logo', ['Logo', 'Geometric'], 'Tri — Geometric Mark', 'A minimal geometric mark built around a triangular form — a study in precision and balance.', ['Illustrator', 'Photoshop']],
  ['logo', 'triangle-logo-1.jpg', 'Triangle logo concept', ['Logo', 'Concept'], 'Triangle — Concept Logo', 'An exploratory logo built around a triangular silhouette, focused on form, negative space and silhouette.', ['Illustrator', 'Photoshop']],
  ['logo', 'zaini.jpg', 'Zaini Nisar wordmark logo', ['Logo', 'Wordmark'], 'Zaini Nisar — Wordmark', 'A distinctive Z-form logo paired with a custom wordmark — a personal brand mark with a confident, modern feel.', ['Illustrator', 'Photoshop']],
  ['branding', 'aatiqa-menu-food.jpg', 'Fast food restaurant menu design', ['Brand Identity', 'Menu Design'], 'Fast Food — Restaurant Menu', 'A vibrant restaurant menu layout pairing rich food imagery with clear typographic hierarchy across categories.', ['Photoshop', 'Illustrator']],
  ['social', '28-may-post-1.jpg', 'Youm-e-Taqbeer 28 May social media poster', ['Social Media', 'Poster'], 'Youm-e-Taqbeer — 28 May', "A patriotic social media post commemorating Pakistan's Day of Power, blending photography and bold typography.", ['Photoshop']],
  ['social', 'jummah-tul-widha-post.jpg', 'Jummah-Tul-Wida Mubarak social post', ['Social Media', 'Religious'], 'Jummah-Tul-Wida Mubarak', 'A serene religious post built around mosque architecture, calligraphy and gentle typographic spacing.', ['Photoshop']],
  ['cover', 'book-cover.jpg', 'The History of Palestine book cover design', ['Book Cover', 'Print'], 'The History of Palestine — Book Cover', 'A full front-and-back book cover concept combining photo composition, typography and emotional storytelling.', ['Photoshop', 'Illustrator']],
];

export function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

/** Registers a file that already exists in the repo (never moved or copied). */
function registerOriginalFile(db, relUrl, altText = '') {
  const abs = path.join(ROOT_DIR, relUrl);
  if (!fs.existsSync(abs)) return null;
  const existing = db.prepare('SELECT id FROM media WHERE url = ?').get(relUrl);
  if (existing) return existing.id;
  const buf = fs.readFileSync(abs);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const isPdf = relUrl.toLowerCase().endsWith('.pdf');
  let width = null, height = null;
  if (!isPdf) {
    try { ({ width, height } = imageSize(buf)); } catch { /* keep null */ }
  }
  const info = db.prepare(`INSERT INTO media (url, original_name, mime_type, kind, size, width, height, hash, alt_text, is_original)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
    relUrl, path.basename(relUrl), isPdf ? 'application/pdf' : 'image/jpeg', isPdf ? 'document' : 'image',
    buf.length, width, height, hash, altText);
  return Number(info.lastInsertRowid);
}

export function seedIfEmpty(db) {
  const hasProfile = db.prepare('SELECT 1 FROM profile WHERE id = 1').get();
  if (hasProfile) return false;

  transaction(db, () => {
    // ---- Media (existing repo files) ----
    const mediaIds = {};
    for (const p of PROJECTS) mediaIds[p[1]] = registerOriginalFile(db, `images/${p[1]}`, p[2]);
    registerOriginalFile(db, 'og-image.jpg', DEFAULT_SITE_SETTINGS.seo.og_image_alt);
    const resumeMedia = registerOriginalFile(db, 'aatiqa-aslam-resume.pdf');

    // ---- Profile ----
    db.prepare(`INSERT INTO profile (id, full_name, job_title, signature_role, availability_status, short_intro,
      bio_lead, bio, philosophy_title, philosophy_quote, city, country_code, email, phone_display, phone_intl,
      website, working_mode) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'Aatiqa Aslam',
      'Creative Graphic Designer',
      'Creative Director',
      'Available for freelance · 2026',
      'a creative graphic designer building thoughtful logos, brand identities, and social media content from my studio in Islamabad, for clients worldwide.',
      "Hi, I'm Aatiqa — a passionate graphic designer working remotely as a freelancer, helping individuals and small businesses bring their visual ideas to life from logos to social media to polished cover letters.",
      "My work focuses on clarity, balance, and a clean modern aesthetic. I believe good design isn't just about looking nice — it's about communicating a message clearly and confidently. Every project, big or small, gets the same care and attention to detail.",
      'Design Philosophy',
      '"Design is intelligence made visible. I create with intention — every line, color, and curve serves the story."',
      'Islamabad', 'PK',
      'aatiqaaslam14@gmail.com',
      '0315-5299918',
      '+92-315-5299918',
      'https://aatiqaaslam.com/',
      'Remote · Worldwide',
    );

    // ---- Site settings ----
    for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS)) setSetting(db, key, value);

    // ---- Sections ----
    const insSection = db.prepare(`INSERT INTO sections (key, name, eyebrow, heading, heading_em, nav_label, in_footer, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    SECTIONS.forEach((s, i) => insSection.run(...s, i));

    // ---- Stats ----
    const insStat = db.prepare('INSERT INTO stats (placement, value, suffix, label, sort_order) VALUES (?, ?, ?, ?, ?)');
    [['20', '+', 'Projects Shipped'], ['2', '+', 'Years Crafting'], ['5', '★', 'Client Rating']]
      .forEach((s, i) => insStat.run('hero', ...s, i));
    [['20', '+', 'Projects completed'], ['5', '+', 'Happy clients'], ['4', ' hr', 'Avg. response time'], ['2', '+', 'Years of experience']]
      .forEach((s, i) => insStat.run('strip', ...s, i));

    // ---- Quick facts ----
    const insFact = db.prepare('INSERT INTO facts (label, value, sort_order) VALUES (?, ?, ?)');
    [['Based in', 'Islamabad, PK'], ['Working', 'Remote · Worldwide'], ['Response', '~ 4 hours'], ['Languages', 'English · Urdu']]
      .forEach((f, i) => insFact.run(...f, i));

    // ---- Skills ----
    const insSkill = db.prepare(`INSERT INTO skills (name, category, description, proficiency, icon_text, icon_bg, icon_shadow, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`);
    [
      ['Photoshop', 'Design Software', 'Composites, mockups, retouching, social media artwork.', 95, 'Ps', GRADIENTS.ps, 'rgba(0, 150, 255, 0.55)'],
      ['Illustrator', 'Design Software', 'Logo systems, vector marks, scalable identity assets.', 92, 'Ai', GRADIENTS.ai, 'rgba(255, 154, 0, 0.55)'],
      ['Figma', 'Design Software', 'UI exploration, brand decks, collaborative design systems.', 88, 'Fg', GRADIENTS.fg, 'rgba(242, 78, 30, 0.55)'],
      ['Canva', 'Design Software', 'Rapid social templates, content kits, presentation design.', 96, 'Cv', GRADIENTS.cv, 'rgba(0, 200, 187, 0.55)'],
    ].forEach((s, i) => insSkill.run(...s, i));

    // ---- Project categories + projects ----
    const insCat = db.prepare('INSERT INTO project_categories (slug, label, sort_order) VALUES (?, ?, ?)');
    const catIds = {};
    [['logo', 'Logos'], ['branding', 'Brand Identity'], ['social', 'Social Media'], ['cover', 'Book Cover']]
      .forEach(([slug, label], i) => { catIds[slug] = Number(insCat.run(slug, label, i).lastInsertRowid); });

    const insProject = db.prepare(`INSERT INTO projects (title, slug, short_description, category_id, tags, tools,
      thumbnail_media_id, main_media_id, image_alt, is_featured, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'published', ?)`);
    const insProjectImage = db.prepare('INSERT INTO project_images (project_id, media_id, sort_order) VALUES (?, ?, 0)');
    PROJECTS.forEach(([cat, file, alt, tags, title, desc, tools], i) => {
      const mid = mediaIds[file] ?? null;
      const pid = Number(insProject.run(title, slugify(title), desc, catIds[cat], JSON.stringify(tags), JSON.stringify(tools),
        mid, mid, alt, i).lastInsertRowid);
      if (mid) insProjectImage.run(pid, mid);
    });

    // ---- Process ----
    const insStep = db.prepare('INSERT INTO process_steps (title, description, sort_order) VALUES (?, ?, ?)');
    [
      ['Discover', "We talk through your story, audience, references, and goals — what you love, what you don't."],
      ['Define', 'I translate the brief into a clear creative direction, mood, and design narrative to align on.'],
      ['Design', 'I craft thoughtful options, iterate on your feedback, and refine until every detail feels right.'],
      ['Deliver', 'Final files in every format you need — print-ready, web-ready, with a clean brand kit.'],
    ].forEach((s, i) => insStep.run(...s, i));

    // ---- Services ----
    const insService = db.prepare(`INSERT INTO services (title, description, features, icon, is_featured, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)`);
    [
      ['Logo Design', 'Memorable, versatile logos built around your story — custom marks designed to make your brand instantly recognizable.', ['Multiple concepts', 'Vector files', 'Mini brand kit'], 'globe'],
      ['Brand Identity', 'Cohesive visual systems including logo, color palette, typography, and a polished brand guideline document.', ['Logo', 'Palette', 'Typography', 'Guidelines'], 'grid'],
      ['Social Media Design', 'Eye-catching Instagram posts, banners, and story templates designed to grow your audience and engagement.', ['Post grids', 'Stories', 'Banners'], 'instagram'],
      ['Cover Letter Design', 'Professional, polished cover letters with clean layouts that help you stand out and make a strong first impression.', ['Layout', 'Typography', 'Print-ready'], 'document'],
    ].forEach(([t, d, f, icon], i) => insService.run(t, d, JSON.stringify(f), icon, i));

    // ---- Experience ----
    const insExp = db.prepare('INSERT INTO experiences (position, description, is_current, sort_order) VALUES (?, ?, ?, ?)');
    [
      ['Freelance Graphic Designer', 'Working remotely with clients worldwide on logos, brand identities, social content, and print collateral.', 0],
      ['Brand Identity Specialist', 'Focused deeply on identity systems — refined a personal craft for logo construction and visual systems.', 0],
      ['Started Designing Professionally', 'Began taking on client work — social media artwork, posters, and small-business identity projects.', 0],
    ].forEach((e, i) => insExp.run(...e, i));

    // ---- Testimonials ----
    const insT = db.prepare(`INSERT INTO testimonials (client_name, client_position, company, quote, rating, avatar_initials, avatar_bg, is_featured, sort_order)
      VALUES (?, ?, ?, ?, 5, ?, ?, 1, ?)`);
    [
      ['Zaini Nisar', 'Founder', 'Personal Brand', 'Aatiqa understood my vision instantly and delivered a logo that captured exactly what I wanted. The whole process was smooth and she was always quick to respond.', 'ZN', 'linear-gradient(135deg,#FF5A36,#FFB199)'],
      ['Hassan Raza', 'Author', 'Independent Publisher', "The book cover Aatiqa designed for me was striking and emotionally powerful — it captured the spirit of the story perfectly. I'd recommend her to anyone who values thoughtful design.", 'HR', 'linear-gradient(135deg,#8E7BFF,#5BE0FF)'],
      ['Sara Malik', 'Brand Owner', 'Lifestyle Studio', "Aatiqa transformed my Instagram presence with a beautiful, cohesive design. Affordable, talented, and a pleasure to work with — exactly the freelancer I'd been searching for.", 'SM', 'linear-gradient(135deg,#4ADE80,#0F2A2E)'],
    ].forEach((t, i) => insT.run(...t, i));

    // ---- Resume ----
    if (resumeMedia) {
      db.prepare('INSERT INTO resumes (media_id, label, is_active) VALUES (?, ?, 1)').run(resumeMedia, 'Aatiqa Aslam — Resume');
    }

    db.prepare("INSERT INTO activity_log (entity, title, action) VALUES ('system', 'Imported existing portfolio content', 'seeded')").run();
  });
  console.log('[db] imported existing portfolio content');
  return true;
}
