import { useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useForm } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { Button, ErrorState, Modal, Notice, PageHeader, Spinner, TextField, Toggle, ToggleField } from '../components/ui.jsx';

export default function Sections() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/sections');
  const [editing, setEditing] = useState(null);

  const toggle = async (s, visible) => {
    setData(d => d.map(x => (x.key === s.key ? { ...x, is_visible: visible ? 1 : 0 } : x)));
    try {
      await api.put(`/sections/${s.key}`, { is_visible: visible });
      toast.success(`${s.name} ${visible ? 'is now visible' : 'hidden from the site'}`);
    } catch (e) { toast.error(e); reload(true); }
  };

  let n = 0;
  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Section Settings" description="Show or hide whole sections and edit their headings. The page layout and order stay fixed — hidden sections simply disappear, and menu links to them are removed." />
      <div style={{ marginBottom: 16 }}>
        <Notice>Section numbers (01 — About Me, 02 — …) are assigned automatically to the visible sections, so hiding one never leaves a gap. A section with no published items is hidden automatically too.</Notice>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Spinner /> : (
        <div className="card list">
          {data.map(s => {
            const num = s.is_visible && s.eyebrow ? String(++n).padStart(2, '0') : null;
            return (
              <div className="list-row" key={s.key} style={s.is_visible ? undefined : { opacity: 0.7 }}>
                <span className="thumb" style={{ background: s.is_visible ? 'var(--success-soft)' : 'var(--surface-hover)', color: s.is_visible ? 'var(--success)' : 'var(--text-mute)' }}>
                  {s.is_visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </span>
                <div className="list-row__main">
                  <div className="list-row__title">{s.name}{s.nav_label ? <span className="badge badge--plain badge--info">Menu: {s.nav_label}</span> : null}</div>
                  <div className="list-row__sub">
                    {s.eyebrow ? <>{num ? `${num} — ` : ''}{s.eyebrow} · “{s.heading} <em>{s.heading_em}</em>”</> : 'Decorative strip (no heading)'}
                  </div>
                </div>
                <div className="list-row__actions">
                  {s.eyebrow && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(s)}>Edit</Button>}
                  <Toggle checked={!!s.is_visible} onChange={v => toggle(s, v)} label={<span className="sr-only">Visible</span>} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <SectionEditor section={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(true); }} />}
    </div>
  );
}

function SectionEditor({ section, onClose, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const form = useForm({ ...section });
  const [saving, setSaving] = useState(false);
  const close = async () => {
    if (form.dirty && !(await confirm({ title: 'Discard changes?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard' }))) return;
    onClose();
  };
  const save = async () => {
    setSaving(true);
    try { await api.put(`/sections/${section.key}`, form.values); toast.success('Section updated'); onSaved(); }
    catch (e) { form.setErrors(e.fields || {}); toast.error(e); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Edit “${section.name}” section`} onClose={close}
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
      <div className="form-grid">
        <TextField className="full" form={form} name="eyebrow" label="Small label" max={60} hint="Shown as “01 — Label”. The number is automatic." />
        <TextField className="full" form={form} name="heading" label="Heading — first line" required max={120} />
        <TextField className="full" form={form} name="heading_em" label="Heading — second line (italic)" max={120} />
        <TextField form={form} name="nav_label" label="Menu link text" max={30} hint="Leave empty to keep it out of the top menu." />
        <div style={{ alignSelf: 'end', paddingBottom: 8 }}><ToggleField form={form} name="in_footer" label="Show in footer links" /></div>
      </div>
      <div className="divider" />
      <div className="muted small">Preview</div>
      <div style={{ padding: '14px 16px', background: '#0B0B14', color: '#fff', borderRadius: 12, marginTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: '#FF5A36' }}>0X — {form.values.eyebrow}</div>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{form.values.heading}<br /><em style={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}>{form.values.heading_em}</em></div>
      </div>
    </Modal>
  );
}
