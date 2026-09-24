import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
export const ADMIN_DIST = path.join(ROOT_DIR, 'admin', 'dist');
export const CONTENT_FILE = 'content/cms.json'; // repo-relative

/**
 * Storage modes:
 *  - "local"  (default): SQLite file in ./data, uploads on disk. For running on your own machine / a Node host.
 *  - "github": content lives in content/cms.json + uploads/ inside the GitHub repo. Every save is a commit,
 *              Vercel rebuilds the static site. Used for the free Vercel deployment.
 */
export const STORAGE = process.env.CMS_STORAGE === 'github' ? 'github' : 'local';
export const IS_GITHUB = STORAGE === 'github';

export const GITHUB = {
  repo: process.env.GITHUB_REPO || 'RajaFarazTariq/Graphics_Designing_Portfolio',
  branch: process.env.GITHUB_BRANCH || 'main',
  api: process.env.GITHUB_API_URL || 'https://api.github.com',
  web: process.env.GITHUB_WEB_URL || 'https://github.com',
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  oauthScope: process.env.GITHUB_OAUTH_SCOPE || 'public_repo',
};
// Who may sign in (GitHub usernames). Defaults to the repository owner.
export const ADMIN_GITHUB_USERS = (process.env.ADMIN_GITHUB_USERS || GITHUB.repo.split('/')[0])
  .split(',').map(s => s.trim()).filter(Boolean);

// Vercel functions only have a writable /tmp.
const writableBase = IS_GITHUB ? path.join(os.tmpdir(), 'portfolio-cms') : ROOT_DIR;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(writableBase, 'data'));
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads'));
/** uploads/ committed to the repo (GitHub mode) — also shipped by the static export. */
export const REPO_UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH || (IS_GITHUB ? ':memory:' : path.join(DATA_DIR, 'cms.sqlite'));
export const PORT = Number(process.env.PORT) || 3000;
export const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// JWT secret: required via env in GitHub/Vercel mode; locally a generated one is persisted.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_GITHUB && process.env.VERCEL) {
    throw new Error('JWT_SECRET environment variable is required (set it in Vercel → Settings → Environment Variables).');
  }
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
export const JWT_SECRET = loadSecret();
export const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;

// Vercel functions accept request bodies up to 4.5 MB, so uploads are capped at 4 MB there.
export const LIMITS = IS_GITHUB
  ? { imageBytes: 4 * 1024 * 1024, documentBytes: 4 * 1024 * 1024 }
  : { imageBytes: 10 * 1024 * 1024, documentBytes: 15 * 1024 * 1024 };
