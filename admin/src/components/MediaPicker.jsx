import { useRef, useState } from 'react';
import { Check, FileText, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { api, qs, mediaSrc, formatBytes } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useToast } from './feedback.jsx';
import { Button, Field, Modal, Pagination, SearchInput, Spinner, EmptyState, ErrorState } from './ui.jsx';

const ACCEPT = { image: 'image/jpeg,image/png,image/webp,image/gif,image/avif', document: 'application/pdf', all: 'image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf' };

/** Uploads files to the media library; returns the stored media items. */
export function useUploader(kind = 'image') {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return [];
    const maxMb = kind === 'document' ? 15 : 10;
    const tooBig = files.filter(f => f.size > maxMb * 1024 * 1024);
    if (tooBig.length) toast.error(`${tooBig.map(f => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} larger than ${maxMb} MB.`);
    const ok = files.filter(f => f.size <= maxMb * 1024 * 1024);
    if (!ok.length) return [];
    const fd = new FormData();
    ok.forEach(f => fd.append('files', f));
    setUploading(true);
    try {
      const res = await api.upload(`/media${qs({ kind: kind === 'all' ? '' : kind })}`, fd);
      res.errors?.forEach(e => toast.error(e));
      const dupes = res.items.filter(i => i.duplicate).length;
      const fresh = res.items.length - dupes;
      if (fresh) toast.success(`${fresh} file${fresh > 1 ? 's' : ''} uploaded`);
      if (dupes) toast.info(`${dupes} file${dupes > 1 ? 's were' : ' was'} already in the library — reusing the existing copy.`);
      return res.items;
    } catch (e) {
      toast.error(e);
      return [];
    } finally {
      setUploading(false);
    }
  };
  return { upload, uploading };
}

export function Dropzone({ kind = 'image', multiple = true, onUploaded, compact }) {
  const { upload, uploading } = useUploader(kind);
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const handle = async (files) => { const items = await upload(files); if (items.length) onUploaded?.(items); };
  return (
    <div className={`dropzone ${over ? 'over' : ''}`} role="button" tabIndex={0}
      style={compact ? { padding: 16 } : undefined}
      onClick={() => !uploading && input.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}>
      <input ref={input} type="file" hidden multiple={multiple} accept={ACCEPT[kind]} onChange={e => { handle(e.target.files); e.target.value = ''; }} />
      <div className="dropzone__icon">{uploading ? <UploadCloud size={20} className="spin" /> : <UploadCloud size={20} />}</div>
      <strong>{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</strong>
      <div className="muted small" style={{ marginTop: 4 }}>
        {kind === 'document' ? 'PDF up to 15 MB' : kind === 'all' ? 'JPG, PNG, WebP, GIF, AVIF up to 10 MB · PDF up to 15 MB' : 'JPG, PNG, WebP, GIF or AVIF — up to 10 MB each'}
      </div>
    </div>
  );
}

/** Library browser used inside pickers. */
export function MediaLibraryModal({ kind = 'image', multiple = false, onSelect, onClose, title }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const pageSize = 24;
  const { data, loading, error, reload } = useApi(`/media${qs({ q, kind: kind === 'all' ? '' : kind, page, pageSize })}`);
  const toggle = (m) => {
    if (!multiple) { setSelected([m]); return; }
    setSelected(s => (s.some(x => x.id === m.id) ? s.filter(x => x.id !== m.id) : [...s, m]));
  };
  const onUploaded = (items) => {
    reload();
    if (multiple) setSelected(s => [...s, ...items.filter(i => !s.some(x => x.id === i.id))]);
    else setSelected([items[0]]);
  };
  return (
    <Modal size="lg" title={title || (multiple ? 'Select images' : 'Select from media library')} onClose={onClose}
      footer={<>
        <span className="muted small" style={{ marginRight: 'auto' }}>{selected.length ? `${selected.length} selected` : 'Upload new files or pick existing ones — files are reused, never duplicated.'}</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!selected.length} onClick={() => onSelect(multiple ? selected : selected[0])}>
          {multiple ? `Add ${selected.length || ''} image${selected.length === 1 ? '' : 's'}` : 'Use selected'}
        </Button>
      </>}>
      <div className="stack" style={{ gap: 16 }}>
        <Dropzone kind={kind} multiple={multiple} onUploaded={onUploaded} compact />
        <div className="toolbar" style={{ margin: 0 }}>
          <SearchInput value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by file name or alt text" />
        </div>
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !data.items.length ? (
          <EmptyState icon={ImagePlus} title={q ? 'No matching files' : 'No files yet'} text={q ? 'Try a different search.' : 'Upload your first file above.'} />
        ) : (
          <>
            <div className="media-grid">
              {data.items.map(m => {
                const on = selected.some(s => s.id === m.id);
                return (
                  <button type="button" key={m.id} className={`media-tile ${on ? 'selected' : ''}`} onClick={() => toggle(m)}
                    onDoubleClick={() => !multiple && onSelect(m)} title={m.original_name} aria-pressed={on}>
                    {m.kind === 'image' ? <img src={mediaSrc(m.url)} alt={m.alt_text} loading="lazy" /> : <div className="media-tile__doc"><FileText size={32} /></div>}
                    <span className="media-tile__label">{m.original_name}</span>
                    {on && <span className="media-tile__check"><Check size={14} /></span>}
                  </button>
                );
              })}
            </div>
            <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Single image field. `value` is a media object ({id,url,…}) or null.
 */
export function ImageField({ label, hint, value, onChange, error, wide, kind = 'image' }) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="image-field">
        <div className={`image-field__preview ${wide ? 'image-field__preview--wide' : ''}`}>
          {value ? (kind === 'image' ? <img src={mediaSrc(value.url)} alt="" /> : <FileText size={28} />) : <ImagePlus size={24} />}
        </div>
        <div className="image-field__info">
          {value && <span className="image-field__name" title={value.original_name}>{value.original_name || value.url}{value.width ? ` · ${value.width}×${value.height}` : ''}{value.size ? ` · ${formatBytes(value.size)}` : ''}</span>}
          <div className="row">
            <Button size="sm" icon={ImagePlus} onClick={() => setOpen(true)}>{value ? 'Replace' : 'Choose image'}</Button>
            {value && <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => onChange(null)}>Remove</Button>}
          </div>
        </div>
      </div>
      {open && <MediaLibraryModal kind={kind} onClose={() => setOpen(false)} onSelect={m => { onChange(m); setOpen(false); }} />}
    </Field>
  );
}

/** Binds an ImageField to `<name>_media_id` + `<name>_media` in a useForm form. */
export function FormImageField({ form, name, label, hint, wide }) {
  const idKey = `${name}_media_id`;
  const objKey = `${name}_media`;
  return (
    <ImageField label={label} hint={hint} wide={wide} error={form.errors[idKey]} value={form.values[objKey] || null}
      onChange={m => { form.set(objKey, m); form.set(idKey, m ? m.id : null); }} />
  );
}
