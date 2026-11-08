import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../supabase/client.js';
import {
  fetchMembership, getSessionUser, onAuthChange, registerVenue, redeemInvite, signIn, signOut, signUp,
} from '../supabase/auth.js';

const AuthCtx = createContext(null);

export const ROLE_LABELS = {
  owner: 'Egasi',
  waiter: 'Ofitsant',
  cashier: 'Kassir',
  kitchen: 'Oshxona',
};

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: isSupabaseConfigured ? 'booting' : 'unconfigured',
    user: null,
    membership: null,
    error: null,
  });
  const requestRef = useRef(0);

  const loadMembership = useCallback(async (user) => {
    const requestId = ++requestRef.current;
    if (!user) {
      setState({ status: 'unauthenticated', user: null, membership: null, error: null });
      return;
    }
    try {
      const membership = await fetchMembership(user.id);
      if (requestId !== requestRef.current) return;
      setState({ status: membership ? 'ready' : 'needs-venue', user, membership, error: null });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setState({ status: 'error', user, membership: null, error: e.message });
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
    roleLabel: state.membership ? ROLE_LABELS[state.membership.role] : '',
    venue: state.membership?.venue || null,
    retry: () => loadMembership(state.user),

    handleSignIn: (email, password) => run(async () => {
      await signIn(email, password);
    }),

    handleCreateVenue: ({ email, password, name, kind, phone, address }) => run(async () => {
      let user = state.user;
      if (!user) {
        await signUp(email, password);
        user = await getSessionUser();
        if (!user) return { needsConfirmation: true };
      }
      await registerVenue({ name, kind, phone, address });
      await loadMembership(user);
      return { ok: true };
    }),

    handleJoin: ({ email, password, code }) => run(async () => {
      let user = state.user;
      if (!user) {
        await signUp(email, password);
        user = await getSessionUser();
        if (!user) return { needsConfirmation: true };
      }
      await redeemInvite(code);
      await loadMembership(user);
      return { ok: true };
    }),

    handleSignOut: async () => {
      ++requestRef.current;
      await signOut().catch(() => {});
      setState({ status: 'unauthenticated', user: null, membership: null, error: null });
    },
  };

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
