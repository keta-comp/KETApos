import { supabase } from './client.js';
import { bumpExternal } from './queries.js';

// Realtime: bir do'konda ishlayotgan qurilmalar bir-birining yozuvlarini jonli ko'radi.
// RLS "select" policyasi qaysi qatorni ko'rish mumkinligini hal qiladi — shuning uchun
// filter faqat venue_id bo'yicha qo'yiladi, xavfsizlik bazada qoladi.

const TABLES = ['orders', 'order_items', 'dining_tables', 'products', 'categories', 'stock_movements', 'expenses', 'staff'];

function peerList(state) {
  const out = [];
  for (const entries of Object.values(state || {})) {
    for (const entry of entries) {
      const meta = entry.metas || entry;
      if (meta && meta.id) out.push({ id: String(meta.id), name: meta.name || '', role: meta.role || '' });
    }
  }
  return out;
}

export function startLive({ venueId, self, onNewOrder, onPeers }) {
  if (!supabase || !venueId) return () => {};

  // Barcha qurilmalar bitta nomdagi kanalda bo'ladi — presence shu topic bo'yicha ishlaydi.
  const topic = `pos-live:${venueId}`;
  for (const old of supabase.getChannels().filter((c) => c.topic === topic)) {
    supabase.removeChannel(old);
  }

  const channel = supabase.channel(topic, {
    config: { presence: { key: String(self?.id || 'me') } },
  });

  for (const table of TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `venue_id=eq.${venueId}` },
      (payload) => {
        if (table === 'orders' && payload.eventType === 'INSERT' && payload.new?.id !== undefined) {
          const mine = Boolean(self) && String(payload.new.created_by) === String(self.id);
          if (!mine && onNewOrder) onNewOrder(payload.new);
        }
        // Sahifalarni har bir eventda emas, to'lqin tugaganda qayta yuklaymiz.
        bumpExternal();
      }
    );
  }

  const readPeers = () => {
    if (onPeers) onPeers(peerList(channel.presenceState()));
  };
  channel.on('presence', { event: 'sync' }, readPeers);
  channel.on('presence', { event: 'join' }, readPeers);
  channel.on('presence', { event: 'leave' }, readPeers);

  let tracked = false;
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && !tracked) {
      tracked = true;
      if (self) {
        channel
          .track({ id: String(self.id), name: self.name || '', role: self.role || '', venue: String(venueId) })
          .then(readPeers)
          .catch(() => {});
      }
    }
  });

  return () => {
    tracked = false;
    try { supabase.removeChannel(channel); } catch { /* kanal allaqachon yopilgan */ }
  };
}
