import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { SortableList } from '../components/Sortable.jsx';
import { Button, Modal, Spinner, ErrorState } from '../components/ui.jsx';

/** Project categories = the filter buttons above the project grid. */
export default function CategoryManager({ onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload, setData } = useApi('/project-categories?pageSize=200');
  const [newLabel, setNewLabel] = useState('');
  const [editing, setEditing] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e?.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    try { await api.post('/project-categories', { label: newLabel.trim() }); setNewLabel(''); toast.success('Category added'); reload(true); }
    catch (err) { toast.error(err); }
    finally { setBusy(false); }
  };
  const rename = async (c) => {
    try { await api.put(`/project-categories/${c.id}`, { label: editLabel, slug: c.slug }); setEditing(null); toast.success('Category renamed'); reload(true); }
    catch (err) { toast.error(err); }
  };
  const remove = async (c) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: c.project_count
        ? <>“<strong>{c.label}</strong>” is used by {c.project_count} project{c.project_count > 1 ? 's' : ''}. They will become uncategorised (and only appear under “All Work”).</>
        : <>“<strong>{c.label}</strong>” will be deleted.</>,
    });
    if (!ok) return;
    try { await api.del(`/project-categories/${c.id}`); toast.success('Category deleted'); reload(true); }
    catch (err) { toast.error(err); }
  };
  const reorder = async (next) => {
    const prev = data.items;
    setData(d => ({ ...d, items: next }));
    try { await api.post('/project-categories/reorder', { ids: next.map(c => c.id) }); }
    catch (err) { setData(d => ({ ...d, items: prev })); toast.error(err); }
  };

  return (
    <Modal size="md" title="Project categories" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <p className="muted" style={{ marginBottom: 16 }}>Categories become the filter buttons above your projects. Only categories with at least one published project are shown on the site.</p>
      <form className="row" onSubmit={add} style={{ marginBottom: 16 }}>
        <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New category name, e.g. Packaging" maxLength={60} aria-label="New category name" />
        <Button type="submit" variant="primary" icon={Plus} loading={busy} disabled={!newLabel.trim()}>Add</Button>
      </form>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : (
        <div className="card">
          <SortableList items={data.items} onReorder={reorder} className="list" renderItem={(c, handle) => (
            <div className="list-row">
              {handle}
              <div className="list-row__main">
                {editing === c.id ? (
                  <input className="input" autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') rename(c); if (e.key === 'Escape') setEditing(null); }} aria-label="Category name" />
                ) : (
                  <>
                    <div className="list-row__title">{c.label}</div>
                    <div className="list-row__sub">{c.project_count} project{c.project_count === 1 ? '' : 's'} · filter key “{c.slug}”</div>
                  </>
                )}
              </div>
              <div className="list-row__actions">
                {editing === c.id ? (
                  <>
                    <Button size="sm" variant="primary" icon={Check} onClick={() => rename(c)} aria-label="Save" />
                    <Button size="sm" variant="ghost" icon={X} onClick={() => setEditing(null)} aria-label="Cancel" />
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setEditing(c.id); setEditLabel(c.label); }} aria-label="Rename" />
                    <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => remove(c)} aria-label="Delete" />
                  </>
                )}
              </div>
            </div>
          )} />
        </div>
      )}
    </Modal>
  );
}
