import { useState } from 'react';
import { KeyRound, UserCog } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useForm } from '../lib/hooks.js';
import { useToast } from '../components/feedback.jsx';
import { Button, PageHeader, TextField } from '../components/ui.jsx';

function strength(pw) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export default function Account() {
  const { isGithub } = useAuth();
  return isGithub ? <GithubAccount /> : <LocalAccount />;
}

function GithubAccount() {
  const { user, config, logout } = useAuth();
  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Admin Settings" description="This admin panel signs in with GitHub and saves every change as a commit." />
      <div className="stack">
        <div className="card">
          <div className="card__head"><div><h2>Signed in as</h2><p>Access is limited to {config.allowedUsers.map(u => '@' + u).join(', ')}.</p></div><UserCog size={18} className="muted" /></div>
          <div className="card__body row" style={{ gap: 14 }}>
            {user?.avatar && <img src={user.avatar} alt="" width="48" height="48" style={{ borderRadius: '50%' }} />}
            <div style={{ flex: 1 }}><strong>{user?.name}</strong><div className="muted">@{user?.login}</div></div>
            <Button onClick={logout}>Sign out</Button>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><div><h2>Publishing</h2><p>How your changes reach the live site.</p></div><KeyRound size={18} className="muted" /></div>
          <div className="card__body stack" style={{ gap: 10 }}>
            <div>Content is stored in <a href={`https://github.com/${config.repo}/blob/${config.branch}/content/cms.json`} target="_blank" rel="noreferrer">content/cms.json</a> and <code>uploads/</code> on the <strong>{config.branch}</strong> branch of <a href={`https://github.com/${config.repo}`} target="_blank" rel="noreferrer">{config.repo}</a>.</div>
            <div>Every save creates one commit; Vercel rebuilds the site automatically — changes are live about a minute later. You can see (and undo) every change in the <a href={`https://github.com/${config.repo}/commits/${config.branch}/content/cms.json`} target="_blank" rel="noreferrer">commit history</a>.</div>
            <div className="muted small">Your GitHub access is managed on GitHub: revoke it any time under Settings → Applications (or delete the access token you used).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalAccount() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const account = useForm({ name: user?.name || '', email: user?.email || '', current_password: '' });
  const pw = useForm({ current_password: '', new_password: '', confirm_password: '' });
  const [savingA, setSavingA] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const emailChanged = account.values.email.trim().toLowerCase() !== (user?.email || '');

  const saveAccount = async (e) => {
    e.preventDefault();
    setSavingA(true);
    try {
      const r = await api.put('/auth/account', account.values);
      setUser(u => ({ ...u, ...r.user }));
      account.reset({ name: r.user.name, email: r.user.email, current_password: '' });
      toast.success('Account updated');
    } catch (err) { account.setErrors(err.fields || {}); toast.error(err); }
    finally { setSavingA(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const { new_password, confirm_password } = pw.values;
    if (new_password !== confirm_password) { pw.setErrors({ confirm_password: 'Passwords do not match' }); return; }
    setSavingP(true);
    try {
      await api.put('/auth/password', pw.values);
      pw.reset({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) { pw.setErrors(err.fields || {}); toast.error(err); }
    finally { setSavingP(false); }
  };

  const s = strength(pw.values.new_password);
  const colors = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--success)', 'var(--success)'];

  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Admin Settings" description="Your sign-in details for this admin panel." />
      <div className="stack">
        <form className="card" onSubmit={saveAccount}>
          <div className="card__head"><div><h2>Account</h2><p>The email you use to sign in.</p></div><UserCog size={18} className="muted" /></div>
          <div className="card__body form-grid">
            <TextField form={account} name="name" label="Display name" max={80} autoComplete="name" />
            <TextField form={account} name="email" label="Sign-in email" type="email" required autoComplete="username" />
            {emailChanged && <TextField className="full" form={account} name="current_password" label="Current password" type="password" required hint="Required to change the sign-in email." autoComplete="current-password" />}
          </div>
          <div className="card__foot"><Button type="submit" variant="primary" loading={savingA} disabled={!account.dirty}>Save account</Button></div>
        </form>

        <form className="card" onSubmit={savePassword}>
          <div className="card__head"><div><h2>Change password</h2><p>At least 10 characters, with letters and numbers. Changing it signs out every other session.</p></div><KeyRound size={18} className="muted" /></div>
          <div className="card__body form-grid">
            <TextField className="full" form={pw} name="current_password" label="Current password" type="password" required autoComplete="current-password" />
            <TextField form={pw} name="new_password" label="New password" type="password" required autoComplete="new-password" />
            <TextField form={pw} name="confirm_password" label="Confirm new password" type="password" required autoComplete="new-password" />
            {pw.values.new_password && (
              <div className="full">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                  {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 4, borderRadius: 4, background: i < s ? colors[s] : 'var(--border)' }} />)}
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>{['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s]}</div>
              </div>
            )}
          </div>
          <div className="card__foot"><Button type="submit" variant="primary" loading={savingP} disabled={!pw.values.current_password || !pw.values.new_password}>Change password</Button></div>
        </form>
      </div>
    </div>
  );
}
