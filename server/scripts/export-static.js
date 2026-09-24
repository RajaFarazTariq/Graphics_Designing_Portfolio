// Writes the static site to dist/ — this is what Vercel publishes.
//   • index.html rendered from the content (content/cms.json on Vercel / in GitHub mode,
//     otherwise your local database)
//   • the original site assets, committed uploads/ and the built admin panel (dist/admin)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, UPLOAD_DIR, REPO_UPLOAD_DIR, ADMIN_DIST, DB_PATH, IS_GITHUB } from '../config.js';
import { openContentDb, contentFilePath } from '../bootstrap.js';
import { loadContent } from '../render/content.js';
import { renderPortfolio } from '../render/portfolio.js';

const out = path.join(ROOT_DIR, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const fromSnapshot = IS_GITHUB || !!process.env.VERCEL || process.argv.includes('--from-content')
  || (fs.existsSync(contentFilePath()) && !fs.existsSync(DB_PATH));
const db = openContentDb({ fromSnapshot });
fs.writeFileSync(path.join(out, 'index.html'), renderPortfolio(loadContent(db)));
db.close();
console.log(`Rendered index.html from ${fromSnapshot ? 'content/cms.json' : 'the local database'}`);

for (const f of ['styles.css', 'script.js', 'hero-scene.js', 'three.min.js', 'og-image.jpg', 'aatiqa-aslam-resume.pdf', 'CNAME', 'robots.txt']) {
  if (fs.existsSync(path.join(ROOT_DIR, f))) fs.copyFileSync(path.join(ROOT_DIR, f), path.join(out, f));
}
fs.cpSync(path.join(ROOT_DIR, 'images'), path.join(out, 'images'), { recursive: true });
for (const dir of [REPO_UPLOAD_DIR, UPLOAD_DIR]) {
  if (fs.existsSync(dir)) fs.cpSync(dir, path.join(out, 'uploads'), { recursive: true, force: false });
}
if (fs.existsSync(ADMIN_DIST)) {
  fs.cpSync(ADMIN_DIST, path.join(out, 'admin'), { recursive: true });
  console.log('Included the admin panel at /admin');
}
console.log(`Static site written to ${out}`);
