// Optional: writes a fully static copy of the published site to dist/
// (for static hosts such as GitHub Pages). The admin panel itself still needs the Node server.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, UPLOAD_DIR } from '../config.js';
import { openDatabase } from '../db/index.js';
import { seedIfEmpty } from '../db/seed.js';
import { loadContent } from '../render/content.js';
import { renderPortfolio } from '../render/portfolio.js';

const out = path.join(ROOT_DIR, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const db = openDatabase();
seedIfEmpty(db);
fs.writeFileSync(path.join(out, 'index.html'), renderPortfolio(loadContent(db)));
db.close();

for (const f of ['styles.css', 'script.js', 'hero-scene.js', 'three.min.js', 'og-image.jpg', 'aatiqa-aslam-resume.pdf', 'CNAME', 'robots.txt']) {
  if (fs.existsSync(path.join(ROOT_DIR, f))) fs.copyFileSync(path.join(ROOT_DIR, f), path.join(out, f));
}
fs.cpSync(path.join(ROOT_DIR, 'images'), path.join(out, 'images'), { recursive: true });
if (fs.existsSync(UPLOAD_DIR)) fs.cpSync(UPLOAD_DIR, path.join(out, 'uploads'), { recursive: true });
console.log(`Static site written to ${out}`);
