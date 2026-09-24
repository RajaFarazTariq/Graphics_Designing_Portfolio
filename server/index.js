import { PORT, STORAGE } from './config.js';
import { openContentDb } from './bootstrap.js';
import { ensureAdmin } from './auth.js';
import { createApp } from './app.js';

const db = openContentDb();
await ensureAdmin(db);

const server = createApp(db).listen(PORT, () => {
  console.log(`Portfolio:   http://localhost:${PORT}/`);
  console.log(`Admin panel: http://localhost:${PORT}/admin   (storage: ${STORAGE})`);
});

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
