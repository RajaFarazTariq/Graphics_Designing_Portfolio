// Thin fetch wrapper for the admin API: JSON in/out, CSRF header, normalised errors.
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.fields = body?.fields || {};
    this.usage = body?.usage || null;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body, { raw = false } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(`/api/admin${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const commit = res.headers.get('X-CMS-Commit');
  if (commit) window.dispatchEvent(new CustomEvent('cms:committed', { detail: { sha: commit, at: Date.now() } }));
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  }
  return raw ? res : data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  upload: (p, formData) => request('POST', p, formData),
};

export const qs = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
};

// Deployment info from /auth/config (storage mode, limits…), set once at start-up.
export const deployment = { storage: 'local', maxImageMb: 10, maxDocumentMb: 15, messages: true, repo: null, branch: null };
export const setDeployment = (cfg) => Object.assign(deployment, cfg || {});

/**
 * Media urls are stored relative to the site root (e.g. images/x.jpg).
 * In GitHub mode a new upload only reaches the live site after Vercel redeploys,
 * so the admin previews uploads straight from the repository.
 */
export const mediaSrc = (url) => {
  if (!url) return '';
  if (/^(https?:)?\//.test(url)) return url;
  if (deployment.storage === 'github' && url.startsWith('uploads/')) return `/api/admin/raw?path=${encodeURIComponent(url)}`;
  return `/${url}`;
};

export const formatBytes = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
