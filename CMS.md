# Portfolio Admin Panel (CMS)

The portfolio's content — profile, projects, skills, services, experience, testimonials, résumé, section visibility, SEO text — is managed from an admin panel at **`/admin`**. No code editing is needed for normal content updates.

**The public design is locked.** The server rebuilds the exact markup of the original hand-written `index.html` from the database, so `styles.css`, `script.js`, `hero-scene.js`, all animations and responsive behaviour are untouched. Admin changes only change *data*.

---

## Quick start

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`; no native modules).

```bash
npm install          # server dependencies
npm run build        # installs + builds the admin panel (admin/dist)
npm start            # http://localhost:3000  and  http://localhost:3000/admin
```

On first start the server:

1. creates `data/cms.sqlite` and runs the migrations,
2. imports every piece of content that was hardcoded in `index.html` (nothing is deleted or moved — existing images and the résumé stay where they are),
3. creates the admin account and prints the email + a generated password. The password is also saved to `data/initial-admin-password.txt`; that file is deleted automatically the first time you change your password in **Admin Settings**.

To choose the credentials yourself, set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before the first start.

Forgot the password? On the server: `npm run reset-password -- you@example.com NewPassword123`

### Development

```bash
npm run dev          # API + site with auto-restart (port 3000)
npm run admin:dev    # admin panel with hot reload on http://localhost:5173/admin/ (proxies the API)
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | – | set to `production` for secure (HTTPS-only) cookies |
| `JWT_SECRET` | auto-generated in `data/.jwt-secret` | session signing key — set it explicitly in production |
| `SESSION_HOURS` | `12` | admin session length |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | profile email + generated password | first admin account |
| `DATA_DIR`, `UPLOAD_DIR`, `DB_PATH` | `./data`, `./uploads` | where the database and uploaded files live |
| `TRUST_PROXY` | – | set to `1` behind a reverse proxy / load balancer (correct client IPs for rate limiting) |

---

## What can be managed

| Admin page | Controls on the site |
|---|---|
| **Profile** | Name, title, availability pill, hero intro, About texts & philosophy quote, email/phone/working mode, profile image · **Highlights & facts**: hero numbers, animated stats strip, Quick Facts card |
| **Projects** | The "Selected Work" grid: create / edit / duplicate / delete / reorder (drag & drop) / publish / feature, thumbnail + main + featured image, multi-image gallery (upload, reorder, replace, remove, captions), tags, tools, client, date, links. **Categories** = the filter buttons |
| **Skills** | Tool cards: name, description, proficiency bar, icon letters / gradient / glow or an icon image, featured, order |
| **Experience** | Timeline entries; dates and company appear in the timeline's built-in year style when filled in |
| **Education** | Stored and exposed via the API (the current design has no Education section, so nothing is added to the page) |
| **Services** | Service cards (numbers are automatic), feature bullets, icon (line-icon set matching the design, or an image), button text/link |
| **Process** | "How I Work" steps |
| **Testimonials** | Quote, rating, name, position/company, avatar initials + colour or photo |
| **Social Links** | Any platform; "Show on site" links appear as icon buttons in the Contact section using the site's pre-existing `.socials` style. All are added to SEO structured data |
| **Media Library** | Upload (drag & drop, multiple), search, preview, alt text, usage ("used in…"), delete (blocked while in use). Identical files are detected by hash and reused, never duplicated |
| **Resume / CV** | Upload, replace, rename, set active, view/download, delete. The CV buttons always link to the active one (and hide when none is active) |
| **Messages** | Copy of every contact-form submission (email delivery via Web3Forms is unchanged) |
| **Section Settings** | Show/hide each section; edit its label and heading; menu/footer links follow automatically; section numbers (01, 02…) re-number automatically |
| **Site Settings** | Hero headline & buttons, logo text, loader tagline, marquee words, contact-form texts & Web3Forms key, footer texts, SEO / Open Graph / structured data |
| **Admin Settings** | Sign-in email, display name, password change |

