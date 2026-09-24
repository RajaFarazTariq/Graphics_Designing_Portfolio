import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'));
export const ADMIN_DIST = path.join(ROOT_DIR, 'admin', 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'cms.sqlite');
export const PORT = Number(process.env.PORT) || 3000;
export const IS_PROD = process.env.NODE_ENV === 'production';

// JWT secret: use env in production; otherwise persist a generated one so sessions survive restarts.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
export const JWT_SECRET = loadSecret();
export const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;

export const LIMITS = {
  imageBytes: 10 * 1024 * 1024,
  documentBytes: 15 * 1024 * 1024,
};
