import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../supabase/client.js';
import {
  fetchIsPlatformAdmin, fetchMembership, onAuthChange, registerVenue, redeemInvite, signIn, signOut, signUp,
} from '../supabase/auth.js';
import { roleLabel } from '../lib/roles.js';
import { purgeAccount, setIdentity } from '../lib/offline.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: isSupabaseConfigured ? 'booting' : 'unconfigured',
    user: null,
    membership: null,
    isPlatformAdmin: false,
    error: null,
  });
  // Akkaunt bosqichida yozilgan ism — do'kon ochilganda yoki kod ishlatilganda saqlanadi.
  const [profileName, setProfileName] = useState('');
  const requestRef = useRef(0);

  const loadMembership = useCallback(async (user) => {
    const requestId = ++requestRef.current;
    // Kesh va navbat yozuvlari shu id bilan belgilanadi — shuning uchun
    // akkaunt ma'lumoti o'qilishdan oldin ham kimligi ma'lum bo'lishi kerak.
    setIdentity(user ? { id: user.id, name: '' } : null);
    if (!user) {
      setState({ status: 'unauthenticated', user: null, membership: null, isPlatformAdmin: false, error: null });
      return;
    }
    try {
      const [membership, isPlatformAdmin] = await Promise.all([
        fetchMembership(user.id),
        fetchIsPlatformAdmin().catch(() => false),
      ]);
      if (requestId !== requestRef.current) return;
      setState({ status: membership ? 'ready' : 'needs-venue', user, membership, isPlatformAdmin, error: null });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setState({ status: 'error', user, membership: null, isPlatformAdmin: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const unsubscribe = onAuthChange((user) => {
      loadMembership(user);
    });
    return () => {
      ++requestRef.current;
      unsubscribe();
    };
  }, [loadMembership]);

  const run = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
      return null;
    }
  }, []);

  const api = {
    ...state,
    role: state.membership?.role || null,
    roleLabel: state.membership ? roleLabel(state.membership.role) : '',
    displayName: state.membership?.displayName || '',
    venue: state.membership?.venue || null,
    profileName,
    retry: () => loadMembership(state.user),

    handleSignIn: (email, password) => run(async () => {
      await signIn(email, password);
    }),

    // 1-bosqich: faqat akkaunt (email + parol). Do'kon hali ochilmaydi.
    handleSignUp: ({ name, email, password }) => run(async () => {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) return { needsConfirmation: true };
      setProfileName(name || '');
      return { ok: true };
    }),

    // 2-bosqich: egasi o'z do'konini ochadi.
    handleCreateVenue: ({ name, kind, phone, address }) => run(async () => {
      await registerVenue({ name, kind, phone, address, ownerName: profileName });
      await loadMembership(state.user);
      return { ok: true };
    }),

    // 2-bosqich (xodim uchun): egasi bergan taklif kodini ishlatish.
    handleJoin: ({ code, name }) => run(async () => {
      const role = await redeemInvite(code, name || profileName);
      await loadMembership(state.user);
      return { ok: true, role };
    }),

    handleSignOut: async () => {
      ++requestRef.current;
      const leaving = state.user?.id || null;
      setProfileName('');
      await signOut().catch(() => {});
      setState({ status: 'unauthenticated', user: null, membership: null, error: null });
      // Bu hisobning oflayn keshi qurilmada qolmasin (keyingi akkaunt ko'rmasin).
      await purgeAccount(leaving);
    },
  };

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
