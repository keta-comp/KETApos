import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onChange, getSettings } from '../supabase/queries.js';
import { useAuth } from './AuthContext.jsx';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const { status } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [rawSettings, setRawSettings] = useState({});
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState('pos');
  const [pageParams, setPageParams] = useState({});
  const [toasts, setToasts] = useState([]);

  const connected = status === 'ready';

  useEffect(() => {
    if (!connected) {
      setReady(false);
      setError(null);
      return undefined;
    }
    let alive = true;
    const unsub = onChange(() => setVersion((v) => v + 1));
    getSettings()
      .then((s) => {
        if (!alive) return;
        setRawSettings(s || {});
        setReady(true);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || String(e));
        setReady(true);
      });
    return () => {
      alive = false;
      unsub();
    };
  }, [connected, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const retry = useCallback(() => {
    setError(null);
    setVersion((v) => v + 1);
  }, []);

  const navigate = useCallback((p, params = {}) => {
    setPage(p);
    setPageParams(params);
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const value = { ready, error, retry, version, page, pageParams, navigate, toast, toasts, settings: rawSettings, refresh };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  return useContext(AppCtx);
}
