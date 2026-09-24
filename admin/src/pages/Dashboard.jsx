import { Link } from 'react-router-dom';
import {
  FolderKanban, Star, Sparkles, Briefcase, GraduationCap, Wrench, MessageSquareQuote, Inbox, Plus, FileText, Eye, Activity, AlertTriangle,
} from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { timeAgo, mediaSrc } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader, Spinner, ErrorState, EmptyState, Notice } from '../components/ui.jsx';

const ENTITY_LABEL = {
  projects: 'Project', skills: 'Skill', experiences: 'Experience', education: 'Education', services: 'Service',
  testimonials: 'Testimonial', social_links: 'Social link', process_steps: 'Process step', stats: 'Stat', facts: 'Quick fact',
  media: 'File', resumes: 'Resume', profile: 'Profile', settings: 'Site settings', sections: 'Section', messages: 'Message',
  project_categories: 'Category', account: 'Account', system: 'System',
};

function StatCard({ to, icon: Icon, label, value, sub }) {
  return (
    <Link to={to} className="stat-card">
      <div className="stat-card__top">{label}<span className="stat-card__icon"><Icon size={16} /></span></div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  const c = data.counts;

  return (
    <>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Here's an overview of your portfolio content."
        actions={<>
          <a className="btn btn--secondary" href="/preview" target="_blank" rel="noreferrer"><Eye size={16} /> Preview site</a>
          <Link className="btn btn--primary" to="/projects/new"><Plus size={16} /> New project</Link>
        </>}
      />

      {!data.resume && <div style={{ marginBottom: 16 }}><Notice warn>No active resume — the "Download CV" buttons are hidden on the site. <Link to="/resume">Upload one</Link>.</Notice></div>}
      {c.hidden_sections > 0 && <div style={{ marginBottom: 16 }}><Notice>{c.hidden_sections} section{c.hidden_sections > 1 ? 's are' : ' is'} currently hidden from the site. <Link to="/sections">Manage sections</Link>.</Notice></div>}

      <div className="stat-grid">
        <StatCard to="/projects" icon={FolderKanban} label="Projects" value={c.projects} sub={`${c.projects_published} published · ${c.projects_draft} draft`} />
        <StatCard to="/projects?featured=1" icon={Star} label="Featured projects" value={c.projects_featured} sub="Marked as featured" />
        <StatCard to="/skills" icon={Sparkles} label="Skills" value={c.skills} />
        <StatCard to="/messages" icon={Inbox} label="Messages" value={c.messages} sub={c.messages_unread ? `${c.messages_unread} unread` : 'All read'} />
        <StatCard to="/experience" icon={Briefcase} label="Experience" value={c.experiences} />
        <StatCard to="/education" icon={GraduationCap} label="Education" value={c.education} />
        <StatCard to="/services" icon={Wrench} label="Services" value={c.services} />
        <StatCard to="/testimonials" icon={MessageSquareQuote} label="Testimonials" value={c.testimonials} />
      </div>

      <div className="grid-2" style={{ marginTop: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card__head"><div><h2>Recent activity</h2><p>Latest changes made in the admin panel</p></div><Activity size={18} className="muted" /></div>
          {data.activity.length ? (
            <ul className="activity">
              {data.activity.map(a => (
                <li key={a.id}>
                  <span className="activity__dot" style={a.action === 'deleted' ? { background: 'var(--danger)' } : undefined} />
                  <span className="activity__text"><strong>{ENTITY_LABEL[a.entity] || a.entity}</strong> {a.title ? <>“{a.title}”</> : null} {a.action}</span>
                  <span className="activity__time">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Activity} title="No activity yet" />}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__head"><div><h2>Latest messages</h2><p>From the contact form</p></div><Link to="/messages" className="btn btn--ghost btn--sm">View all</Link></div>
            {data.messages.length ? (
              <ul className="activity">
                {data.messages.map(m => (
                  <li key={m.id}>
                    <span className="activity__dot" style={{ background: m.is_read ? 'var(--border-strong)' : 'var(--accent)' }} />
                    <span className="activity__text"><strong>{m.name}</strong> — {m.subject || 'No subject'}</span>
                    <span className="activity__time">{timeAgo(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={Inbox} title="No messages yet" text="New contact form submissions will appear here." />}
          </div>
          <div className="card">
            <div className="card__head"><div><h2>Active resume</h2><p>Linked from the "Download CV" buttons</p></div><FileText size={18} className="muted" /></div>
            <div className="card__body row" style={{ justifyContent: 'space-between' }}>
              {data.resume ? <><span>{data.resume.label}</span><a className="btn btn--secondary btn--sm" href={mediaSrc(data.resume.url)} target="_blank" rel="noreferrer">Open</a></>
                : <span className="row muted"><AlertTriangle size={15} /> None active</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
