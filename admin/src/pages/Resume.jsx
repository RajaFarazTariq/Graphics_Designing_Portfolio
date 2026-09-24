import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Pencil, Trash2, UploadCloud } from 'lucide-react';
import { api, mediaSrc, formatBytes, timeAgo } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { Button, EmptyState, ErrorState, Notice, PageHeader, Spinner, Toggle } from '../components/ui.jsx';

export default function Resume() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi('/resumes');
  const [uploading, setUploading] = useState(false);
  const [activate, setActivate] = useState(true);
  const [label, setLabel] = useState('');
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (file.type && file.type !== 'application/pdf') { toast.error('Please choose a PDF file.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('The PDF is larger than 15 MB.'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', label || file.name.replace(/\.pdf$/i, ''));
    fd.append('activate', String(activate));
    setUploading(true);
    try {
      await api.upload('/resumes', fd);
      toast.success(activate ? 'Resume uploaded and now live on the site' : 'Resume uploaded');
      setLabel('');
      reload(true);
    } catch (e) { toast.error(e); }
    finally { setUploading(false); }
  };

  const setActive = async (r) => {
    try { await api.post(`/resumes/${r.id}/activate`); toast.success(`“${r.label}” is now the active resume`); reload(true); }
    catch (e) { toast.error(e); }
  };
  const rename = async (r) => {
    const next = window.prompt('Resume label', r.label);
    if (next === null || !next.trim() || next === r.label) return;
    try { await api.patch(`/resumes/${r.id}`, { label: next.trim() }); reload(true); }
    catch (e) { toast.error(e); }
  };
  const remove = async (r) => {
    const ok = await confirm({
      title: 'Delete resume?',
      message: r.is_active
        ? <>“<strong>{r.label}</strong>” is the <strong>active</strong> resume. Deleting it hides the “Download CV” buttons until you activate another one.</>
        : <>“<strong>{r.label}</strong>” will be deleted.</>,
    });
    if (!ok) return;
    try { await api.del(`/resumes/${r.id}`); toast.success('Resume deleted'); reload(true); }
    catch (e) { toast.error(e); }
  };

  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Resume / CV" description="The active resume is linked from the “Download CV” and “View Full Resume” buttons on the site." />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__head"><div><h2>Upload a new resume</h2><p>PDF only, up to 15 MB.</p></div></div>
        <div className="card__body stack" style={{ gap: 14 }}>
          <input className="input" placeholder="Label (optional), e.g. Resume — 2026" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} aria-label="Resume label" />
          <Toggle checked={activate} onChange={setActivate} label="Make it the active resume" description="Replaces the current one on the site immediately." />
          <div>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => { upload(e.target.files[0]); e.target.value = ''; }} />
            <Button variant="primary" icon={UploadCloud} loading={uploading} onClick={() => fileRef.current?.click()}>Choose PDF…</Button>
          </div>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={FileText} title="No resume uploaded" text="The CV buttons are hidden on the site until you upload one." /></div>
      ) : (
        <>
          {!data.some(r => r.is_active) && <div style={{ marginBottom: 12 }}><Notice warn>No resume is active — the CV buttons are currently hidden on the site.</Notice></div>}
          <div className="card list">
            {data.map(r => (
              <div className="list-row" key={r.id}>
                <span className="thumb" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}><FileText size={20} /></span>
                <div className="list-row__main">
                  <div className="list-row__title">{r.label} {r.is_active ? <span className="badge badge--published">Active</span> : null}</div>
                  <div className="list-row__sub">{r.original_name} · {formatBytes(r.size)} · uploaded {timeAgo(r.created_at)}</div>
                </div>
                <div className="list-row__actions">
                  {!r.is_active && <Button size="sm" icon={CheckCircle2} onClick={() => setActive(r)}>Set active</Button>}
                  <a className="btn btn--ghost btn--sm btn--icon" href={mediaSrc(r.url)} target="_blank" rel="noreferrer" title="View / download" aria-label="View or download"><Download size={14} /></a>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => rename(r)} title="Rename" aria-label="Rename" />
                  <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => remove(r)} title="Delete" aria-label="Delete" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
