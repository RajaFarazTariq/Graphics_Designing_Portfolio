import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, Eye, EyeOff, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useApi, useForm } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { SortableList } from '../components/Sortable.jsx';
import {
  Button, EmptyState, ErrorState, Modal, Notice, PageHeader, SearchInput, Spinner, StatusBadge, SelectField, STATUS_OPTIONS,
} from '../components/ui.jsx';

/**
 * Generic list + editor for a repeatable collection. See ./collections.jsx for the configs.
 * `embedded` renders inside another page (e.g. stats on the Profile page) with an optional fixed filter.
 */
export default function CollectionPage({ config, embedded = false, fixed = {} }) {
  const toast = useToast();
  const confirm = useConfirm();
  const outlet = useOutletContext() || {};
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [featured, setFeatured] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const listPath = `${config.endpoint}${qs({ ...fixed, q, status, featured, pageSize: 500 })}`;
  const { data, loading, error, reload, setData } = useApi(listPath);
  const { data: meta } = useApi(config.needsMeta ? '/meta' : null);
  const filtered = !!(q || status || featured);
  const items = data?.items || [];
  const hasFeatured = config.featured !== false && config.hasFeatured;
  const hasStatus = config.hasStatus !== false;

  const refresh = () => { reload(true); outlet.refreshCounts?.(); };

  const reorder = async (next) => {
    const prev = items;
    setData(d => ({ ...d, items: next }));
    try {
      await api.post(`${config.endpoint}/reorder`, { ids: next.map(i => i.id) });
      toast.success('Order saved');
    } catch (e) {
      setData(d => ({ ...d, items: prev }));
      toast.error(e);
    }
  };

  const patch = async (item, changes, message) => {
    try {
      await api.patch(`${config.endpoint}/${item.id}`, changes);
      toast.success(message);
      refresh();
    } catch (e) { toast.error(e); }
  };

  const duplicate = async (item) => {
    try {
      const copy = await api.post(`${config.endpoint}/${item.id}/duplicate`);
      toast.success('Duplicated as a draft');
      refresh();
      setEditing(copy);
    } catch (e) { toast.error(e); }
  };

  const remove = async (item) => {
    const name = config.row(item, meta).title;
    const ok = await confirm({
      title: `Delete ${config.singular}?`,
      message: <>“<strong>{name}</strong>” will be permanently deleted{config.deleteNote ? <>. {config.deleteNote}</> : '.'} This cannot be undone.</>,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.del(`${config.endpoint}/${item.id}`);
      toast.success(`${capital(config.singular)} deleted`);
      refresh();
    } catch (e) { toast.error(e); }
  };

  const header = (
    <PageHeader title={config.title} description={config.description}
      actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add {config.singular}</Button>} />
  );

  const body = (
    <>
      {!embedded && config.notice && <div style={{ marginBottom: 16 }}><Notice>{config.notice}</Notice></div>}
      {!embedded && (
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${config.title.toLowerCase()}…`} />
          {hasStatus && (
            <select className="select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="unpublished">Unpublished</option>
            </select>
          )}
          {hasFeatured && (
            <select className="select" value={featured} onChange={e => setFeatured(e.target.value)} aria-label="Filter by featured">
              <option value="">Featured & not</option><option value="1">Featured only</option><option value="0">Not featured</option>
            </select>
          )}
          <span className="toolbar__spacer" />
          <span className="muted small">{filtered ? 'Clear filters to reorder' : items.length > 1 ? 'Drag ⠿ to reorder' : ''}</span>
        </div>
      )}

      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !items.length ? (
        <div className={embedded ? '' : 'card'}>
          <EmptyState icon={config.icon} title={filtered ? 'Nothing matches your filters' : `No ${config.title.toLowerCase()} yet`}
            text={filtered ? 'Try clearing the search or filters.' : config.emptyText}
            action={!filtered && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add {config.singular}</Button>} />
        </div>
      ) : (
        <div className={embedded ? '' : 'card'}>
          <SortableList items={items} onReorder={reorder} disabled={filtered} className="list" renderItem={(item, handle) => {
            const r = config.row(item, meta);
            return (
              <div className="list-row">
                {handle}
                {r.thumb}
                <div className="list-row__main">
                  <div className="list-row__title">
                    {r.title}
                    {hasStatus && item.status !== 'published' && <StatusBadge status={item.status} />}
                    {hasFeatured && item.is_featured ? <span className="badge badge--featured">Featured</span> : null}
                    {r.badges}
                  </div>
                  {r.sub && <div className="list-row__sub">{r.sub}</div>}
                </div>
                <div className="list-row__actions">
                  {hasFeatured && (
                    <Button variant="ghost" size="sm" icon={Star} aria-label={item.is_featured ? 'Unfeature' : 'Feature'} title={item.is_featured ? 'Unfeature' : 'Mark as featured'}
                      style={item.is_featured ? { color: 'var(--accent)' } : undefined}
                      onClick={() => patch(item, { is_featured: !item.is_featured }, item.is_featured ? 'Removed from featured' : 'Marked as featured')} />
                  )}
                  {hasStatus && (
                    <Button variant="ghost" size="sm" icon={item.status === 'published' ? Eye : EyeOff}
                      title={item.status === 'published' ? 'Published — click to unpublish' : 'Hidden — click to publish'}
                      aria-label={item.status === 'published' ? 'Unpublish' : 'Publish'}
                      onClick={() => patch(item, { status: item.status === 'published' ? 'unpublished' : 'published' }, item.status === 'published' ? 'Unpublished' : 'Published')} />
                  )}
                  {config.duplicable !== false && <Button variant="ghost" size="sm" icon={Copy} title="Duplicate" aria-label="Duplicate" onClick={() => duplicate(item)} />}
                  <Button variant="ghost" size="sm" icon={Pencil} title="Edit" aria-label="Edit" onClick={() => setEditing(item)} />
                  <Button variant="danger-ghost" size="sm" icon={Trash2} title="Delete" aria-label="Delete" onClick={() => remove(item)} />
                </div>
              </div>
            );
          }} />
        </div>
      )}

      {editing && (
        <ItemEditor config={config} meta={meta} item={editing === 'new' ? null : editing} fixed={fixed}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="card">
        <div className="card__head">
          <div><h3>{config.title}</h3>{config.description && <p>{config.description}</p>}</div>
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>Add</Button>
        </div>
        {body}
      </div>
    );
  }
  return <>{header}{body}</>;
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function ItemEditor({ config, meta, item, fixed, onClose, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const initial = useMemo(() => (item ? (config.toForm ? config.toForm(item) : { ...item }) : { ...config.defaults, ...fixed }), [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const form = useForm(initial);
  const [saving, setSaving] = useState(false);
  const hasStatus = config.hasStatus !== false;

  const close = async () => {
    if (form.dirty && !(await confirm({ title: 'Discard changes?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard' }))) return;
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = config.toPayload ? config.toPayload(form.values) : form.values;
      if (item) await api.put(`${config.endpoint}/${item.id}`, payload);
      else await api.post(config.endpoint, payload);
      toast.success(item ? 'Changes saved' : `${capital(config.singular)} added`);
      onSaved();
    } catch (e) {
      form.setErrors(e.fields || {});
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal drawer title={item ? `Edit ${config.singular}` : `New ${config.singular}`} onClose={close}
      footer={<>
        <span className="muted small" style={{ marginRight: 'auto' }}>{form.dirty ? 'Unsaved changes' : ''}</span>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={save}>{item ? 'Save changes' : `Add ${config.singular}`}</Button>
      </>}>
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="form-grid">
          {config.form({ form, meta, item })}
          {hasStatus && <SelectField className="full" form={form} name="status" label="Visibility" options={STATUS_OPTIONS} />}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
