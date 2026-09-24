// Vercel serverless entry: runs the same Express app for every /api/* request (and /preview).
// vercel.json rewrites those paths here as /api/index?__path=<original path>, so the original
// URL is restored before Express routes it. Uses CMS_STORAGE=github.
import { openContentDb } from '../server/bootstrap.js';
import { createApp } from '../server/app.js';

const app = createApp(openContentDb());

export default function handler(req, res) {
  const url = new URL(req.url, 'http://internal');
  const original = url.searchParams.get('__path');
  if (original) {
    url.searchParams.delete('__path');
    const rest = url.searchParams.toString();
    req.url = original + (rest ? `?${rest}` : '');
  }
  return app(req, res);
}
