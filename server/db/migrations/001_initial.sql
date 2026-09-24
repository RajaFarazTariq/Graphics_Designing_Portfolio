-- =========================================================
-- 001 — Initial CMS schema
-- Every repeatable collection has: status (draft|published|unpublished),
-- sort_order (manual ordering) and created/updated timestamps.
-- Images/files are referenced through media(id) — never duplicated.
-- =========================================================

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL DEFAULT '',
  password_hash  TEXT NOT NULL,
  token_version  INTEGER NOT NULL DEFAULT 0,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  url            TEXT NOT NULL UNIQUE,           -- path as used by the public site, e.g. images/av-logo.jpg
  original_name  TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('image','document')),
  size           INTEGER NOT NULL DEFAULT 0,
  width          INTEGER,
  height         INTEGER,
  hash           TEXT UNIQUE,                    -- sha256, prevents duplicate uploads
  alt_text       TEXT NOT NULL DEFAULT '',
  is_original    INTEGER NOT NULL DEFAULT 0,     -- shipped with the repo: file is never removed from disk
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE profile (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  full_name            TEXT NOT NULL,
  job_title            TEXT NOT NULL DEFAULT '',
  signature_role       TEXT NOT NULL DEFAULT '',
  availability_status  TEXT NOT NULL DEFAULT '',
  short_intro          TEXT NOT NULL DEFAULT '',
  bio_lead             TEXT NOT NULL DEFAULT '',
  bio                  TEXT NOT NULL DEFAULT '',
  philosophy_title     TEXT NOT NULL DEFAULT '',
  philosophy_quote     TEXT NOT NULL DEFAULT '',
  city                 TEXT NOT NULL DEFAULT '',
  country_code         TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  phone_display        TEXT NOT NULL DEFAULT '',
  phone_intl           TEXT NOT NULL DEFAULT '',
  website              TEXT NOT NULL DEFAULT '',
  working_mode         TEXT NOT NULL DEFAULT '',
  profile_media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Page copy that is not a "person" field (hero headline, SEO, footer, marquee…)
CREATE TABLE site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                     -- JSON
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,                     -- admin label
  eyebrow     TEXT NOT NULL DEFAULT '',          -- "About Me" (number is added automatically)
  heading     TEXT NOT NULL DEFAULT '',          -- first line of the section title
  heading_em  TEXT NOT NULL DEFAULT '',          -- italic second line
  nav_label   TEXT NOT NULL DEFAULT '',          -- header menu text ('' = not in menu)
  in_footer   INTEGER NOT NULL DEFAULT 0,        -- listed under footer "Navigate"
  is_visible  INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0,        -- fixed page order (layout is locked)
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  placement   TEXT NOT NULL CHECK (placement IN ('hero','strip')),
  value       TEXT NOT NULL,
  suffix      TEXT NOT NULL DEFAULT '',
  label       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE facts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE skills (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  proficiency    INTEGER CHECK (proficiency BETWEEN 0 AND 100),
  icon_text      TEXT NOT NULL DEFAULT '',
  icon_bg        TEXT NOT NULL DEFAULT '',
  icon_shadow    TEXT NOT NULL DEFAULT '',
  icon_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  is_featured    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX skills_name_uq ON skills(name COLLATE NOCASE);

CREATE TABLE project_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,              -- used as data-filter / data-category
  label       TEXT NOT NULL,                     -- filter button text
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  short_description  TEXT NOT NULL DEFAULT '',
  full_description   TEXT NOT NULL DEFAULT '',
  category_id        INTEGER REFERENCES project_categories(id) ON DELETE SET NULL,
  client             TEXT NOT NULL DEFAULT '',
  project_date       TEXT,
  project_url        TEXT NOT NULL DEFAULT '',
  github_url         TEXT NOT NULL DEFAULT '',
  behance_url        TEXT NOT NULL DEFAULT '',
  dribbble_url       TEXT NOT NULL DEFAULT '',
  tags               TEXT NOT NULL DEFAULT '[]', -- JSON array
  tools              TEXT NOT NULL DEFAULT '[]', -- JSON array
  thumbnail_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  main_media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  featured_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  image_alt          TEXT NOT NULL DEFAULT '',
  is_featured        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  caption     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, media_id)
);

CREATE TABLE process_steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE services (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  features       TEXT NOT NULL DEFAULT '[]',     -- JSON array
  tools          TEXT NOT NULL DEFAULT '[]',     -- JSON array
  icon           TEXT NOT NULL DEFAULT 'globe',  -- built-in icon key
  icon_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  cta_label      TEXT NOT NULL DEFAULT 'Get a quote',
  cta_url        TEXT NOT NULL DEFAULT '#contact',
  is_featured    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE experiences (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  position          TEXT NOT NULL,
  company           TEXT NOT NULL DEFAULT '',
  company_url       TEXT NOT NULL DEFAULT '',
  location          TEXT NOT NULL DEFAULT '',
  start_date        TEXT,                        -- YYYY-MM
  end_date          TEXT,
  is_current        INTEGER NOT NULL DEFAULT 0,
  description       TEXT NOT NULL DEFAULT '',
  responsibilities  TEXT NOT NULL DEFAULT '[]',  -- JSON array
  tools             TEXT NOT NULL DEFAULT '[]',  -- JSON array
  logo_media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE education (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  institution     TEXT NOT NULL,
  degree          TEXT NOT NULL DEFAULT '',
  field_of_study  TEXT NOT NULL DEFAULT '',
  start_date      TEXT,
  end_date        TEXT,
  is_current      INTEGER NOT NULL DEFAULT 0,
  description     TEXT NOT NULL DEFAULT '',
  location        TEXT NOT NULL DEFAULT '',
  website         TEXT NOT NULL DEFAULT '',
  logo_media_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE testimonials (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name            TEXT NOT NULL,
  client_position        TEXT NOT NULL DEFAULT '',
  company                TEXT NOT NULL DEFAULT '',
  quote                  TEXT NOT NULL,
  rating                 INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  avatar_initials        TEXT NOT NULL DEFAULT '',
  avatar_bg              TEXT NOT NULL DEFAULT '',
  avatar_media_id        INTEGER REFERENCES media(id) ON DELETE SET NULL,
  company_logo_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  testimonial_date       TEXT,
  is_featured            INTEGER NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE social_links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  platform      TEXT NOT NULL,                   -- linkedin, behance, instagram, …, other
  label         TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL,
  show_on_site  INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','unpublished')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX social_links_url_uq ON social_links(url);

CREATE TABLE resumes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX resumes_one_active ON resumes(is_active) WHERE is_active = 1;

CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  ip          TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT NOT NULL,
  entity_id   INTEGER,
  title       TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX projects_order_idx ON projects(status, sort_order);
CREATE INDEX project_images_idx ON project_images(project_id, sort_order);
CREATE INDEX activity_log_idx ON activity_log(created_at DESC);
