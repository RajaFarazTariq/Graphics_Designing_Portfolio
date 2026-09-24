import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, setUnauthorizedHandler, setDeployment } from './api.js';
import { Spinner } from '../components/ui.jsx';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [config, setConfig] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/auth/config')
      .then(cfg => { setDeployment(cfg); setConfig(cfg); })
      .catch(() => setConfig({ storage: 'local' }))
      .finally(() => api.get('/auth/me').then(r => setUser(r.user)).catch(() => setUser(null)));
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setUser(r.user);
    return r.user;
  }, []);

  const loginWithToken = useCallback(async (token) => {
    const r = await api.post('/auth/token', { token });
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);

  const isGithub = config?.storage === 'github';
  return <AuthCtx.Provider value={{ user, setUser, login, loginWithToken, logout, config, isGithub }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/** Route guard: unauthenticated visitors are sent to the login page. */
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
