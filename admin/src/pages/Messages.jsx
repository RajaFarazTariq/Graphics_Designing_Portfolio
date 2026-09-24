import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCheck, Inbox, Mail, MailOpen, Reply, Trash2 } from 'lucide-react';
import { api, qs, timeAgo } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { Button, EmptyState, ErrorState, Modal, Notice, PageHeader, Pagination, SearchInput, Spinner } from '../components/ui.jsx';

const PAGE_SIZE = 20;

export default function Messages() {
  const toast = useToast();
  const confirm = useConfirm();
  const outlet = useOutletContext() || {};
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useApi(`/messages${qs({ q, unread: unread ? 1 : '', page, pageSize: PAGE_SIZE })}`);
  const refresh = () => { reload(true); outlet.refreshCounts?.(); };

  const markRead = async (m, is_read) => {
    try { await api.patch(`/messages/${m.id}`, { is_read }); refresh(); } catch (e) { toast.error(e); }
  };
  const view = (m) => { setOpen(m); if (!m.is_read) markRead(m, true); };
  const remove = async (m) => {
    if (!(await confirm({ title: 'Delete message?', message: <>The message from <strong>{m.name}</strong> will be permanently deleted.</> }))) return;
    try { await api.del(`/messages/${m.id}`); toast.success('Message deleted'); setOpen(null); refresh(); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <PageHeader title="Messages" description="A copy of every contact-form submission. Emails are still delivered to your inbox as before."
        actions={<Button icon={CheckCheck} onClick={async () => { await api.post('/messages/mark-all-read'); refresh(); toast.success('All marked as read'); }}>Mark all read</Button>} />
      <div className="toolbar">
        <SearchInput value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search name, email, subject or text…" />
        <div className="segmented" role="group" aria-label="Filter">
          <button type="button" className={!unread ? 'on' : ''} onClick={() => { setUnread(false); setPage(1); }}>All</button>
          <button type="button" className={unread ? 'on' : ''} onClick={() => { setUnread(true); setPage(1); }}>Unread</button>
        </div>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !data.items.length ? (
        <div className="card"><EmptyState icon={Inbox} title={q || unread ? 'No matching messages' : 'No messages yet'} text="New contact form submissions will appear here." /></div>
      ) : (
        <>
          <div className="card list">
            {data.items.map(m => (
              <div key={m.id} className={`list-row msg-row ${m.is_read ? '' : 'unread'}`} onClick={() => view(m)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && view(m)}>
                <div className="list-row__main">
                  <div className="list-row__title" style={{ fontWeight: m.is_read ? 500 : 650 }}>{m.name} <span className="muted small" style={{ fontWeight: 400 }}>&lt;{m.email}&gt;</span></div>
                  <div className="list-row__sub"><strong style={{ color: 'var(--text-soft)' }}>{m.subject || 'No subject'}</strong> — {m.message}</div>
                </div>
                <span className="muted small">{timeAgo(m.created_at)}</span>
                <div className="list-row__actions" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" icon={m.is_read ? Mail : MailOpen} title={m.is_read ? 'Mark unread' : 'Mark read'} aria-label={m.is_read ? 'Mark unread' : 'Mark read'} onClick={() => markRead(m, !m.is_read)} />
                  <Button size="sm" variant="danger-ghost" icon={Trash2} title="Delete" aria-label="Delete" onClick={() => remove(m)} />
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}
      <div style={{ marginTop: 16 }}><Notice>You can turn message storage off in Site Settings → Contact form.</Notice></div>

      {open && (
        <Modal size="md" title={open.subject || 'Message'} onClose={() => setOpen(null)}
          footer={<>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => remove(open)} style={{ marginRight: 'auto' }}>Delete</Button>
            <a className="btn btn--primary" href={`mailto:${open.email}?subject=${encodeURIComponent('Re: ' + (open.subject || 'Your inquiry'))}`}><Reply size={16} /> Reply by email</a>
          </>}>
          <div className="stack" style={{ gap: 14 }}>
            <div><strong>{open.name}</strong> <span className="muted">&lt;{open.email}&gt;</span><div className="muted small">{new Date(open.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</div></div>
            <div className="msg-body">{open.message}</div>
          </div>
        </Modal>
      )}
    </>
  );
}
