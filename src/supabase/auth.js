import { supabase } from './client.js';

const MESSAGES = {
  AVVAL_KIRING: 'Avval akkauntga kiring.',
  ALLAQACHON_ULANGAN: 'Bu akkaunt allaqachon bir do‘konga ulangan.',
  DOKON_TURI_NOTOGRI: 'Do‘kon turi fastfood yoki cafe bo‘lishi kerak.',
  NOM_KERTILMADI: 'Do‘kon nomini kiriting.',
  KOD_NOTOGRI: 'Taklif kodi noto‘g‘ri yoki allaqachon ishlatilgan.',
  ROL_NOTOGRI: 'Rol tanlang: ofitsant, kassir yoki oshxona.',
  FAQAT_EGA: 'Buni faqat do‘kon egasi qilishi mumkin.',
  'Invalid login credentials': 'Email yoki parol xato.',
  'User already registered': 'Bu email bilan akkaunt mavjud — „Kirish“ bo‘limidan kiring.',
  'Password should be at least 6 characters': 'Parol kamida 6 belgi bo‘lishi kerak.',
  'Unable to validate email address': 'Email manzili noto‘g‘ri.',
};

function fail(error) {
  const raw = error?.message || 'Noma’lum xatolik';
  throw new Error(MESSAGES[raw] || raw);
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) fail(error);
}

// Akkaunt yaratish. Email tasdiqlash yoqilgan bo'lsa sessiya qaytmaydi —
// chaqiruvchi tomon "pochta tekshiring" degan xabarni ko'rsatadi.
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) fail(error);
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) fail(error);
}

export async function registerVenue({ name, kind, phone, address, ownerName }) {
  const { error } = await supabase.rpc('register_venue', {
    p_name: name,
    p_kind: kind,
    p_phone: phone || null,
    p_address: address || null,
    p_owner_name: ownerName || null,
  });
  if (error) fail(error);
}

export async function redeemInvite(code, name) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_name: name || null });
  if (error) fail(error);
  return data;
}

export async function fetchMembership(userId) {
  const { data, error } = await supabase
    .from('staff')
    .select('role, display_name, venue_id, venues(id, name, kind, phone, address)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(error);
  return data
    ? {
      role: data.role,
      venueId: data.venue_id,
      displayName: data.display_name || '',
      venue: data.venues,
    }
    : null;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
