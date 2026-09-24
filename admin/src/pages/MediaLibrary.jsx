import { useEffect, useState } from 'react';
import { Copy, ExternalLink, FileText, Images, Trash2 } from 'lucide-react';
import { api, qs, mediaSrc, formatBytes, timeAgo } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { Dropzone } from '../components/MediaPicker.jsx';
import { Button, EmptyState, ErrorState, Field, Modal, PageHeader, Pagination, SearchInput, Spinner } from '../components/ui.jsx';

const PAGE_SIZE = 30;

export default function MediaLibrary() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, reload } = useApi(`/media${qs({ q, kind, sort, page, pageSize: PAGE_SIZE })}`);

  return (
    <>
      <PageHeader title="Media Library" description="Every image and document used on the site. Upload once, reuse anywhere — identical files are never stored twice." />
      <div style={{ marginBottom: 18 }}><Dropzone kind="all" onUploaded={() => { setPage(1); reload(true); }} /></div>
      <div className="toolbar">
        <SearchInput value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name or alt text…" />
        <select className="select" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} aria-label="File type">
          <option value="">All files</option><option value="image">Images</option><option value="document">Documents</option>
        </select>
        <select className="select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          <option value="">Newest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option>
        </select>
        <span className="toolbar__spacer" />
        {data && <span className="muted small">{data.total} file{data.total === 1 ? '' : 's'}</span>}
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !data.items.length ? (
        <div className="card"><EmptyState icon={Images} title={q || kind ? 'No matching files' : 'Your library is empty'} text={q || kind ? 'Try another search.' : 'Upload images and documents above.'} /></div>
      ) : (
        <>
          <div className="media-grid">
            {data.items.map(m => (
              <button type="button" key={m.id} className="media-tile" onClick={() => setOpenId(m.id)} title={m.original_name}>
                {m.kind === 'image' ? <img src={mediaSrc(m.url)} alt={m.alt_text} loading="lazy" /> : <div className="media-tile__doc"><FileText size={34} /></div>}
                <span className="media-tile__usage">
                  {m.usage_count ? <span className="badge badge--published">In use · {m.usage_count}</span> : <span className="badge badge--unpublished">Unused</span>}
                </span>
                <span className="media-tile__label">{m.original_name}</span>
              </button>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}

      {openId && <MediaDetails id={openId} onClose={() => setOpenId(null)} onChanged={() => reload(true)} />}
    </>
  );
}

function MediaDetails({ id, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi(`/media/${id}`);
  const [alt, setAlt] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setAlt(data.alt_text); setName(data.original_name); } }, [data]);

  const save = async () => {
    setSaving(true);
    try { await api.patch(`/media/${id}`, { alt_text: alt, original_name: name }); toast.success('File details saved'); onChanged(); reload(true); }
    catch (e) { toast.error(e); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    const ok = await confirm({ title: 'Delete file?', message: <>“<strong>{data.original_name}</strong>” will be removed from the library{data.is_original ? ' (the original file shipped with the site stays on disk)' : ''}. This cannot be undone.</> });
    if (!ok) return;
    try { await api.del(`/media/${id}`); toast.success('File deleted'); onChanged(); onClose(); }
    catch (e) { toast.error(e); reload(true); }
  };
  const fullUrl = data ? new URL(mediaSrc(data.url), window.location.origin).href : '';

  return (
    <Modal size="md" title="File details" onClose={onClose}
      footer={data && <>
        <Button variant="danger-ghost" icon={Trash2} onClick={remove} disabled={data.usage.length > 0} title={data.usage.length ? 'Remove it from the places below first' : undefined} style={{ marginRight: 'auto' }}>Delete</Button>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" loading={saving} onClick={save} disabled={alt === data.alt_text && name === data.original_name}>Save</Button>
      </>}>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading || !data ? <Spinner /> : (
        <div className="stack" style={{ gap: 18 }}>
          <div style={{ background: 'var(--surface-hover)', borderRadius: 12, overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: 180 }}>
            {data.kind === 'image' ? <img src={mediaSrc(data.url)} alt={data.alt_text} style={{ maxHeight: 360, objectFit: 'contain' }} />
              : <div className="stack" style={{ alignItems: 'center', padding: 30, gap: 10 }}><FileText size={42} className="muted" /><a className="btn btn--secondary btn--sm" href={mediaSrc(data.url)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open PDF</a></div>}
          </div>
          <div className="muted small">
            {data.mime_type} · {formatBytes(data.size)}{data.width ? ` · ${data.width}×${data.height}px` : ''} · added {timeAgo(data.created_at)}
          </div>
          <div className="form-grid">
            <Field label="File name"><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={200} /></Field>
            <Field label="Link">
              <div className="row">
                <input className="input" readOnly value={fullUrl} onFocus={e => e.target.select()} />
                <Button icon={Copy} onClick={() => { navigator.clipboard?.writeText(fullUrl); toast.success('Link copied'); }} aria-label="Copy link" />
              </div>
            </Field>
            {data.kind === 'image' && <Field className="full" label="Alt text" hint="Describes the image for accessibility and SEO."><input className="input" value={alt} onChange={e => setAlt(e.target.value)} maxLength={200} /></Field>}
          </div>
          <div>
            <div className="field__label" style={{ marginBottom: 8 }}>Used in</div>
            {data.usage.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.usage.map((u, i) => <li key={i}><strong>{u.type}</strong>{u.title ? ` — ${u.title}` : ''}</li>)}
              </ul>
            ) : <span className="muted">Not used anywhere — safe to delete.</span>}
          </div>
        </div>
      )}
    </Modal>
  );
}
