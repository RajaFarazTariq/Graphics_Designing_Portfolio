import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, SESSION_HOURS, IS_PROD, DATA_DIR } from './config.js';

export const COOKIE_NAME = 'cms_session';
export const INITIAL_PASSWORD_FILE = path.join(DATA_DIR, 'initial-admin-password.txt');

export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/',
    maxAge: SESSION_HOURS * 3600 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: IS_PROD, path: '/' });
}

/** Returns the user for a valid session cookie, or null. Tokens die when token_version changes. */
export function sessionUser(db, req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, token_version, last_login_at FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.token_version !== payload.v) return null;
    return { ...user };
  } catch {
    return null;
  }
}

export const requireAuth = (db) => (req, res, next) => {
  const user = sessionUser(db, req);
  if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  req.user = user;
  next();
};

/**
 * CSRF defence in depth (cookie is already SameSite=Strict): state-changing admin
 * requests must carry a custom header, which cross-site forms cannot set.
 */
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Request blocked (missing CSRF header).' });
  }
  next();
}

/** Small in-memory fixed-window limiter. */
export function rateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  const limiter = (key) => {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + windowMs }; hits.set(key, entry); }
    entry.count += 1;
    return entry.count <= max ? null : { message, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  };
  /** Checks without counting — used to lock out even correct guesses once the limit is hit. */
  limiter.blocked = (key) => {
    const entry = hits.get(key);
    if (!entry || entry.reset < Date.now() || entry.count < max) return null;
    return { message, retryAfter: Math.ceil((entry.reset - Date.now()) / 1000) };
  };
  limiter.reset = (key) => hits.delete(key);
  return limiter;
}

/** Creates the first admin account when the users table is empty. */
export async function ensureAdmin(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;
  const profileEmail = db.prepare('SELECT email, full_name FROM profile WHERE id = 1').get();
  const email = (process.env.ADMIN_EMAIL || profileEmail?.email || 'admin@example.com').toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  const generated = !password;
  if (generated) password = crypto.randomBytes(9).toString('base64url') + '7';
  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_PASSWORD rejected: ${problem}`);
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(email, profileEmail?.full_name || 'Admin', await hashPassword(password));
  console.log('\n==============================================');
  console.log(' Admin account created');
  console.log(`   email:    ${email}`);
  if (generated) {
    console.log(`   password: ${password}`);
    console.log(' (also saved to data/initial-admin-password.txt — deleted automatically');
    console.log('  when you change the password in Admin Settings)');
    fs.writeFileSync(INITIAL_PASSWORD_FILE, `email: ${email}\npassword: ${password}\n`, { mode: 0o600 });
  }
  console.log('==============================================\n');
}
