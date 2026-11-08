import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../supabase/client.js';
import {
  fetchMembership, onAuthChange, registerVenue, redeemInvite, signIn, signOut, signUp,
} from '../supabase/auth.js';
import { roleLabel } from '../lib/roles.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: isSupabaseConfigured ? 'booting' : 'unconfigured',
    user: null,
    membership: null,
    error: null,
  });
  // Akkaunt bosqichida yozilgan ism — do'kon ochilganda yoki kod ishlatilganda saqlanadi.
  const [profileName, setProfileName] = useState('');
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
      setProfileName('');
      await signOut().catch(() => {});
      setState({ status: 'unauthenticated', user: null, membership: null, error: null });
    },
  };

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
