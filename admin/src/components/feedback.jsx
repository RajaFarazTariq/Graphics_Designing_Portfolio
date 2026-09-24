import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from 'lucide-react';
import { Button, Modal } from './ui.jsx';

// ---------------- Toasts ----------------
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts(t => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6500 : 3500);
  }, [dismiss]);
  const api = useRef({
    success: (m) => push('success', m),
    error: (m) => push('error', m?.message || m),
    info: (m) => push('info', m),
  }).current;
  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <Icon size={18} className="toast__icon" />
              <div className="toast__msg">{t.message}</div>
              <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- Confirm dialogs ----------------
const ConfirmCtx = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, message, confirmLabel, danger: true })) …
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise(resolve => setState({ ...opts, resolve })), []);
  const close = (result) => { state?.resolve(result); setState(null); };
  const danger = state?.danger !== false;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title || 'Are you sure?'} onClose={() => close(false)}
          footer={<>
            <Button variant="ghost" onClick={() => close(false)}>{state.cancelLabel || 'Cancel'}</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{state.confirmLabel || 'Delete'}</Button>
          </>}>
          <div className={`confirm__icon ${danger ? '' : 'confirm__icon--neutral'}`}>
            {danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
          </div>
          <div style={{ color: 'var(--text-soft)' }}>{state.message}</div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);
