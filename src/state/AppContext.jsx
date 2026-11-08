import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onChange, getSettings } from '../supabase/queries.js';
import { startLive } from '../supabase/realtime.js';
import { useAuth } from './AuthContext.jsx';
import { can as roleCan, homeFor, pagesFor, roleLabel } from '../lib/roles.js';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const { status, role, user, venue, displayName } = useAuth();
  const userId = user?.id || null;
  const venueId = venue?.id || null;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [rawSettings, setRawSettings] = useState({});
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState('pos');
  const [pageParams, setPageParams] = useState({});
  const [toasts, setToasts] = useState([]);
  const [peers, setPeers] = useState([]);
  // Egasi boshqa rollar ekranini o'z qurilmabida ko'radi (ko'rinish uchun, ruxsat o'zgarmaydi).
  const [previewRole, setPreviewRole] = useState(null);

  const connected = status === 'ready';
  const viewRole = previewRole || role;
  const allowedPages = useMemo(() => pagesFor(viewRole), [viewRole]);

  // Realtime: do'kon ochilganda kanal yo'lga qo'yiladi, yopilmaganda tozalanadi.
  const toastRef = useRef(null);
  useEffect(() => {
    if (!connected || !venueId || !userId) return undefined;
    return startLive({
      venueId,
      self: { id: userId, name: displayName, role },
      onNewOrder: (o) => toastRef.current?.(`Yangi buyurtma №${o.number}`, 'info'),
      onPeers: (list) => setPeers(list.filter((p) => p.id !== userId)),
    });
  }, [connected, venueId, userId, role, displayName]);

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

  // Rol (yoki ko'rilayotgan rejim) o'zgarsa — ruxsat yo'q sahifadan chiqamiz.
  useEffect(() => {
    if (!role) {
      setPreviewRole(null);
      return;
    }
    if (role !== 'owner') setPreviewRole(null);
  }, [role]);

  useEffect(() => {
    if (!ready) return;
    setPage((p) => (allowedPages.includes(p) ? p : homeFor(viewRole)));
  }, [ready, viewRole, allowedPages]);

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

  useEffect(() => { toastRef.current = toast; }, [toast]);

  const onlineIds = useMemo(() => new Set(peers.map((p) => p.id)), [peers]);

  const value = {
    ready, error, retry, version, page, pageParams, navigate, toast, toasts,
    settings: rawSettings, refresh,
    peers, onlineIds,
    role, viewRole, isPreview: Boolean(previewRole), previewRole,
    setPreviewRole, viewRoleLabel: roleLabel(viewRole),
    allowedPages,
    can: (perm) => roleCan(viewRole, perm),
    realCan: (perm) => roleCan(role, perm),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  return useContext(AppCtx);
}
