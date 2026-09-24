import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Info, Loader2, Search, X } from 'lucide-react';

export function Button({ variant = 'secondary', size, icon: Icon, loading, children, className = '', block, ...rest }) {
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, !children && 'btn--icon', block && 'btn--block', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 size={15} className="spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="page-loader"><div className="row"><Loader2 size={18} className="spin" /> {label}</div></div>;
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="page-head">
      <div>
        {back && <Link className="breadcrumb" to={back.to}><ArrowLeft size={14} /> {back.label}</Link>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, error, required, children, className = '', count, max }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <span className="field__label">
          {label}{required && <span className="req">*</span>}
          {max ? <span className="field__count">{count ?? 0}/{max}</span> : null}
        </span>
      )}
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

/** Text input bound to form state. */
export function TextField({ form, name, label, hint, required, type = 'text', placeholder, max, className, ...rest }) {
  const id = useId();
  const value = form.values[name] ?? '';
  return (
    <Field label={label && <label htmlFor={id}>{label}</label>} hint={hint} error={form.errors[name]} required={required}
      className={className} max={max} count={String(value).length}>
      <input id={id} className="input" type={type} value={value} placeholder={placeholder} maxLength={max}
        onChange={e => form.set(name, e.target.value)} {...rest} />
    </Field>
  );
}

export function TextArea({ form, name, label, hint, required, rows = 4, placeholder, max, className }) {
  const id = useId();
  const value = form.values[name] ?? '';
  return (
    <Field label={label && <label htmlFor={id}>{label}</label>} hint={hint} error={form.errors[name]} required={required}
      className={className} max={max} count={String(value).length}>
      <textarea id={id} className="textarea" rows={rows} value={value} placeholder={placeholder} maxLength={max}
        onChange={e => form.set(name, e.target.value)} />
    </Field>
  );
}

export function SelectField({ form, name, label, hint, required, options, className, placeholder, parse = v => v }) {
  const id = useId();
  return (
    <Field label={label && <label htmlFor={id}>{label}</label>} hint={hint} error={form.errors[name]} required={required} className={className}>
      <select id={id} className="select" value={form.values[name] ?? ''} onChange={e => form.set(name, parse(e.target.value))}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className="toggle" style={disabled ? { opacity: .55, cursor: 'not-allowed' } : undefined}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="toggle__track" />
      {(label || description) && (
        <span className="toggle__text">{label}{description && <span className="toggle__desc">{description}</span>}</span>
      )}
    </label>
  );
}

export function ToggleField({ form, name, label, description, disabled }) {
  return <Toggle checked={!!form.values[name]} onChange={v => form.set(name, v)} label={label} description={description} disabled={disabled} />;
}

/** Enter/comma separated list input (tags, tools, features). */
export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', max = 30 }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const add = (raw) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some(v => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div className="tag-input" onClick={() => inputRef.current?.focus()}>
      {value.map((t, i) => (
        <span className="chip" key={`${t}-${i}`}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={12} /></button>
        </span>
      ))}
      <input ref={inputRef} value={draft} placeholder={value.length ? '' : placeholder}
        onChange={e => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)} />
    </div>
  );
}

export function TagField({ form, name, label, hint, placeholder, max }) {
  return (
    <Field label={label} hint={hint || 'Press Enter or comma to add'} error={form.errors[name]}>
      <TagInput value={form.values[name] || []} onChange={v => form.set(name, v)} placeholder={placeholder} max={max} />
    </Field>
  );
}

export function StatusBadge({ status }) {
  const label = { published: 'Published', draft: 'Draft', unpublished: 'Unpublished' }[status] || status;
  return <span className={`badge badge--${status}`}>{label}</span>;
}

export const STATUS_OPTIONS = [
  { value: 'published', label: 'Published — visible on the site' },
  { value: 'draft', label: 'Draft — only in preview' },
  { value: 'unpublished', label: 'Unpublished — hidden' },
];

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  useEffect(() => {
    const t = setTimeout(() => { if (v !== (value || '')) onChange(v); }, 300);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="input-group">
      <Search size={15} />
      <input className="input" type="search" value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} aria-label={placeholder} />
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span>Showing {from}–{to} of {total}</span>
      <div className="row">
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <span>Page {page} of {pages}</span>
        <Button size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty__icon"><Icon size={24} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state">
      <AlertTriangle size={18} />
      <div style={{ flex: 1 }}>
        <strong>Couldn't load this page.</strong>
        <div className="small">{error?.message || String(error)}</div>
      </div>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Notice({ children, warn }) {
  return <div className={`notice ${warn ? 'notice--warn' : ''}`}>{warn ? <AlertTriangle size={16} /> : <Info size={16} />}<div>{children}</div></div>;
}

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, size, drawer }) {
  useEscape(onClose);
  const body = (
    <div className={`overlay ${drawer ? 'overlay--drawer' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={drawer ? 'drawer' : `modal ${size ? `modal--${size}` : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal__head">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

export function SaveBar({ dirty, saving, onSave, onReset, saveLabel = 'Save changes', extra }) {
  return (
    <div className="savebar">
      <div className="savebar__status">
        {dirty ? <><span className="savebar__dot" /> Unsaved changes</> : 'All changes saved'}
      </div>
      {extra}
      {onReset && <Button variant="ghost" disabled={!dirty || saving} onClick={onReset}>Discard</Button>}
      <Button variant="primary" loading={saving} disabled={!dirty} onClick={onSave}>{saveLabel}</Button>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'on' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
