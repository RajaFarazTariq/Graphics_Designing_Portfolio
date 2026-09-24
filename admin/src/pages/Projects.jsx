import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Copy, Eye, EyeOff, FolderKanban, ImageOff, Pencil, Plus, Star, Tags, Trash2, Check } from 'lucide-react';
import { api, qs, mediaSrc } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { SortableList } from '../components/Sortable.jsx';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Spinner, StatusBadge } from '../components/ui.jsx';
import CategoryManager from './CategoryManager.jsx';

const PAGE_SIZE = 12;

export default function Projects() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const [params, setParams] = useSearchParams();
  const [reordering, setReordering] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const f = {
    q: params.get('q') || '', status: params.get('status') || '', featured: params.get('featured') || '',
    category_id: params.get('category') || '', sort: params.get('sort') || 'sort_order:asc', page: Number(params.get('page')) || 1,
  };
  const setF = (patch) => {
    const next = { ...f, page: 1, ...patch };
    const out = {};
    if (next.q) out.q = next.q;
    if (next.status) out.status = next.status;
    if (next.featured) out.featured = next.featured;
    if (next.category_id) out.category = next.category_id;
    if (next.sort !== 'sort_order:asc') out.sort = next.sort;
    if (next.page > 1) out.page = String(next.page);
    setParams(out);
  };
  const filtered = !!(f.q || f.status || f.featured || f.category_id || f.sort !== 'sort_order:asc');

  const path = reordering
    ? `/projects${qs({ pageSize: 500 })}`
    : `/projects${qs({ q: f.q, status: f.status, featured: f.featured, category_id: f.category_id, sort: f.sort, page: f.page, pageSize: PAGE_SIZE })}`;
  const { data, loading, error, reload, setData } = useApi(path);
  const { data: cats, reload: reloadCats } = useApi('/project-categories?pageSize=200');

  const refresh = () => { reload(true); outlet.refreshCounts?.(); };
  const patch = async (p, changes, msg) => {
    try { await api.patch(`/projects/${p.id}`, changes); toast.success(msg); refresh(); }
    catch (e) { toast.error(e); }
  };
  const duplicate = async (p) => {
    try { const copy = await api.post(`/projects/${p.id}/duplicate`); toast.success('Project duplicated as a draft'); navigate(`/projects/${copy.id}`); }
    catch (e) { toast.error(e); }
  };
  const remove = async (p) => {
    const ok = await confirm({
      title: 'Delete project?',
      message: <>“<strong>{p.title}</strong>” and its gallery list will be permanently deleted. The image files stay in the Media Library. This cannot be undone.</>,
    });
    if (!ok) return;
    try { await api.del(`/projects/${p.id}`); toast.success('Project deleted'); refresh(); }
    catch (e) { toast.error(e); }
  };
  const reorder = async (next) => {
    const prev = data.items;
    setData(d => ({ ...d, items: next }));
    try { await api.post('/projects/reorder', { ids: next.map(i => i.id) }); toast.success('Order saved'); }
    catch (e) { setData(d => ({ ...d, items: prev })); toast.error(e); }
  };

  const catName = (id) => cats?.items?.find(c => c.id === id)?.label;

  return (
    <>
      <PageHeader title="Projects" description="Your portfolio work. The order here is the order in the “Selected Work” grid."
        actions={<>
          <Button icon={Tags} onClick={() => setCatsOpen(true)}>Categories</Button>
          <Button icon={reordering ? Check : ArrowDownUp} variant={reordering ? 'primary' : 'secondary'}
            onClick={() => { if (!reordering) setParams({}); setReordering(r => !r); }}>{reordering ? 'Done reordering' : 'Reorder'}</Button>
          <Link className="btn btn--primary" to="/projects/new"><Plus size={16} /> New project</Link>
        </>} />

      {!reordering && (
        <div className="toolbar">
          <SearchInput value={f.q} onChange={q => setF({ q })} placeholder="Search title, client, tags, tools…" />
          <select className="select" value={f.category_id} onChange={e => setF({ category_id: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {cats?.items?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value="none">Uncategorised</option>
          </select>
          <select className="select" value={f.status} onChange={e => setF({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="unpublished">Unpublished</option>
          </select>
          <select className="select" value={f.featured} onChange={e => setF({ featured: e.target.value })} aria-label="Featured">
            <option value="">Featured & not</option><option value="1">Featured only</option><option value="0">Not featured</option>
          </select>
          <select className="select" value={f.sort} onChange={e => setF({ sort: e.target.value })} aria-label="Sort">
            <option value="sort_order:asc">Site order</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="created_at:desc">Newest first</option>
            <option value="title:asc">Title A–Z</option>
          </select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => setParams({})}>Clear</Button>}
        </div>
      )}
      {reordering && <p className="muted" style={{ marginBottom: 14 }}>Drag projects into the order you want. Changes are saved instantly.</p>}

      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : !data.items.length ? (
        <div className="card">
          <EmptyState icon={FolderKanban} title={filtered ? 'No projects match your filters' : 'No projects yet'}
            text={filtered ? 'Try a different search or clear the filters.' : 'Create your first project to show it on the portfolio.'}
            action={filtered ? <Button onClick={() => setParams({})}>Clear filters</Button> : <Link className="btn btn--primary" to="/projects/new"><Plus size={16} /> New project</Link>} />
        </div>
      ) : reordering ? (
        <div className="card">
          <SortableList items={data.items} onReorder={reorder} className="list" renderItem={(p, handle) => (
            <div className="list-row">
              {handle}
              <span className="thumb thumb--lg">{p.thumbnail_media || p.main_media ? <img src={mediaSrc((p.thumbnail_media || p.main_media).url)} alt="" /> : <ImageOff size={16} />}</span>
              <div className="list-row__main">
                <div className="list-row__title">{p.title} {p.status !== 'published' && <StatusBadge status={p.status} />}</div>
                <div className="list-row__sub">{p.category?.label || 'Uncategorised'}</div>
              </div>
            </div>
          )} />
        </div>
      ) : (
        <>
          <div className="project-grid">
            {data.items.map(p => {
              const img = p.thumbnail_media || p.main_media || p.featured_media;
              return (
                <article className="project-card" key={p.id}>
                  <Link to={`/projects/${p.id}`} className="project-card__img" aria-label={`Edit ${p.title}`}>
                    {img ? <img src={mediaSrc(img.url)} alt="" loading="lazy" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="muted"><ImageOff size={24} /></div>}
                    <div className="project-card__badges">
                      <StatusBadge status={p.status} />
                      {p.is_featured ? <span className="badge badge--featured">Featured</span> : null}
                    </div>
                  </Link>
                  <div className="project-card__body">
                    <div className="project-card__title">{p.title}</div>
                    <div className="project-card__meta">{[catName(p.category_id) || 'Uncategorised', p.client, p.gallery?.length > 1 ? `${p.gallery.length} images` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="project-card__foot">
                    <Button variant="ghost" size="sm" icon={Star} title={p.is_featured ? 'Unfeature' : 'Feature'} aria-label={p.is_featured ? 'Unfeature' : 'Feature'}
                      style={p.is_featured ? { color: 'var(--accent)' } : undefined}
                      onClick={() => patch(p, { is_featured: !p.is_featured }, p.is_featured ? 'Removed from featured' : 'Marked as featured')} />
                    <Button variant="ghost" size="sm" icon={p.status === 'published' ? Eye : EyeOff}
                      title={p.status === 'published' ? 'Unpublish' : 'Publish'} aria-label={p.status === 'published' ? 'Unpublish' : 'Publish'}
                      onClick={() => patch(p, { status: p.status === 'published' ? 'unpublished' : 'published' }, p.status === 'published' ? 'Project unpublished' : 'Project published')} />
                    <Button variant="ghost" size="sm" icon={Copy} title="Duplicate" aria-label="Duplicate" onClick={() => duplicate(p)} />
                    <span style={{ flex: 1 }} />
                    <Button variant="danger-ghost" size="sm" icon={Trash2} title="Delete" aria-label="Delete" onClick={() => remove(p)} />
                    <Link className="btn btn--secondary btn--sm" to={`/projects/${p.id}`}><Pencil size={14} /> Edit</Link>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination page={f.page} pageSize={PAGE_SIZE} total={data.total} onPage={page => setF({ page })} />
        </>
      )}

      {catsOpen && <CategoryManager onClose={() => { setCatsOpen(false); reloadCats(); refresh(); }} />}
    </>
  );
}
