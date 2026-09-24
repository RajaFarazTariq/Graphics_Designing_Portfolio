import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Button, Field, Spinner } from '../components/ui.jsx';

const GithubMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

export default function Login() {
  const { user, config, isGithub } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const target = location.state?.from || '/';

  if (!config) return <Spinner />;
  if (user) return <Navigate to={target} replace />;

  return (
    <div className="auth-page">
      <div className="auth-panel">
        {isGithub ? <GithubLogin config={config} error={params.get('error')} /> : <PasswordLogin target={target} next={params.get('next')} />}
      </div>
      <div className="auth-art">
        <h2>Your portfolio, <em>without touching code.</em></h2>
        <p>Every change you make here updates the live site's content — the design stays exactly as it is.</p>
      </div>
    </div>
  );
}

function ErrorBox({ children }) {
  return <div className="error-state" role="alert" style={{ marginBottom: 18 }}><AlertCircle size={18} /><div>{children}</div></div>;
}

function GithubLogin({ config, error: initialError }) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);
  const owner = config.allowedUsers?.map(u => '@' + u).join(', ');

  const submitToken = async (e) => {
    e.preventDefault();
    if (!token.trim()) { setError('Paste a GitHub access token.'); return; }
    setError(''); setLoading(true);
    try { await loginWithToken(token.trim()); navigate('/', { replace: true }); }
    catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="auth-card">
      <span className="brand__mark" style={{ width: 40, height: 40, borderRadius: 11, fontSize: 18 }}>A</span>
      <h1>Sign in</h1>
      <p>Use your GitHub account to manage your portfolio.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {config.oauth ? (
        <>
          <a className="btn btn--primary btn--block" style={{ height: 44, background: 'var(--text)', color: 'var(--surface)' }} href="/api/admin/auth/github">
            <GithubMark /> Sign in with GitHub
          </a>
          <p className="muted small" style={{ textAlign: 'center', marginTop: 10 }}>
            Signed in to GitHub with another account? <a href="/api/admin/auth/github?select_account=1">Choose a different GitHub account</a>
          </p>
        </>
      ) : (
        <div className="notice" style={{ marginBottom: 12 }}>GitHub sign-in isn't configured on this deployment yet — use an access token below.</div>
      )}
      <details className="card" style={{ marginTop: 16 }} open={!config.oauth}>
        <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 600 }}>Use an access token instead</summary>
        <form onSubmit={submitToken} className="stack" style={{ gap: 12, padding: '0 16px 16px' }}>
          <p className="muted small">
            Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
            access to <strong>{config.repo}</strong> and <strong>Contents: Read and write</strong>. It stays encrypted in your session cookie.
          </p>
          <div className="input-group">
            <KeyRound size={15} />
            <input className="input" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="github_pat_…" aria-label="GitHub access token" />
          </div>
          <Button type="submit" variant="primary" block loading={loading}>Sign in with token</Button>
        </form>
      </details>
      <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>Only {owner} can make changes.</p>
    </div>
  );
}

function PasswordLogin({ target, next }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // ?next=/preview is used by the server when an unauthenticated visitor opens the preview.
      if (next === '/preview') window.location.href = next;
      else navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <span className="brand__mark" style={{ width: 40, height: 40, borderRadius: 11, fontSize: 18 }}>A</span>
      <h1>Sign in to your CMS</h1>
      <p>Manage your portfolio content — projects, profile, skills and more.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="stack" style={{ gap: 16 }}>
        <Field label={<label htmlFor="email">Email</label>}>
          <div className="input-group">
            <Mail size={15} />
            <input id="email" className="input" type="email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </Field>
        <Field label={<label htmlFor="password">Password</label>}>
          <div className="input-group">
            <Lock size={15} />
            <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" style={{ paddingRight: 40 }} />
            <span className="input-group__suffix">
              <Button variant="ghost" size="sm" icon={show ? EyeOff : Eye} onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} />
            </span>
          </div>
        </Field>
        <Button type="submit" variant="primary" block loading={loading} style={{ height: 42 }}>Sign in</Button>
      </div>
      <p className="muted small" style={{ marginTop: 22 }}>
        Forgot your password? Run <span className="kbd">npm run reset-password</span> on the server.
      </p>
    </form>
  );
}
