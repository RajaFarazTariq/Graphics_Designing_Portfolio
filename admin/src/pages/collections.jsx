import { BarChart3, Briefcase, GraduationCap, Info, ListOrdered, MessageSquareQuote, Share2, Sparkles, Wrench } from 'lucide-react';
import { mediaSrc } from '../lib/api.js';
import { Field, TagField, TextArea, TextField, ToggleField, SelectField } from '../components/ui.jsx';
import { FormImageField } from '../components/MediaPicker.jsx';

// ---------- shared helpers ----------
const yearRange = (i) => {
  const y = (d) => (d ? String(d).slice(0, 4) : '');
  const end = i.is_current ? 'Present' : y(i.end_date);
  const start = y(i.start_date);
  return start && end && start !== end ? `${start} — ${end}` : start || end;
};
const lines = (arr) => (arr || []).join('\n');
const toLines = (s) => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const svgIcon = (body, size = 20) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: body }} />;
const Thumb = ({ src, bg, text }) => (
  <span className="thumb" style={bg ? { background: bg } : undefined}>
    {src ? <img src={mediaSrc(src)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : text}
  </span>
);

function DateRange({ form }) {
  return (
    <>
      <TextField form={form} name="start_date" label="Start date" type="month" />
      <TextField form={form} name="end_date" label="End date" type="month" disabled={!!form.values.is_current}
        hint={form.values.is_current ? 'Ongoing — shown as “Present”' : undefined} />
      <div className="full"><ToggleField form={form} name="is_current" label="Currently ongoing" description="Hides the end date and shows “Present”." /></div>
    </>
  );
}

function GradientField({ form, name, label, presets, hint }) {
  const value = form.values[name] || '';
  return (
    <Field label={label} hint={hint || 'Any CSS color or gradient, e.g. linear-gradient(135deg,#001E36,#31A8FF)'} error={form.errors[name]} className="full">
      <div className="row">
        <span className="swatch" style={{ background: value || 'var(--surface-hover)' }} />
        <input className="input" value={value} onChange={e => form.set(name, e.target.value)} placeholder="linear-gradient(135deg,#FF5A36,#FFB199)" />
      </div>
      {presets && (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {presets.map(p => <button key={p} type="button" className="swatch" style={{ background: p, width: 26, height: 26, cursor: 'pointer' }} title={p} onClick={() => form.set(name, p)} aria-label={`Use ${p}`} />)}
        </div>
      )}
    </Field>
  );
}

const AVATAR_PRESETS = [
  'linear-gradient(135deg,#FF5A36,#FFB199)', 'linear-gradient(135deg,#8E7BFF,#5BE0FF)', 'linear-gradient(135deg,#4ADE80,#0F2A2E)',
  'linear-gradient(135deg,#F59E0B,#EF4444)', 'linear-gradient(135deg,#0EA5E9,#6366F1)', 'linear-gradient(135deg,#EC4899,#8B5CF6)',
];

// Known design tools — picking one fills in the icon letters + brand gradient + glow, matching the existing cards.
const SKILL_PRESETS = [
  { name: 'Photoshop', icon_text: 'Ps', icon_bg: 'linear-gradient(135deg,#001E36,#31A8FF)', icon_shadow: 'rgba(0, 150, 255, 0.55)' },
  { name: 'Illustrator', icon_text: 'Ai', icon_bg: 'linear-gradient(135deg,#330000,#FF9A00)', icon_shadow: 'rgba(255, 154, 0, 0.55)' },
  { name: 'Figma', icon_text: 'Fg', icon_bg: 'linear-gradient(135deg,#1ABCFE,#0ACF83 40%,#F24E1E 70%,#A259FF)', icon_shadow: 'rgba(242, 78, 30, 0.55)' },
  { name: 'Canva', icon_text: 'Cv', icon_bg: 'linear-gradient(135deg,#00C4CC,#7D2AE8)', icon_shadow: 'rgba(0, 200, 187, 0.55)' },
  { name: 'After Effects', icon_text: 'Ae', icon_bg: 'linear-gradient(135deg,#1F0033,#D950BC)', icon_shadow: 'rgba(217, 80, 188, 0.55)' },
  { name: 'Premiere Pro', icon_text: 'Pr', icon_bg: 'linear-gradient(135deg,#00005B,#9999FF)', icon_shadow: 'rgba(153, 153, 255, 0.55)' },
  { name: 'InDesign', icon_text: 'Id', icon_bg: 'linear-gradient(135deg,#49021F,#FF3366)', icon_shadow: 'rgba(255, 51, 102, 0.55)' },
  { name: 'Lightroom', icon_text: 'Lr', icon_bg: 'linear-gradient(135deg,#001E36,#31A8FF)', icon_shadow: 'rgba(49, 168, 255, 0.55)' },
  { name: 'Blender', icon_text: 'Bl', icon_bg: 'linear-gradient(135deg,#FF8C3C,#FF3D00)', icon_shadow: 'rgba(255, 110, 40, 0.55)' },
  { name: 'Adobe XD', icon_text: 'Xd', icon_bg: 'linear-gradient(135deg,#470137,#FF61F6)', icon_shadow: 'rgba(255, 97, 246, 0.5)' },
  { name: 'CorelDRAW', icon_text: 'Cd', icon_bg: 'linear-gradient(135deg,#0B3D2E,#4CAF50)', icon_shadow: 'rgba(76, 175, 80, 0.5)' },
];

// ---------- configs (key = admin route path) ----------
export const COLLECTIONS = {
  skills: {
    title: 'Skills', singular: 'skill', endpoint: '/skills', icon: Sparkles, hasFeatured: true,
    description: 'The “Tools & Skills” cards. Order here is the order on the site.',
    emptyText: 'Add the tools and skills you want to showcase.',
    defaults: { name: '', category: '', description: '', proficiency: 80, icon_text: '', icon_bg: '', icon_shadow: '', icon_media_id: null, is_featured: 1, status: 'published' },
    toPayload: (v) => ({ ...v, proficiency: v.proficiency === '' || v.proficiency === null ? null : Number(v.proficiency) }),
    row: (i) => ({
      title: i.name,
      sub: [i.category, i.proficiency != null ? `${i.proficiency}%` : null, i.description].filter(Boolean).join(' · '),
      thumb: <Thumb src={i.icon_media?.url} bg={i.icon_bg} text={i.icon_text} />,
    }),
    form: ({ form }) => (
      <>
        <Field label="Quick start" hint="Pick a known tool to fill in its icon letters and brand colors." className="full">
          <select className="select" value="" onChange={e => {
            const p = SKILL_PRESETS.find(x => x.name === e.target.value);
            if (p) Object.entries(p).forEach(([k, v]) => { if (k !== 'name' || !form.values.name) form.set(k, v); });
          }}>
            <option value="">Choose a preset…</option>
            {SKILL_PRESETS.map(p => <option key={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <TextField form={form} name="name" label="Skill name" required max={60} placeholder="e.g. Photoshop" />
        <TextField form={form} name="category" label="Category" max={60} placeholder="e.g. Design Software" />
        <TextArea className="full" form={form} name="description" label="Short description" rows={2} max={300} />
        <Field label="Proficiency" hint="Shown as the animated progress bar. Leave empty to hide the bar." error={form.errors.proficiency} className="full">
          <div className="row">
            <input type="range" min="0" max="100" value={form.values.proficiency ?? 0} onChange={e => form.set('proficiency', Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} aria-label="Proficiency slider" />
            <input className="input" type="number" min="0" max="100" style={{ width: 80 }} value={form.values.proficiency ?? ''} onChange={e => form.set('proficiency', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Proficiency percent" />
            <span className="muted">%</span>
          </div>
        </Field>
        <div className="full form-section__title" style={{ marginTop: 8, marginBottom: 0 }}>Icon</div>
        <Field label="Preview" className="full">
          <div className="row" style={{ gap: 14 }}>
            <span className="thumb" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 22, background: form.values.icon_bg || '#333', boxShadow: `0 10px 30px -8px ${form.values.icon_shadow || 'rgba(255,90,54,.5)'}` }}>
              {form.values.icon_media ? <img src={mediaSrc(form.values.icon_media.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : form.values.icon_text}
            </span>
            <span className="muted small">This is how the icon tile looks on the site.</span>
          </div>
        </Field>
        <TextField form={form} name="icon_text" label="Icon letters" max={4} placeholder="Ps" />
        <TextField form={form} name="icon_shadow" label="Glow color" placeholder="rgba(0, 150, 255, 0.55)" />
        <GradientField form={form} name="icon_bg" label="Icon background" presets={SKILL_PRESETS.map(p => p.icon_bg).slice(0, 8)} />
        <div className="full"><FormImageField form={form} name="icon" label="Icon image (optional)" hint="Replaces the letters with an image inside the same tile." /></div>
        <div className="full"><ToggleField form={form} name="is_featured" label="Featured skill" /></div>
      </>
    ),
  },

  experience: {
    title: 'Experience', singular: 'experience', endpoint: '/experiences', icon: Briefcase,
    description: 'Entries in the “Experience” timeline.',
    notice: 'The timeline shows the position and description. If you add dates or a company, they appear above the title in the timeline’s existing year style. Other fields are saved for your records and the public API.',
    emptyText: 'Add your roles and milestones.',
    defaults: { position: '', company: '', company_url: '', location: '', start_date: '', end_date: '', is_current: 0, description: '', responsibilities: [], tools: [], logo_media_id: null, status: 'published' },
    toForm: (i) => ({ ...i, start_date: i.start_date || '', end_date: i.end_date || '', responsibilities_text: lines(i.responsibilities) }),
    toPayload: (v) => ({ ...v, responsibilities: toLines(v.responsibilities_text ?? lines(v.responsibilities)) }),
    row: (i) => ({
      title: i.position,
      sub: [i.company, yearRange(i), i.description].filter(Boolean).join(' · '),
      thumb: i.logo_media ? <Thumb src={i.logo_media.url} /> : null,
      badges: i.is_current ? <span className="badge badge--info">Current</span> : null,
    }),
    form: ({ form }) => (
      <>
        <TextField form={form} name="position" label="Position / title" required max={120} placeholder="e.g. Freelance Graphic Designer" />
        <TextField form={form} name="company" label="Company" max={120} />
        <TextField form={form} name="company_url" label="Company website" placeholder="https://" />
        <TextField form={form} name="location" label="Location" max={120} placeholder="e.g. Remote" />
        <DateRange form={form} />
        <TextArea className="full" form={form} name="description" label="Description" required rows={3} max={800} />
        <TextArea className="full" form={form} name="responsibilities_text" label="Responsibilities" rows={4} hint="One per line." />
        <div className="full"><TagField form={form} name="tools" label="Technologies / tools" placeholder="Photoshop, Illustrator…" /></div>
        <div className="full"><FormImageField form={form} name="logo" label="Company logo" /></div>
      </>
    ),
  },

  education: {
    title: 'Education', singular: 'education entry', endpoint: '/education', icon: GraduationCap,
    description: 'Your degrees, courses and certifications.',
    notice: 'The current portfolio design has no Education section, so these entries are not shown on the page (to keep the design unchanged). They are stored safely and available from the public content API for when a section is added.',
    emptyText: 'Add your degrees, courses or certifications.',
    defaults: { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', is_current: 0, description: '', location: '', website: '', logo_media_id: null, status: 'published' },
    toForm: (i) => ({ ...i, start_date: i.start_date || '', end_date: i.end_date || '' }),
    row: (i) => ({
      title: i.institution,
      sub: [[i.degree, i.field_of_study].filter(Boolean).join(', '), yearRange(i), i.location].filter(Boolean).join(' · '),
      thumb: i.logo_media ? <Thumb src={i.logo_media.url} /> : null,
      badges: i.is_current ? <span className="badge badge--info">Ongoing</span> : null,
    }),
    form: ({ form }) => (
      <>
        <TextField className="full" form={form} name="institution" label="Institution" required max={160} />
        <TextField form={form} name="degree" label="Degree" max={160} placeholder="e.g. BS" />
        <TextField form={form} name="field_of_study" label="Field of study" max={160} placeholder="e.g. Graphic Design" />
        <DateRange form={form} />
        <TextField form={form} name="location" label="Location" max={120} />
        <TextField form={form} name="website" label="Website" placeholder="https://" />
        <TextArea className="full" form={form} name="description" label="Description" rows={3} max={1500} />
        <div className="full"><FormImageField form={form} name="logo" label="Institution logo" /></div>
      </>
    ),
  },

  services: {
    title: 'Services', singular: 'service', endpoint: '/services', icon: Wrench, hasFeatured: true, needsMeta: true,
    description: 'Cards in the “Services” section. Numbers (01, 02…) follow this order automatically.',
    emptyText: 'Add the services you offer.',
    defaults: { title: '', description: '', features: [], tools: [], icon: 'globe', icon_media_id: null, cta_label: 'Get a quote', cta_url: '#contact', is_featured: 1, status: 'published' },
    row: (i, meta) => {
      const icon = meta?.serviceIcons?.find(x => x.key === i.icon);
      return {
        title: i.title,
        sub: [i.features?.join(', '), i.description].filter(Boolean).join(' · '),
        thumb: <span className="thumb" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>{i.icon_media ? <img src={mediaSrc(i.icon_media.url)} alt="" /> : icon ? svgIcon(icon.body) : null}</span>,
      };
    },
    form: ({ form, meta }) => (
      <>
        <TextField className="full" form={form} name="title" label="Title" required max={80} />
        <TextArea className="full" form={form} name="description" label="Description" required rows={3} max={500} />
        <div className="full"><TagField form={form} name="features" label="Feature bullets" hint="Short items shown as a list on the card (Enter to add)." max={8} /></div>
        <div className="full"><TagField form={form} name="tools" label="Technologies / tools" hint="Stored for your records and the public API." /></div>
        <Field label="Icon" className="full" hint="Uses the site’s existing line-icon style.">
          <div className="icon-picker">
            {(meta?.serviceIcons || []).map(ic => (
              <button type="button" key={ic.key} title={ic.label} aria-label={ic.label} className={form.values.icon === ic.key ? 'on' : ''} onClick={() => form.set('icon', ic.key)}>{svgIcon(ic.body)}</button>
            ))}
          </div>
        </Field>
        <div className="full"><FormImageField form={form} name="icon" label="Custom icon image (optional)" hint="Overrides the line icon above." /></div>
        <TextField form={form} name="cta_label" label="Button text" max={40} />
        <TextField form={form} name="cta_url" label="Button link" hint="#contact, a full URL, or mailto:" />
        <div className="full"><ToggleField form={form} name="is_featured" label="Featured service" /></div>
      </>
    ),
  },

  process: {
    title: 'Process', singular: 'step', endpoint: '/process-steps', icon: ListOrdered,
    description: 'The “How I Work” steps.',
    emptyText: 'Describe the steps of your design process.',
    defaults: { title: '', description: '', status: 'published' },
    row: (i) => ({ title: i.title, sub: i.description }),
    form: ({ form }) => (
      <>
        <TextField className="full" form={form} name="title" label="Step title" required max={60} />
        <TextArea className="full" form={form} name="description" label="Description" required rows={3} max={400} />
      </>
    ),
  },

  testimonials: {
    title: 'Testimonials', singular: 'testimonial', endpoint: '/testimonials', icon: MessageSquareQuote, hasFeatured: true,
    description: 'Client reviews in the “Testimonials” section.',
    emptyText: 'Add kind words from your clients.',
    defaults: { client_name: '', client_position: '', company: '', quote: '', rating: 5, avatar_initials: '', avatar_bg: AVATAR_PRESETS[0], avatar_media_id: null, company_logo_media_id: null, testimonial_date: '', is_featured: 1, status: 'published' },
    toForm: (i) => ({ ...i, testimonial_date: i.testimonial_date || '' }),
    toPayload: (v) => ({ ...v, rating: Number(v.rating) }),
    row: (i) => ({
      title: i.client_name,
      sub: [[i.client_position, i.company].filter(Boolean).join(' · '), `${'★'.repeat(i.rating)}`, i.quote].filter(Boolean).join(' — '),
      thumb: <span className="thumb" style={{ borderRadius: '50%', background: i.avatar_bg }}>{i.avatar_media ? <img src={mediaSrc(i.avatar_media.url)} alt="" /> : i.avatar_initials}</span>,
    }),
    form: ({ form }) => (
      <>
        <TextField form={form} name="client_name" label="Client name" required max={80} />
        <SelectField form={form} name="rating" label="Rating" parse={Number} options={[5, 4, 3, 2, 1].map(n => ({ value: n, label: `${'★'.repeat(n)} (${n})` }))} />
        <TextField form={form} name="client_position" label="Position" max={80} placeholder="e.g. Founder" />
        <TextField form={form} name="company" label="Company" max={80} />
        <TextArea className="full" form={form} name="quote" label="Testimonial" required rows={4} max={1000} />
        <TextField form={form} name="testimonial_date" label="Date" type="month" />
        <TextField form={form} name="avatar_initials" label="Avatar initials" max={3} hint="Left empty → taken from the name." />
        <GradientField form={form} name="avatar_bg" label="Avatar color" presets={AVATAR_PRESETS} hint="Background of the round avatar when no photo is set." />
        <div className="full"><FormImageField form={form} name="avatar" label="Profile photo (optional)" hint="Replaces the initials inside the same round avatar." /></div>
        <div className="full"><FormImageField form={form} name="company_logo" label="Company logo (optional)" hint="Stored for your records and the public API." /></div>
        <div className="full"><ToggleField form={form} name="is_featured" label="Featured testimonial" /></div>
      </>
    ),
  },

  'social-links': {
    title: 'Social Links', singular: 'social link', endpoint: '/social-links', icon: Share2, needsMeta: true,
    description: 'Your profiles on other platforms.',
    notice: 'Links with “Show on site” appear as round icon buttons in the Contact section, using the site’s built-in social-link style. All published links are also added to the page’s SEO data.',
    emptyText: 'Add LinkedIn, Behance, Instagram and other profiles.',
    defaults: { platform: 'linkedin', label: '', url: '', show_on_site: 1, status: 'published' },
    row: (i, meta) => {
      const p = meta?.socialPlatforms?.find(x => x.key === i.platform);
      return {
        title: i.label || p?.label || i.platform, sub: i.url,
        thumb: <span className="thumb" style={{ color: 'var(--text)', background: 'var(--surface-hover)', borderRadius: '50%' }}>{p ? svgIcon(p.body, 18) : null}</span>,
        badges: i.show_on_site ? null : <span className="badge badge--plain badge--unpublished">SEO only</span>,
      };
    },
    form: ({ form, meta }) => (
      <>
        <SelectField form={form} name="platform" label="Platform" required options={(meta?.socialPlatforms || []).map(p => ({ value: p.key, label: p.label }))} />
        <TextField form={form} name="label" label="Label (optional)" max={60} hint="Used as the accessible name of the icon." />
        <TextField className="full" form={form} name="url" label="URL" required placeholder="https://www.behance.net/yourname" />
        <div className="full"><ToggleField form={form} name="show_on_site" label="Show on site" description="Display as an icon in the Contact section." /></div>
      </>
    ),
  },
};

// Embedded on the Profile page.
export const STATS_CONFIG = (placement) => ({
  title: placement === 'hero' ? 'Hero highlights' : 'Stats strip',
  description: placement === 'hero' ? 'The three numbers under the hero buttons (e.g. 20+ Projects Shipped).' : 'The animated counters below the Skills section.',
  singular: 'stat', endpoint: '/stats', icon: BarChart3, duplicable: false,
  emptyText: 'No stats yet.',
  defaults: { placement, value: '', suffix: '+', label: '', status: 'published' },
  row: (i) => ({ title: `${i.value}${i.suffix}`, sub: i.label }),
  form: ({ form }) => (
    <>
      <TextField form={form} name="value" label="Value" required max={10} placeholder="20" hint={placement === 'strip' ? 'A number — it animates as a counter.' : undefined} />
      <TextField form={form} name="suffix" label="Suffix" max={6} placeholder="+ or ★ or ' hr'" />
      <TextField className="full" form={form} name="label" label="Label" required max={60} />
    </>
  ),
});

export const FACTS_CONFIG = {
  title: 'Quick facts', description: 'The facts card in the About section.', singular: 'fact', endpoint: '/facts', icon: Info, duplicable: false,
  emptyText: 'No facts yet.',
  defaults: { label: '', value: '', status: 'published' },
  row: (i) => ({ title: i.label, sub: i.value }),
  form: ({ form }) => (
    <>
      <TextField form={form} name="label" label="Label" required max={40} placeholder="Based in" />
      <TextField form={form} name="value" label="Value" required max={80} placeholder="Islamabad, PK" />
    </>
  ),
};
