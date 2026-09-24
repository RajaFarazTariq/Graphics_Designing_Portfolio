import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Button, Field } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ?next=/preview is used by the server when an unauthenticated visitor opens the preview.
  const next = params.get('next');
  const target = location.state?.from || '/';
  const finish = () => {
    if (next && /^\/preview$/.test(next)) window.location.href = next;
    else navigate(target, { replace: true });
  };

  if (user && !loading) return <Navigate to={target} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      finish();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <span className="brand__mark" style={{ width: 40, height: 40, borderRadius: 11, fontSize: 18 }}>A</span>
          <h1>Sign in to your CMS</h1>
          <p>Manage your portfolio content — projects, profile, skills and more.</p>
          {error && (
            <div className="error-state" role="alert" style={{ marginBottom: 18 }}>
              <AlertCircle size={18} /><div>{error}</div>
            </div>
          )}
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
      </div>
      <div className="auth-art">
        <h2>Your portfolio, <em>without touching code.</em></h2>
        <p>Every change you make here updates the live site's content — the design stays exactly as it is.</p>
      </div>
    </div>
  );
}
