import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Eye, ImagePlus, Info, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { api, mediaSrc } from '../lib/api.js';
import { useApi, useForm, useUnsavedGuard } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { SortableList } from '../components/Sortable.jsx';
import { MediaLibraryModal, FormImageField } from '../components/MediaPicker.jsx';
import {
  Button, ErrorState, Field, PageHeader, SelectField, Spinner, STATUS_OPTIONS, TagField, TextArea, TextField, ToggleField, Notice,
} from '../components/ui.jsx';

const EMPTY = {
  title: '', slug: '', short_description: '', full_description: '', category_id: null, client: '', project_date: '',
  project_url: '', github_url: '', behance_url: '', dribbble_url: '', tags: [], tools: [],
  thumbnail_media_id: null, main_media_id: null, featured_media_id: null, image_alt: '',
  is_featured: 0, status: 'draft', gallery: [],
};

const toForm = (p) => ({
  ...EMPTY, ...p,
  project_date: p.project_date || '',
  gallery: (p.gallery || []).map(g => ({ media_id: g.media_id, caption: g.caption || '', media: { id: g.media_id, url: g.url, original_name: g.original_name, width: g.width, height: g.height } })),
});

export default function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const outlet = useOutletContext() || {};
  const { data, loading, error, reload } = useApi(isNew ? null : `/projects/${id}`);
  const { data: cats } = useApi('/project-categories?pageSize=200');
  const form = useForm(EMPTY);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null); // { mode: 'add' } | { mode: 'replace', index }

  useEffect(() => { if (data) form.reset(toForm(data)); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const bypassGuard = useUnsavedGuard(form.dirty && !saving, confirm);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!isNew && (loading || !data)) return <Spinner />;

  const v = form.values;
  const gallery = v.gallery || [];
  const setGallery = (g) => form.set('gallery', g);

  const save = async ({ preview = false, statusOverride } = {}) => {
    const previewWin = preview ? window.open('about:blank', '_blank') : null;
    setSaving(true);
    try {
      const payload = { ...v, ...(statusOverride ? { status: statusOverride } : {}), gallery: gallery.map(g => ({ media_id: g.media_id, caption: g.caption })) };
      const saved = isNew ? await api.post('/projects', payload) : await api.put(`/projects/${id}`, payload);
      form.reset(toForm(saved));
      outlet.refreshCounts?.();
      toast.success(isNew ? 'Project created' : 'Project saved');
      if (previewWin) previewWin.location.href = '/preview#work';
      if (isNew) { bypassGuard(); navigate(`/projects/${saved.id}`, { replace: true }); }
    } catch (e) {
      previewWin?.close();
      form.setErrors(e.fields || {});
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Delete project?', message: <>“<strong>{v.title}</strong>” will be permanently deleted. Images stay in the Media Library.</> });
    if (!ok) return;
    try { await api.del(`/projects/${id}`); toast.success('Project deleted'); outlet.refreshCounts?.(); bypassGuard(); navigate('/projects'); }
    catch (e) { toast.error(e); }
  };

  const duplicate = async () => {
    if (form.dirty && !(await confirm({ title: 'Duplicate without saving?', message: 'The copy is made from the last saved version. Your unsaved changes on this page will be discarded.', confirmLabel: 'Duplicate', danger: false }))) return;
    try { const copy = await api.post(`/projects/${id}/duplicate`); toast.success('Duplicated as a draft'); bypassGuard(); navigate(`/projects/${copy.id}`); }
    catch (e) { toast.error(e); }
  };

  const onPicked = (picked) => {
    const list = Array.isArray(picked) ? picked : [picked];
    if (picker.mode === 'replace') {
      const m = list[0];
      if (gallery.some((g, i) => g.media_id === m.id && i !== picker.index)) { toast.info('That image is already in the gallery.'); }
      else setGallery(gallery.map((g, i) => (i === picker.index ? { ...g, media_id: m.id, media: m } : g)));
    } else {
      const fresh = list.filter(m => !gallery.some(g => g.media_id === m.id));
      if (fresh.length < list.length) toast.info('Images already in the gallery were skipped.');
      const next = [...gallery, ...fresh.map(m => ({ media_id: m.id, caption: '', media: m }))];
      setGallery(next);
      // First image becomes the thumbnail/main image if none is set yet.
      if (!v.thumbnail_media_id && next[0]) { form.set('thumbnail_media_id', next[0].media_id); form.set('thumbnail_media', next[0].media); }
      if (!v.main_media_id && next[0]) { form.set('main_media_id', next[0].media_id); form.set('main_media', next[0].media); }
    }
    setPicker(null);
  };

  const assignImage = (g, key) => { form.set(`${key}_media_id`, g.media_id); form.set(`${key}_media`, g.media); toast.info(`Set as ${key} image`); };

  return (
    <>
      <PageHeader back={{ to: '/projects', label: 'All projects' }} title={isNew ? 'New project' : v.title || 'Untitled project'}
        actions={<>
          {!isNew && <Button icon={Copy} onClick={duplicate}>Duplicate</Button>}
          <Button icon={Eye} onClick={() => save({ preview: true })} loading={saving}>Save & preview</Button>
          <Button variant="primary" icon={Save} onClick={() => save()} loading={saving}>{isNew ? 'Create project' : 'Save changes'}</Button>
        </>} />

      <div className="editor-grid">
        <div className="stack">
          <div className="card">
            <div className="card__head"><h2>Details</h2></div>
            <div className="card__body form-grid">
              <TextField className="full" form={form} name="title" label="Project title" required max={140} />
              <TextArea className="full" form={form} name="short_description" label="Short description" required rows={3} max={400} hint="Shown on the project card in the grid." />
              <TextArea className="full" form={form} name="full_description" label="Full description" rows={6} max={5000} hint="Shown when the project is opened. Falls back to the short description if empty." />
              <SelectField form={form} name="category_id" label="Category" placeholder="Uncategorised"
                parse={x => (x ? Number(x) : null)} options={(cats?.items || []).map(c => ({ value: c.id, label: c.label }))}
                hint="Controls which filter button shows it." />
              <TextField form={form} name="client" label="Client" max={120} />
              <TextField form={form} name="project_date" label="Date" type="month" />
              <TextField form={form} name="slug" label="URL slug" max={80} placeholder="auto-generated from the title" hint="Lowercase letters, numbers and dashes." />
              <div className="full"><TagField form={form} name="tags" label="Tags" hint="Shown as small tags on the card — e.g. Logo, Monogram." max={8} /></div>
              <div className="full"><TagField form={form} name="tools" label="Tools / technologies" hint="Shown under the description — e.g. Illustrator, Photoshop." max={12} /></div>
            </div>
          </div>

          <div className="card">
            <div className="card__head"><div><h2>Images</h2><p>Pick from the Media Library or upload new files — the same file can be reused across projects.</p></div></div>
            <div className="card__body form-grid">
              <FormImageField form={form} name="thumbnail" label="Thumbnail" hint="The image on the project card." wide />
              <FormImageField form={form} name="main" label="Main image" hint="Shown large when the project is opened." wide />
              <FormImageField form={form} name="featured" label="Featured image" hint="Optional alternate cover (stored for featured use)." wide />
              <TextField form={form} name="image_alt" label="Image description (alt text)" max={200} hint="Describes the image for screen readers and SEO." />
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div><h2>Gallery</h2><p>{gallery.length ? `${gallery.length} image${gallery.length > 1 ? 's' : ''} · drag to reorder` : 'Add as many images as you like.'}</p></div>
              <Button size="sm" icon={ImagePlus} onClick={() => setPicker({ mode: 'add' })}>Add images</Button>
            </div>
            <div className="card__body">
              <div style={{ marginBottom: 14 }}><Notice>The current project popup shows one image, so the gallery is stored with the project and available from the public API. The popup uses the <strong>main image</strong>.</Notice></div>
              <SortableList grid items={gallery} getId={g => g.media_id} onReorder={setGallery} className="gallery" renderItem={(g, handle) => {
                const i = gallery.findIndex(x => x.media_id === g.media_id);
                return (
                  <div className="gallery-item">
                    <img src={mediaSrc(g.media?.url)} alt="" />
                    <div className="gallery-item__bar">
                      {handle}
                      <Button size="sm" variant="ghost" icon={RefreshCw} title="Replace image" aria-label="Replace image" onClick={() => setPicker({ mode: 'replace', index: i })} />
                      <Button size="sm" variant="danger-ghost" icon={Trash2} title="Remove from gallery" aria-label="Remove from gallery" onClick={() => setGallery(gallery.filter((_, j) => j !== i))} />
                    </div>
                    <div style={{ padding: '0 6px 6px' }}>
                      <input className="input" style={{ height: 30, fontSize: 12.5 }} placeholder="Caption" value={g.caption} maxLength={200}
                        onChange={e => setGallery(gallery.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} aria-label="Caption" />
                      <div className="row" style={{ marginTop: 4, gap: 4 }}>
                        <button type="button" className="btn btn--ghost btn--sm" style={{ height: 24, fontSize: 11.5, padding: '0 6px' }} onClick={() => assignImage(g, 'thumbnail')}>Use as thumb</button>
                        <button type="button" className="btn btn--ghost btn--sm" style={{ height: 24, fontSize: 11.5, padding: '0 6px' }} onClick={() => assignImage(g, 'main')}>Use as main</button>
                      </div>
                    </div>
                  </div>
                );
              }} />
              {!gallery.length && (
                <button type="button" className="gallery-add" style={{ width: 160 }} onClick={() => setPicker({ mode: 'add' })}>
                  <span><ImagePlus size={22} style={{ margin: '0 auto 6px' }} />Add images</span>
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><div><h2>Links</h2><p>Optional — stored with the project and available from the public API.</p></div></div>
            <div className="card__body form-grid">
              <TextField form={form} name="project_url" label="Project URL" placeholder="https://" />
              <TextField form={form} name="behance_url" label="Behance URL" placeholder="https://www.behance.net/…" />
              <TextField form={form} name="dribbble_url" label="Dribbble URL" placeholder="https://dribbble.com/…" />
              <TextField form={form} name="github_url" label="GitHub URL" placeholder="https://github.com/…" />
            </div>
          </div>
        </div>

        <div className="stack editor-side">
          <div className="card">
            <div className="card__head"><h2>Publishing</h2></div>
            <div className="card__body stack" style={{ gap: 16 }}>
              <SelectField form={form} name="status" label="Status" options={STATUS_OPTIONS} error={form.errors.status} />
              <ToggleField form={form} name="is_featured" label="Featured project" description="Highlight this project (filterable in the admin)." />
              {form.errors.thumbnail_media_id && <div className="field__error">{form.errors.thumbnail_media_id}</div>}
              <div className="stack" style={{ gap: 8 }}>
                <Button variant="primary" block loading={saving} onClick={() => save()}>{isNew ? 'Create project' : 'Save changes'}</Button>
                {v.status !== 'published' && <Button block loading={saving} onClick={() => save({ statusOverride: 'published' })}>Save & publish</Button>}
                <Button block variant="ghost" icon={Eye} onClick={() => save({ preview: true })}>Save & preview</Button>
              </div>
              <div className="muted small row" style={{ alignItems: 'flex-start' }}><Info size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Drafts are only visible in Preview. Published projects appear on the live site immediately.</div>
              {form.dirty && <div className="small" style={{ color: 'var(--warning)' }}>● Unsaved changes</div>}
            </div>
          </div>
          {!isNew && (
            <div className="card">
              <div className="card__body stack" style={{ gap: 8 }}>
                <div className="muted small">Created {new Date(data.created_at.replace(' ', 'T') + 'Z').toLocaleString()}<br />Updated {new Date(data.updated_at.replace(' ', 'T') + 'Z').toLocaleString()}</div>
                <Button variant="danger-ghost" icon={Trash2} onClick={remove}>Delete project</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {picker && <MediaLibraryModal kind="image" multiple={picker.mode === 'add'} title={picker.mode === 'add' ? 'Add gallery images' : 'Replace image'}
        onClose={() => setPicker(null)} onSelect={onPicked} />}
    </>
  );
}
