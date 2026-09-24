import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ROOT_DIR, UPLOAD_DIR, REPO_UPLOAD_DIR, ADMIN_DIST, IS_PROD, IS_GITHUB } from './config.js';
import { loadContent } from './render/content.js';
import { renderPortfolio } from './render/portfolio.js';
import { sessionUser } from './auth.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { getStore } from './storage/github.js';

/**
 * GitHub mode: every authenticated admin request first syncs the in-memory DB with the branch,
 * and every successful change is committed to GitHub *before* the response is sent.
 * Requests are processed one at a time so commits never race each other.
 */
function githubSync(db, onChange) {
  const store = getStore();
  let chain = Promise.resolve();
  return (req, res, next) => {
    const user = sessionUser(db, req);
    if (!user?.githubToken) return next(); // sign-in routes, or rejected later by requireAuth
    const finished = new Promise(resolve => { res.once('finish', resolve); res.once('close', resolve); });
    chain = chain.then(async () => {
      try {
        if (await store.ensureFresh(db, user.githubToken)) onChange();
      } catch (e) {
        next(e);
        return finished;
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const end = res.end.bind(res);
        let intercepted = false;
        res.end = (chunk, encoding, cb) => {
          if (intercepted) return end(chunk, encoding, cb);
          intercepted = true;
          if (res.statusCode >= 400) { store.discardPending(); return end(chunk, encoding, cb); }
          store.persist(db, user.githubToken)
            .then((sha) => { if (sha) res.setHeader('X-CMS-Commit', sha); end(chunk, encoding, cb); })
            .catch((err) => {
              // The change could not be saved to GitHub — throw away the in-memory edit.
              store.invalidate();
              onChange();
              const body = JSON.stringify({ error: `Not saved: ${err.message}` });
              res.statusCode = err.status && err.status < 500 ? err.status : 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Content-Length', Buffer.byteLength(body));
              end(body);
            });
          return res;
        };
      }
      next();
      return finished;
    });
  };
}

// Only these repo files are publicly reachable (never server/, data/, admin source, package files…).
const PUBLIC_FILE = /^\/(?:[\w.-]+\.(?:css|js|jpe?g|png|webp|gif|avif|svg|ico|pdf|txt|xml|webmanifest)|images\/[\w./-]+)$/i;

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

  // Rendered page is cached in memory and rebuilt after any admin change.
  let cachedPage = null;
  const onChange = () => { cachedPage = null; };
  const publicPage = () => (cachedPage ??= renderPortfolio(loadContent(db)));

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Baseline headers for the public site (no CSP here so the existing inline styles/scripts keep working).
  const siteHeaders = helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: { action: 'sameorigin' } });
  const adminHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://avatars.githubusercontent.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'frame-src': ["'self'"],
        'object-src': ["'self'"],
        'frame-ancestors': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // ---------------- public portfolio ----------------
  app.get(['/', '/index.html'], siteHeaders, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(publicPage());
  });

  // Draft-inclusive preview, admin only.
  app.get(['/preview', '/api/preview'], siteHeaders, async (req, res) => {
    const user = sessionUser(db, req);
    if (!user) return res.redirect('/admin/login?next=/preview');
    if (IS_GITHUB) await getStore().ensureFresh(db, user.githubToken);
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.type('html').send(renderPortfolio(loadContent(db, { preview: true })));
  });

  // ---------------- APIs ----------------
  app.use('/api/public', siteHeaders, publicRouter(db));
  app.use('/api/admin', adminHeaders, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    ...(IS_GITHUB ? [githubSync(db, onChange)] : []), adminRouter(db, { onChange }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---------------- admin SPA ----------------
  app.use('/admin', adminHeaders, express.static(ADMIN_DIST, { index: false, maxAge: IS_PROD ? '7d' : 0 }));
  app.get(/^\/admin(\/.*)?$/, adminHeaders, (req, res) => {
    const index = path.join(ADMIN_DIST, 'index.html');
    if (!fs.existsSync(index)) {
      return res.status(503).type('text').send('Admin panel is not built yet. Run "npm run build" (or "npm run admin:dev" during development).');
    }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });

  // ---------------- uploaded media ----------------
  const uploadOptions = {
    index: false, dotfiles: 'deny', maxAge: '30d', immutable: true,
    setHeaders: (res, filePath) => {
      res.set('X-Content-Type-Options', 'nosniff');
      // Uploads are content-sniffed on upload (images/PDF only); the sandbox is extra defence for images.
      // PDFs skip it because browsers' built-in PDF viewers refuse to run inside a sandboxed document.
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
      }
    },
  };
  app.use('/uploads', express.static(UPLOAD_DIR, uploadOptions));
  // Files committed to the repo by GitHub mode (uploads/ in the repository).
  app.use('/uploads', express.static(REPO_UPLOAD_DIR, uploadOptions));

  // ---------------- original site assets (allowlist) ----------------
  const siteStatic = express.static(ROOT_DIR, { index: false, dotfiles: 'deny', maxAge: IS_PROD ? '1d' : 0 });
  app.use((req, res, next) => (PUBLIC_FILE.test(req.path) && !/^\/package/i.test(req.path) ? siteStatic(req, res, next) : next()));

  app.use((req, res) => res.status(404).type('text').send('Not found'));

  // ---------------- errors ----------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'File is too large.'; }
    else if (err.code === 'LIMIT_FILE_COUNT') { status = 413; message = 'Too many files in one upload (max 20).'; }
    else if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed request.'; }
    else if (/UNIQUE constraint failed/.test(err.message || '')) { status = 409; message = 'An item with the same value already exists.'; }
    else if (/FOREIGN KEY constraint failed/.test(err.message || '')) { status = 409; message = 'This item is linked to other content.'; }
    if (status >= 500) {
      console.error(err);
      message = 'Something went wrong on the server. Please try again.';
    }
    res.status(status).json({ error: message, ...(err.fields ? { fields: err.fields } : {}), ...(err.usage ? { usage: err.usage } : {}) });
  });

  return app;
}
