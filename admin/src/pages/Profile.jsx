import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useForm, useUnsavedGuard } from '../lib/hooks.js';
import { useConfirm, useToast } from '../components/feedback.jsx';
import { PageHeader, Spinner, ErrorState, TextField, TextArea, SaveBar, Tabs } from '../components/ui.jsx';
import { FormImageField } from '../components/MediaPicker.jsx';
import CollectionPage from './CollectionPage.jsx';
import { STATS_CONFIG, FACTS_CONFIG } from './collections.jsx';

const TABS = [
  { value: 'personal', label: 'Personal info' },
  { value: 'about', label: 'About & bio' },
  { value: 'contact', label: 'Contact details' },
  { value: 'highlights', label: 'Highlights & facts' },
];

export default function Profile() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'personal';
  const { data, loading, error, reload } = useApi('/profile');
  const form = useForm(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) form.reset(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useUnsavedGuard(form.dirty, confirm);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put('/profile', form.values);
      form.reset(saved);
      toast.success('Profile saved — the site is updated');
    } catch (e) {
      form.setErrors(e.fields || {});
      toast.error(e);
      // jump to the tab that has the first error
      const first = Object.keys(e.fields || {})[0];
      const where = { full_name: 'personal', job_title: 'personal', short_intro: 'personal', bio_lead: 'about', bio: 'about', philosophy_title: 'about', philosophy_quote: 'about', email: 'contact', phone_display: 'contact', phone_intl: 'contact', website: 'contact', working_mode: 'contact' }[first];
      if (where) setParams({ tab: where });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content--narrow" style={{ margin: '0 auto' }}>
      <PageHeader title="Profile" description="Your personal information as it appears across the portfolio." />
      <Tabs tabs={TABS} value={tab} onChange={v => setParams({ tab: v })} />

      {tab === 'personal' && (
        <div className="card"><div className="card__body">
          <div className="form-grid">
            <TextField form={form} name="full_name" label="Full name" required max={80} hint="Hero, signature card, footer and page metadata." />
            <TextField form={form} name="job_title" label="Professional title" required max={80} hint="Used in search/SEO data." />
            <TextField form={form} name="signature_role" label="Signature role" max={80} hint="Shown above your name in the About card." />
            <TextField form={form} name="availability_status" label="Availability / status" max={80} hint="The pill at the top of the hero, e.g. “Available for freelance · 2026”." />
            <TextArea className="full" form={form} name="short_intro" label="Short introduction" required rows={3} max={400}
              hint={<>Hero text after “I'm <strong>{form.values.full_name || 'Your Name'}</strong> —”</>} />
            <TextField form={form} name="city" label="City" max={80} />
            <TextField form={form} name="country_code" label="Country code" max={3} placeholder="PK" />
            <div className="full"><FormImageField form={form} name="profile" label="Profile image" hint="Stored for your records and the public API (the current design has no photo slot)." /></div>
          </div>
        </div></div>
      )}

      {tab === 'about' && (
        <div className="card"><div className="card__body">
          <div className="form-grid">
            <TextArea className="full" form={form} name="bio_lead" label="Intro paragraph" required rows={4} max={800} hint="The large first paragraph of the About section." />
            <TextArea className="full" form={form} name="bio" label="Full bio" rows={7} max={5000} hint="Leave an empty line between paragraphs." />
            <TextField form={form} name="philosophy_title" label="Philosophy heading" max={80} />
            <div />
            <TextArea className="full" form={form} name="philosophy_quote" label="Philosophy quote" rows={3} max={400} hint="Leave empty to hide the philosophy block." />
          </div>
        </div></div>
      )}

      {tab === 'contact' && (
        <div className="card"><div className="card__body">
          <div className="form-grid">
            <TextField form={form} name="email" label="Email" type="email" required hint="Contact section and footer." />
            <TextField form={form} name="website" label="Website" placeholder="https://" />
            <TextField form={form} name="phone_display" label="Phone (as displayed)" max={40} placeholder="0315-5299918" hint="Leave empty to hide the phone." />
            <TextField form={form} name="phone_intl" label="Phone (international)" max={40} placeholder="+92-315-5299918" hint="Used for the tap-to-call link." />
            <TextField className="full" form={form} name="working_mode" label="Working mode" max={80} placeholder="Remote · Worldwide" hint="The “Working” line in the Contact section." />
          </div>
        </div></div>
      )}

      {tab === 'highlights' && (
        <div className="stack">
          <CollectionPage embedded config={STATS_CONFIG('hero')} fixed={{ placement: 'hero' }} />
          <CollectionPage embedded config={STATS_CONFIG('strip')} fixed={{ placement: 'strip' }} />
          <CollectionPage embedded config={FACTS_CONFIG} />
        </div>
      )}

      {tab !== 'highlights' && <SaveBar dirty={form.dirty} saving={saving} onSave={save} onReset={() => form.reset()} />}
    </div>
  );
}
