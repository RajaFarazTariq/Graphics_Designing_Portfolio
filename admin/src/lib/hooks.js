import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { api } from './api.js';

/** Loads data from the API with loading / error / reload. */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const load = useCallback(async (silent = false) => {
    if (!path) return;
    const n = ++seq.current;
    if (!silent) setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path);
      if (n === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (n === seq.current) setState(s => ({ ...s, loading: false, error }));
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (fn) => setState(s => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

/** Form state with dirty tracking and server-side field errors. */
export function useForm(initial) {
  const [values, setValues] = useState(initial || {});
  const [baseline, setBaseline] = useState(initial || {});
  const [errors, setErrors] = useState({});
  const set = useCallback((name, value) => {
    setValues(v => ({ ...v, [name]: value }));
    setErrors(e => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  const reset = useCallback((next) => {
    const v = next ?? baseline;
    setValues(v); setBaseline(v); setErrors({});
  }, [baseline]);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);
  return { values, set, setValues, errors, setErrors, dirty, reset, baseline };
}

/** Blocks in-app navigation and tab close while there are unsaved changes. */
export function useUnsavedGuard(dirty, confirm) {
  const bypassRef = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypassRef.current) { bypassRef.current = false; return false; }
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Discard unsaved changes?',
      message: 'You have changes that have not been saved. If you leave this page they will be lost.',
      confirmLabel: 'Leave without saving',
      cancelLabel: 'Stay on page',
    }).then(ok => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  /** Call right before an intentional navigation (after save/delete) to skip the prompt once. */
  return () => { bypassRef.current = true; };
}
