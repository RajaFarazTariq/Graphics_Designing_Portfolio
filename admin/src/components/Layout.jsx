import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, UserRound, Briefcase, GraduationCap, Sparkles, FolderKanban, Wrench, MessageSquareQuote,
  Share2, Images, FileText, LayoutPanelTop, Settings, ShieldCheck, Inbox, ListOrdered, ExternalLink, Eye, LogOut, Menu, Moon, Sun,
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

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [isDark, toggleTheme] = useTheme();
  const { data: dash, reload } = useApi('/dashboard');
  useEffect(() => { setOpen(false); reload(true); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Admin navigation">
        <NavLink to="/" className="brand">
          <span className="brand__mark">A</span>
          <span><div className="brand__name">Portfolio CMS</div><div className="brand__sub">Content manager</div></span>
        </NavLink>
        {NAV.map((g, i) => (
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
          <a className="btn btn--secondary btn--sm hide-sm" href="/preview" target="_blank" rel="noreferrer" title="Preview the site including drafts">
            <Eye size={14} /> Preview
          </a>
          <Button variant="ghost" size="sm" icon={isDark ? Sun : Moon} onClick={toggleTheme} aria-label="Toggle dark mode" />
          <span className="muted small hide-sm" title={user?.email}>{user?.name || user?.email}</span>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Sign out</Button>
        </header>
        <main className="content">
          <Outlet context={{ refreshCounts: () => reload(true) }} />
        </main>
      </div>
    </div>
  );
}
