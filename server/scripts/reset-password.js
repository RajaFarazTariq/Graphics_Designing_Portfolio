// Emergency admin password reset (run on the server):
//   npm run reset-password -- you@example.com NewPassword123
// Signs out every existing session for that account.
import { openDatabase } from '../db/index.js';
import { hashPassword, passwordProblem } from '../auth.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run reset-password -- <email> <new-password>');
  process.exit(1);
}
const problem = passwordProblem(password);
if (problem) { console.error(problem); process.exit(1); }

const db = openDatabase();
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (user) {
  db.prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?")
    .run(await hashPassword(password), user.id);
  console.log(`Password updated for ${email}.`);
} else {
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email.toLowerCase(), 'Admin', await hashPassword(password));
  console.log(`Created admin account ${email}.`);
}
db.close();
