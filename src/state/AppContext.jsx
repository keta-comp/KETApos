import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { initDb, onChange } from '../db/index.js';
import { getSettings } from '../db/store.js';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState('pos');
  const [pageParams, setPageParams] = useState({});
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let alive = true;
    let unsub = null;
    initDb()
      .then(() => {
        if (!alive) return;
        unsub = onChange(() => setVersion((v) => v + 1));
        setReady(true);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const navigate = useCallback((p, params = {}) => {
    setPage(p);
    setPageParams(params);
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const settings = useMemo(() => (ready ? getSettings() : {}), [ready, version]);

  const value = { ready, error, version, page, pageParams, navigate, toast, toasts, settings, refresh };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  return useContext(AppCtx);
}