// GitHub-backed storage for the serverless (Vercel) deployment.
// The working copy is an in-memory SQLite database; the source of truth is
// content/cms.json (+ uploads/) in the repository. Each admin save becomes ONE commit
// containing the new snapshot and any added/removed upload files — Vercel then redeploys.
import crypto from 'node:crypto';
import { GITHUB, CONTENT_FILE } from '../config.js';
import { dumpSnapshot, loadSnapshot, serializeSnapshot } from '../db/snapshot.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** The sha git assigns to a file with this content (lets us compare without downloading). */
export const gitBlobSha = (buf) => crypto.createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

export class GitHubStore {
  constructor({ repo = GITHUB.repo, branch = GITHUB.branch, api = GITHUB.api } = {}) {
    this.repo = repo;
    this.branch = branch;
    this.api = api.replace(/\/$/, '');
    this.loadedHead = null;   // commit sha our in-memory DB corresponds to
    this.loadedBlob = null;   // blob sha of content/cms.json at that commit
    this.lastJson = null;     // last snapshot text written/loaded
    this.lastActivityId = 0;  // activity rows already described in a commit message
    this.pending = new Map(); // repo path -> Buffer (add/replace) | null (delete)
  }

  async gh(token, method, path, body, { accept = 'application/vnd.github+json', raw = false } = {}) {
    const res = await fetch(`${this.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-cms',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = res.status === 401 ? 'GitHub rejected the access token — please sign in again.'
        : res.status === 403 ? `GitHub refused the request: ${data.message || 'forbidden'} (check the token has write access to ${this.repo}).`
        : `GitHub API error ${res.status}: ${data.message || res.statusText}`;
      throw Object.assign(httpError(res.status === 422 ? 409 : 502, msg), { githubStatus: res.status });
    }
    if (raw) return Buffer.from(await res.arrayBuffer());
    return res.status === 204 ? null : res.json();
  }

  /** Called at cold start with the snapshot bundled into the deployment. */
  markBundled(db, bundledBuffer) {
    this.loadedBlob = bundledBuffer ? gitBlobSha(bundledBuffer) : null;
    this.lastJson = serializeSnapshot(dumpSnapshot(db));
    this.lastActivityId = db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM activity_log').get().n;
  }

  async headSha(token) {
    const ref = await this.gh(token, 'GET', `/repos/${this.repo}/git/ref/heads/${this.branch}`);
    if (!ref) throw httpError(502, `Branch "${this.branch}" not found in ${this.repo}.`);
    return ref.object.sha;
  }

  async contentBlobAt(token, commitSha) {
    const file = await this.gh(token, 'GET', `/repos/${this.repo}/contents/${CONTENT_FILE}?ref=${commitSha}`);
    return file ? file.sha : null;
  }

  /** Makes the in-memory DB match the latest commit on the branch. */
  async ensureFresh(db, token) {
    const head = await this.headSha(token);
    if (head === this.loadedHead) return false;
    const file = await this.gh(token, 'GET', `/repos/${this.repo}/contents/${CONTENT_FILE}?ref=${head}`);
    if (file && file.sha !== this.loadedBlob) {
      const buf = file.content
        ? Buffer.from(file.content, 'base64')
        : Buffer.from((await this.gh(token, 'GET', `/repos/${this.repo}/git/blobs/${file.sha}`)).content, 'base64');
      loadSnapshot(db, JSON.parse(buf.toString('utf8')));
      this.loadedBlob = file.sha;
      this.lastJson = serializeSnapshot(dumpSnapshot(db));
      this.lastActivityId = db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM activity_log').get().n;
      this.pending.clear();
    }
    this.loadedHead = head;
    return true;
  }

  stageFile(path, buffer) { this.pending.set(path, buffer); }
  stageDelete(path) { this.pending.set(path, null); }
  discardPending() { this.pending.clear(); }
  /** Forces a full reload from GitHub on the next request. */
  invalidate() { this.loadedHead = null; this.loadedBlob = null; this.pending.clear(); }

  commitMessage(db) {
    const rows = db.prepare('SELECT entity, title, action FROM activity_log WHERE id > ? ORDER BY id').all(this.lastActivityId);
    const parts = rows.map(r => `${r.action} ${r.entity.replace(/_/g, ' ')}${r.title ? ` “${r.title}”` : ''}`);
    const head = parts[0] || 'update content';
    return `CMS: ${head}${parts.length > 1 ? ` (+${parts.length - 1} more)` : ''}\n\n${parts.join('\n')}`.trim();
  }

  /** Commits the current DB snapshot + staged files. Returns the commit sha, or null if nothing changed. */
  async persist(db, token) {
    const json = serializeSnapshot(dumpSnapshot(db));
    if (json === this.lastJson && this.pending.size === 0) return null;

    let parent = await this.headSha(token);
    if (this.loadedHead && parent !== this.loadedHead) {
      // Someone committed since we loaded. Fine if content/cms.json itself is unchanged (e.g. a code push).
      const blobNow = await this.contentBlobAt(token, parent);
      if (blobNow !== this.loadedBlob) {
        this.invalidate();
        throw httpError(409, 'The content was changed elsewhere in the meantime. Reload the page and apply your change again.');
      }
    }
    const commit = await this.gh(token, 'GET', `/repos/${this.repo}/git/commits/${parent}`);

    const blob = async (buf) => (await this.gh(token, 'POST', `/repos/${this.repo}/git/blobs`,
      { content: buf.toString('base64'), encoding: 'base64' })).sha;
    const jsonBuf = Buffer.from(json, 'utf8');
    const tree = [{ path: CONTENT_FILE, mode: '100644', type: 'blob', sha: await blob(jsonBuf) }];
    for (const [path, buf] of this.pending) {
      tree.push({ path, mode: '100644', type: 'blob', sha: buf ? await blob(buf) : null });
    }
    const newTree = await this.gh(token, 'POST', `/repos/${this.repo}/git/trees`, { base_tree: commit.tree.sha, tree });
    const newCommit = await this.gh(token, 'POST', `/repos/${this.repo}/git/commits`,
      { message: this.commitMessage(db), tree: newTree.sha, parents: [parent] });
    await this.gh(token, 'PATCH', `/repos/${this.repo}/git/refs/heads/${this.branch}`, { sha: newCommit.sha, force: false });

    this.loadedHead = newCommit.sha;
    this.loadedBlob = tree[0].sha;
    this.lastJson = json;
    this.lastActivityId = db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM activity_log').get().n;
    this.pending.clear();
    return newCommit.sha;
  }

  /** Reads a file from the branch (for previewing uploads before Vercel has redeployed). */
  async readRaw(token, path) {
    return this.gh(token, 'GET', `/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${this.branch}`,
      undefined, { accept: 'application/vnd.github.raw', raw: true });
  }
}

let store = null;
export const getStore = () => (store ??= new GitHubStore());
export const setStore = (s) => { store = s; };
