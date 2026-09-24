// "Sign in with GitHub" for the GitHub-storage (Vercel) deployment.
// Only the allowed GitHub users who can push to the content repository get a session.
import crypto from 'node:crypto';
import { Router } from 'express';
import { GITHUB, ADMIN_GITHUB_USERS, IS_PROD } from '../config.js';
import { issueGithubSession, rateLimiter } from '../auth.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const STATE_COOKIE = 'cms_oauth_state';
const tokenLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Try again in a few minutes.' });

async function ghGet(token, path) {
  const res = await fetch(`${GITHUB.api}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-cms', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (res.status === 401) throw httpError(401, 'GitHub did not accept this token (expired or revoked?).');
  if (!res.ok) return null;
  return res.json();
}

/** Returns the GitHub user if they are allowed to manage the site, otherwise throws. */
export async function verifyGithubAccess(token) {
  const user = await ghGet(token, '/user');
  if (!user) throw httpError(401, 'Could not read your GitHub account with this token.');
  if (!ADMIN_GITHUB_USERS.some(u => u.toLowerCase() === String(user.login).toLowerCase())) {
    throw httpError(403, `@${user.login} is not allowed to manage this site. Only ${ADMIN_GITHUB_USERS.map(u => '@' + u).join(', ')} can make changes.`);
  }
  const repo = await ghGet(token, `/repos/${GITHUB.repo}`);
  if (!repo?.permissions?.push) {
    throw httpError(403, `This token cannot write to ${GITHUB.repo}. Give it “Contents: Read and write” access to that repository.`);
  }
  return { login: user.login, name: user.name || user.login, avatar: user.avatar_url || '' };
}

export function githubAuthRouter() {
  const router = Router();

  router.get('/auth/github', (req, res) => {
    if (!GITHUB.clientId) return res.redirect('/admin/login?error=' + encodeURIComponent('GitHub sign-in is not configured yet — use an access token.'));
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/api/admin/auth', maxAge: 10 * 60 * 1000 });
    const url = new URL(`${GITHUB.web}/login/oauth/authorize`);
    url.searchParams.set('client_id', GITHUB.clientId);
    url.searchParams.set('scope', GITHUB.oauthScope);
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'false');
    if (req.query.select_account) url.searchParams.set('prompt', 'select_account');
    res.redirect(url.href);
  });

  router.get('/auth/github/callback', async (req, res) => {
    const fail = (msg) => res.redirect('/admin/login?error=' + encodeURIComponent(msg));
    const expected = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/api/admin/auth' });
    if (req.query.error) return fail('GitHub sign-in was cancelled.');
    if (!req.query.code || !expected || req.query.state !== expected) return fail('Sign-in expired or was tampered with. Please try again.');
    try {
      const r = await fetch(`${GITHUB.web}/login/oauth/access_token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: GITHUB.clientId, client_secret: GITHUB.clientSecret, code: String(req.query.code) }),
      });
      const data = await r.json();
      if (!data.access_token) return fail(data.error_description || 'GitHub did not return an access token.');
      const user = await verifyGithubAccess(data.access_token);
      issueGithubSession(res, { ...user, token: data.access_token });
      res.redirect('/admin/');
    } catch (e) {
      fail(e.message);
    }
  });

  router.post('/auth/token', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!token) throw httpError(400, 'Paste a GitHub access token.');
    const limited = tokenLimiter.blocked(req.ip);
    if (limited) throw httpError(429, limited.message);
    try {
      const user = await verifyGithubAccess(token);
      issueGithubSession(res, { ...user, token });
      res.json({ user: { id: user.login, login: user.login, email: user.login, name: user.name, avatar: user.avatar } });
    } catch (e) {
      tokenLimiter(req.ip);
      throw e;
    }
  });

  return router;
}
