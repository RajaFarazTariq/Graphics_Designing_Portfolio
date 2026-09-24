import { PORT } from './config.js';
import { openDatabase } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { ensureAdmin } from './auth.js';
import { createApp } from './app.js';

const db = openDatabase();
seedIfEmpty(db);
await ensureAdmin(db);

const server = createApp(db).listen(PORT, () => {
  console.log(`Portfolio:   http://localhost:${PORT}/`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
