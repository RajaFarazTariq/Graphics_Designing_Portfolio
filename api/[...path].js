// Vercel serverless entry: runs the same Express app for /api/* (and /preview via rewrite).
// Uses CMS_STORAGE=github — content is read from and committed to the GitHub repository.
import { openContentDb } from '../server/bootstrap.js';
import { createApp } from '../server/app.js';

const app = createApp(openContentDb());

export default function handler(req, res) {
  return app(req, res);
}