**Draft / Published / Unpublished** — every repeatable item has a status. Only *published* items appear on the site. **Preview** (top bar, or "Save & preview" in the project editor) opens `/preview`: the real site design including drafts, visible only to signed-in admins.

---

## Architecture

```
index.html, styles.css, script.js, hero-scene.js, images/   ← original site (design source, unchanged*)
server/
  index.js              start-up: migrate → import original content (first run) → create admin → listen
  app.js                routes, security headers, static allowlist
  auth.js               bcrypt passwords, JWT in httpOnly SameSite=Strict cookie, rate limiting
  validation.js         zod schemas for every content type
  db/migrations/*.sql   schema (applied in order, tracked in schema_migrations)
  db/seed.js            one-time import of the content that was hardcoded in index.html
  render/content.js     loads published content
  render/portfolio.js   renders the original markup from that content
  routes/admin.js       /api/admin/*   (authenticated)
  routes/collections.js generic CRUD: list/search/filter/paginate, create, update, patch, delete, reorder, duplicate
  routes/media.js       uploads (content-sniffed), de-duplication, usage tracking
  routes/public.js      /api/public/content (published JSON), /api/public/messages
admin/                  React admin panel (Vite) → built to admin/dist, served at /admin
data/                   SQLite database + secrets        (git-ignored)
uploads/                uploaded files                   (git-ignored)
```

\* `script.js` received two additive, non-visual changes: the project popup uses a project's *main image* / *full description* when set, and contact-form submissions are also POSTed to the admin inbox (best-effort; the Web3Forms email flow is unchanged).

**Database tables:** `users`, `profile`, `site_settings`, `sections`, `stats`, `facts`, `skills`, `project_categories`, `projects`, `project_images`, `process_steps`, `services`, `experiences`, `education`, `testimonials`, `social_links`, `media`, `resumes`, `messages`, `activity_log`. Images are referenced by `media.id` everywhere, so one file can be reused in many places.

### Verifying the design is unchanged

```bash
npm run verify:ui
```

Imports the original content into a throw-away database, renders the page, and compares it token-by-token with the original `index.html` (plus the JSON-LD as data). It passes with **0 differences**. `npm run verify:ui -- --live` renders your live database instead, to see what your edits changed.

### Security

- Admin routes require a valid session; the API returns 401 and the panel redirects to login. `/preview` is admin-only.
- Passwords: bcrypt (cost 12), min. 10 characters with letters and numbers. Changing the password signs out all other sessions.
- Login: 5 failures per email+IP (20 per IP) per 15 minutes, then locked — even correct passwords are refused during the lockout. Unknown emails take the same time as known ones.
- CSRF: `SameSite=Strict` cookie **and** a required `X-Requested-With` header on every state-changing admin request.
- Uploads: type detected from file contents (JPG, PNG, WebP, GIF, AVIF, PDF only), 10 MB images / 15 MB PDFs, random-suffixed names, served with `nosniff` (+ sandbox CSP for images). SVG is not accepted.
- Only the site's own asset files are publicly served — `server/`, `data/`, `admin/src`, `package.json`, `.git` return 404.
- All text is HTML-escaped when rendered; colour/gradient fields reject anything that could break out of a style attribute.

---

## Deployment

The admin panel needs the Node server running (any Node host with a **persistent disk** for `data/` and `uploads/` — e.g. a VPS, Render/Railway with a volume, Fly.io with a volume).

```bash
npm ci && npm run build
NODE_ENV=production JWT_SECRET=<long-random-string> TRUST_PROXY=1 npm start
```

**Back up** `data/cms.sqlite` and `uploads/` — that is all the content.

If you prefer to keep static hosting (e.g. GitHub Pages) for the public site, `npm run export` writes the current published site to `dist/` (HTML + assets + uploads) that you can deploy anywhere. You'd run the admin panel locally, then export and publish.
