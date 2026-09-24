import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useForm, useUnsavedGuard } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { ImageField } from '../components/MediaPicker.jsx';
import { ErrorState, Field, Notice, PageHeader, SaveBar, Spinner, TagField, Tabs, TextArea, TextField, Toggle } from '../components/ui.jsx';

const GROUPS = [
  { value: 'hero', label: 'Hero' },
  { value: 'branding', label: 'Logo & loader' },
  { value: 'marquee', label: 'Marquee' },
  { value: 'about', label: 'About & Work labels' },
  { value: 'contact', label: 'Contact form' },
  { value: 'footer', label: 'Footer' },
  { value: 'seo', label: 'SEO & sharing' },
];

export default function SiteSettings() {
  const [params, setParams] = useSearchParams();
  const group = params.get('tab') || 'hero';
  const { data, error, reload } = useApi('/settings');
  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Site Settings" description="Text and settings that appear around the site. Only the words change — never the design." />
      <Tabs tabs={GROUPS} value={group} onChange={v => setParams({ tab: v })} />
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Spinner /> : (
        <SettingsGroup key={group} group={group} initial={data[group]} onSaved={() => reload(true)} />
      )}
    </div>
  );
}

function SettingsGroup({ group, initial, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const form = useForm(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { form.reset(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useUnsavedGuard(form.dirty, confirm);
  const v = form.values;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/settings/${group}`, v);
      form.reset(saved);
      toast.success('Saved — the site is updated');
      onSaved(saved);
    } catch (e) { form.setErrors(e.fields || {}); toast.error(e); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="card"><div className="card__body">
        {group === 'hero' && (
          <div className="form-grid">
            <TextArea className="full" form={form} name="headline" label="Animated headline" required rows={3}
              hint={<>One line per row. Wrap a word in *asterisks* to make it <em>italic</em>. Up to 5 words — each animates in, one after another.</>} />
            <Field label="Preview" className="full">
              <div style={{ padding: '18px 20px', background: '#0B0B14', color: '#fff', borderRadius: 12, fontSize: 30, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {String(v.headline || '').split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i}>{line.trim().split(/\s+/).map((w, j) => {
                    const m = /^\*(.+)\*$/.exec(w);
                    return <span key={j}>{m ? <em style={{ fontFamily: 'Georgia, serif', fontWeight: 400, color: '#FF8A65' }}>{m[1]}</em> : w} </span>;
                  })}</div>
                ))}
              </div>
            </Field>
            <TextField form={form} name="primary_cta" label="Primary button" required max={30} />
            <TextField form={form} name="secondary_cta" label="Secondary button" required max={30} />
            <TextField form={form} name="cv_cta" label="CV button" required max={30} hint="Hidden automatically when no resume is active." />
            <div className="full"><Notice>The availability pill, your name and the short intro under the headline are edited in <Link to="/profile">Profile</Link>. The three numbers below the buttons are in Profile → Highlights & facts.</Notice></div>
          </div>
        )}

        {group === 'branding' && (
          <div className="form-grid">
            <TextField form={form} name="logo_mark" label="Logo letter" required max={2} hint="The square mark (also used for the browser tab icon)." />
            <TextField form={form} name="logo_text" label="Logo text" required max={30} hint="Shown after the mark, followed by the accent dot." />
            <TextField className="full" form={form} name="loader_tagline" label="Loading screen tagline" max={60} />
            <Field label="Preview" className="full">
              <div className="row" style={{ padding: '16px 18px', background: '#0B0B14', borderRadius: 12, color: '#fff', fontSize: 20, fontWeight: 600, gap: 4 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#FF5A36,#FF8A65)', display: 'grid', placeItems: 'center' }}>{v.logo_mark}</span>
                <span>{v.logo_text}<span style={{ color: '#FF5A36' }}>.</span></span>
              </div>
            </Field>
          </div>
        )}

        {group === 'marquee' && (
          <div className="form-grid">
            <div className="full"><TagField form={form} name="items" label="Scrolling words" hint="The words in the moving strip under the hero (separated by ✦). Leave empty to hide the strip." max={12} /></div>
          </div>
        )}

        {group === 'about' && (
          <div className="form-grid">
            <TextField form={form} name="resume_cta" label="About section resume button" required max={40} />
            <TextField form={form} name="facts_title" label="Quick facts card title" required max={40} />
            <FieldProxy group="work" />
          </div>
        )}

        {group === 'contact' && (
          <div className="form-grid">
            <TextField className="full" form={form} name="lead_before" label="Intro text" max={300} />
            <TextField form={form} name="lead_highlight" label="Highlighted part" max={40} hint="Shown in bold, e.g. “24 hours”." />
            <TextField form={form} name="lead_after" label="Text after highlight" max={200} />
            <div className="full divider" style={{ margin: '6px 0' }} />
            <TextField className="full" form={form} name="form_access_key" label="Web3Forms access key" max={80} hint="Delivers form submissions to your email. Leave empty to fall back to opening the visitor's mail app." />
            <TextField form={form} name="form_from_name" label="Email sender name" max={80} />
            <TextField form={form} name="form_subject" label="Email subject" max={160} />
            <div className="full"><Toggle checked={!!v.store_messages} onChange={x => form.set('store_messages', x)} label="Keep a copy in the admin inbox" description="Every submission is also saved under Messages." /></div>
          </div>
        )}

        {group === 'footer' && (
          <div className="form-grid">
            <TextArea className="full" form={form} name="blurb" label="Footer description" rows={3} max={300} />
            <TextField form={form} name="availability" label="Availability line" max={120} />
            <TextField form={form} name="credit" label="Credit line" max={120} />
          </div>
        )}

        {group === 'seo' && (
          <div className="form-grid">
            <TextField className="full" form={form} name="title" label="Page title" required max={160} hint="Shown in the browser tab and Google results." />
            <TextArea className="full" form={form} name="description" label="Meta description" required rows={3} max={320} />
            <TextField className="full" form={form} name="keywords" label="Keywords" max={400} hint="Comma separated." />
            <TextField form={form} name="canonical_url" label="Site URL" required placeholder="https://aatiqaaslam.com/" />
            <TextField form={form} name="theme_color" label="Browser theme color" required placeholder="#0B0B14" />
            <div className="full form-section__title" style={{ marginTop: 10, marginBottom: 0 }}>Social sharing (Open Graph / Twitter)</div>
            <TextField form={form} name="og_site_name" label="Site name" max={120} />
            <TextField form={form} name="og_title" label="Share title" max={160} />
            <TextArea className="full" form={form} name="og_description" label="Share description" rows={2} max={320} />
            <TextField form={form} name="twitter_title" label="Twitter/X title" max={160} />
            <TextField form={form} name="twitter_description" label="Twitter/X description" max={320} />
            <div className="full">
              <ImageField label="Share image" hint="Recommended 1200×630. Pick from the Media Library." wide
                value={v.og_image ? { url: v.og_image, original_name: v.og_image } : null}
                onChange={m => form.set('og_image', m ? m.url : '')} />
            </div>
            <TextField className="full" form={form} name="og_image_alt" label="Share image description" max={200} />
            <div className="full form-section__title" style={{ marginTop: 10, marginBottom: 0 }}>Structured data</div>
            <TextArea className="full" form={form} name="person_description" label="About you (for search engines)" rows={2} max={400} />
            <div className="full"><TagField form={form} name="knows_about" label="Areas of expertise" max={20} /></div>
          </div>
        )}
      </div></div>
      <SaveBar dirty={form.dirty} saving={saving} onSave={save} onReset={() => form.reset()} />
    </>
  );
}

/** The "All Work" filter label lives in its own settings group; edited inline on the About tab. */
function FieldProxy({ group }) {
  const toast = useToast();
  const { data, reload } = useApi('/settings');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setValue(data[group].all_label); }, [data, group]);
  if (!data) return null;
  const dirty = value !== data[group].all_label;
  return (
    <Field label="“All Work” filter label" className="full" hint="The first filter button above the projects.">
      <div className="row">
        <input className="input" value={value} onChange={e => setValue(e.target.value)} maxLength={30} />
        <button type="button" className="btn btn--secondary" disabled={!dirty || saving} onClick={async () => {
          setSaving(true);
          try { await api.put(`/settings/${group}`, { all_label: value }); toast.success('Saved'); reload(true); }
          catch (e) { toast.error(e); } finally { setSaving(false); }
        }}>Save</button>
      </div>
    </Field>
  );
}
