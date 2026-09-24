import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, UserRound, Briefcase, GraduationCap, Sparkles, FolderKanban, Wrench, MessageSquareQuote,
  Share2, Images, FileText, LayoutPanelTop, Settings, ShieldCheck, Inbox, ListOrdered, ExternalLink, Eye, LogOut, Menu, Moon, Sun,
  CheckCircle2, Loader2,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';
import { Button } from './ui.jsx';

const NAV = [
  { group: null, items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/messages', label: 'Messages', icon: Inbox, badge: 'messages_unread' },
  ] },
  { group: 'Content', items: [
    { to: '/profile', label: 'Profile', icon: UserRound },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/skills', label: 'Skills', icon: Sparkles },
    { to: '/experience', label: 'Experience', icon: Briefcase },
    { to: '/education', label: 'Education', icon: GraduationCap },
    { to: '/services', label: 'Services', icon: Wrench },
    { to: '/process', label: 'Process', icon: ListOrdered },
    { to: '/testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    { to: '/social-links', label: 'Social Links', icon: Share2 },
  ] },
  { group: 'Assets', items: [
    { to: '/media', label: 'Media Library', icon: Images },
    { to: '/resume', label: 'Resume / CV', icon: FileText },
  ] },
  { group: 'Site', items: [
    { to: '/sections', label: 'Section Settings', icon: LayoutPanelTop },
    { to: '/site-settings', label: 'Site Settings', icon: Settings },
    { to: '/account', label: 'Admin Settings', icon: ShieldCheck },
  ] },
];

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('admin-theme') || ''; } catch { return ''; } });
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('admin-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')];
}

/** GitHub mode: every save is a commit and Vercel rebuilds — show that it's on its way. */
function PublishStatus({ repo }) {
  const [last, setLast] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const onCommit = (e) => setLast(e.detail);
    window.addEventListener('cms:committed', onCommit);
    const t = setInterval(() => tick(n => n + 1), 5000);
    return () => { window.removeEventListener('cms:committed', onCommit); clearInterval(t); };
  }, []);
  if (!last) return null;
  const secs = Math.round((Date.now() - last.at) / 1000);
  const live = secs > 75;
  return (
    <a className="badge badge--plain hide-sm" style={{ background: live ? 'var(--success-soft)' : 'var(--info-soft)', color: live ? 'var(--success)' : 'var(--info)', textDecoration: 'none', height: 28, padding: '0 12px' }}
      href={`https://github.com/${repo}/commit/${last.sha}`} target="_blank" rel="noreferrer"
      title="Your change was committed to GitHub; Vercel rebuilds the site automatically.">
      {live ? <><CheckCircle2 size={13} /> Published — live site updated</> : <><Loader2 size={13} className="spin" /> Publishing… live in ~1 min</>}
    </a>
  );
}

export default function Layout() {
  const { user, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [isDark, toggleTheme] = useTheme();
  const { data: dash, reload } = useApi('/dashboard');
  useEffect(() => { setOpen(false); reload(true); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const nav = NAV.map(g => ({ ...g, items: g.items.filter(i => i.to !== '/messages' || config?.messages !== false) }));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Admin navigation">
        <NavLink to="/" className="brand">
          <span className="brand__mark">A</span>
          <span><div className="brand__name">Portfolio CMS</div><div className="brand__sub">Content manager</div></span>
        </NavLink>
        {nav.map((g, i) => (
          <div className="nav-group" key={i}>
            {g.group && <div className="nav-group__label">{g.group}</div>}
            {g.items.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} /> {label}
                {badge && dash?.counts?.[badge] > 0 && <span className="nav-link__badge">{dash.counts[badge]}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar__footer">
          <a className="nav-link" href="/" target="_blank" rel="noreferrer"><ExternalLink size={17} /> View live site</a>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <Button variant="ghost" className="menu-btn" icon={Menu} onClick={() => setOpen(true)} aria-label="Open menu" />
          <div className="topbar__spacer" />
          {config?.storage === 'github' && <PublishStatus repo={config.repo} />}
          <a className="btn btn--secondary btn--sm hide-sm" href="/preview" target="_blank" rel="noreferrer" title="Preview the site including drafts">
            <Eye size={14} /> Preview
          </a>
          <Button variant="ghost" size="sm" icon={isDark ? Sun : Moon} onClick={toggleTheme} aria-label="Toggle dark mode" />
          {user?.avatar && <img src={user.avatar} alt="" width="26" height="26" style={{ borderRadius: '50%' }} className="hide-sm" />}
          <span className="muted small hide-sm" title={user?.login ? `@${user.login}` : user?.email}>{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Sign out</Button>
        </header>
        <main className="content">
          <Outlet context={{ refreshCounts: () => reload(true) }} />
        </main>
      </div>
    </div>
  );
}
