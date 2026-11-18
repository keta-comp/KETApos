import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellOff, CircleCheck, CircleX, Copy, ExternalLink, Inbox, Info, MapPin, Phone, RefreshCw,
  ShoppingBag, Store, Timer, Truck, User,
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import {
  acceptOnlineOrder, getOnlineOrders, getOnlineShop, rejectOnlineOrder, saveOnlineShop,
} from '../supabase/queries.js';
import DataState from '../components/DataState.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import { fmtQty, fmtSum, fmtTime, minutesSince } from '../lib/format.js';
import { t } from '../lib/i18n.js';

// Onlayn zakazlar jouyari: mijoz /o/<slug> sahifasidan yuborgan zakaz shu yerda
// ko'rinadi. "Qabul qilish" uni kassada oddiy buyurtmaga aylantiradi
// (bazada online_accept -> create_order), "Rad etish" sababi bilan saqlanadi.

const TABS = [
  { key: 'new', label: 'Yangi' },
  { key: 'accepted', label: 'Qabul qilingan' },
  { key: 'rejected', label: 'Rad etilgan' },
  { key: 'all', label: 'Barchasi' },
];

const TYPE_LABELS = { pickup: 'Olib ketish', delivery: 'Yetkazib berish' };

const STATUS_LABELS = { new: 'Yangi', accepted: 'Qabul qilingan', rejected: 'Rad etilgan' };

function badgeFor(status) {
  if (status === 'accepted') return 'badge-green';
  if (status === 'rejected') return 'badge-red';
  return 'badge-yellow';
}

// Desktop ilovada (file://) manzil mahalliy bo'ladi — mijoz linki saytdan beriladi.
function shopUrl(url) {
  if (!url) return null;
  const local = /^https?:$/.test(window.location.protocol);
  return `${local ? window.location.origin : 'https://ketapos.nursultansayyora.workers.dev'}${url}`;
}

export default function OnlinePage() {
  const { toast, refresh, realCan } = useApp();
  const isOwner = realCan('onlineShop');
  const [tab, setTab] = useState('new');
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [shop, setShop] = useState(null);

  const { data: orders, loading, error, reload } = useData(getOnlineOrders);
  const { data: shopData } = useData(isOwner ? getOnlineShop : async () => null, [isOwner]);

  useEffect(() => {
    if (shopData) setShop(shopData);
  }, [shopData]);

  // Bazadan kelgan zakazlarni realtime kuzatib bo'lmaydi (mijoz jadvaliga
  // xodim ham to'g'ridan-to'g'ri qaramaydi) — 20 soniyada bir so'raladi.
  useEffect(() => {
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  const seen = useRef(null);
  useEffect(() => {
    if (!orders) return;
    const fresh = orders.filter((o) => o.status === 'new');
    if (!seen.current) {
      seen.current = new Set(fresh.map((o) => o.id));
      return;
    }
    for (const o of fresh) {
      if (seen.current.has(o.id)) continue;
      seen.current.add(o.id);
      toast(t('Yangi onlayn zakaz · {sum}', { sum: fmtSum(o.total) }), 'info');
    }
  }, [orders, toast]);

  const list = orders || [];
  const newCount = list.filter((o) => o.status === 'new').length;
  const shown = useMemo(() => (tab === 'all' ? list : list.filter((o) => o.status === tab)), [list, tab]);

  async function accept(order) {
    setBusy(order.id);
    try {
      const res = await acceptOnlineOrder(order.id);
      toast(t('Zakaz qabul qilindi — kassada №{number} ochildi', { number: res?.number }), 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function reject(reason) {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try {
      await rejectOnlineOrder(rejecting.id, reason);
      toast(t('Zakaz rad etildi'));
      setRejecting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function patchShop(fields) {
    try {
      setShop(await saveOnlineShop(fields));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><Inbox size={22} /> {t('Onlayn zakazlar')}</h1>
          <div className="page-sub">
            {newCount
              ? t('{n} ta zakaz javob kutmoqda · har 20 soniyada yangilanadi', { n: newCount })
              : t('Javob kutayotgan zakaz yo‘q · har 20 soniyada yangilanadi')}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={reload}>
          <RefreshCw size={15} /> {t('Yangilash')}
        </button>
      </div>

      <div className="page-body">
        {isOwner && <ShopCard shop={shop} onPatch={patchShop} />}

        <div className="seg online-tabs">
          {TABS.map((x) => (
            <button key={x.key} type="button" className={`seg-item ${tab === x.key ? 'active' : ''}`} onClick={() => setTab(x.key)}>
              {t(x.label)}
              {x.key === 'new' && newCount > 0 ? ` (${newCount})` : ''}
            </button>
          ))}
        </div>

        {error
          ? <DataState error={error} onRetry={reload} />
          : loading && !orders
            ? <div className="empty-state"><Spinner size={18} /> {t('Zakazlar yuklanmoqda...')}</div>
            : shown.length === 0
              ? (
                <div className="empty-state">
                  <span className="empty-icon"><BellOff size={22} /></span>
                  {t('Bu holatda zakaz yo‘q. Mijozlar/link orqali zakaz yuborganda shu yerda ko‘rinadi.')}
                </div>
              )
              : (
                <div className="online-grid">
                  {shown.map((o) => (
                    <OnlineCard
                      key={o.id}
                      order={o}
                      busy={busy === o.id}
                      onAccept={() => accept(o)}
                      onReject={() => setRejecting(o)}
                    />
                  ))}
                </div>
              )}
      </div>

      {rejecting && (
        <RejectModal order={rejecting} busy={busy === rejecting.id} onClose={() => setRejecting(null)} onOk={reject} />
      )}
    </div>
  );
}

function ShopCard({ shop, onPatch }) {
  const [copied, setCopied] = useState(false);
  const [minText, setMinText] = useState('0');

  useEffect(() => {
    if (shop) setMinText(String(Number(shop.min_total) || 0));
  }, [shop]);

  if (!shop) {
    return <div className="empty-state"><Spinner size={18} /> {t('Sozlamalar yuklanmoqda...')}</div>;
  }

  const link = shopUrl(shop.url);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard ruxsat bermasa link maydonda ko'rinib turadi — qo'l bilan nusxalanadi
    }
  }

  return (
    <section className="card online-shop">
      <div className="online-shop-head">
        <span className="online-shop-mark"><Store size={17} /></span>
        <div>
          <div className="online-shop-title">{t('Onlayn do‘kon')}</div>
          <div className="online-shop-sub">{t('Bio’ga qo’yiladigan bitta link — mijoz kirib kirmasdan zakaz yuboradi.')}</div>
        </div>
        <label className="check-row online-shop-main">
          <input type="checkbox" checked={Boolean(shop.enabled)} onChange={(e) => onPatch({ enabled: e.target.checked })} />
          {t('Yoqilgan')}
        </label>
      </div>

      {link ? (
        <div className="link-box">
          <div className="link-text">{link}</div>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              {copied ? <CircleCheck size={15} /> : <Copy size={15} />} {copied ? t('Nusxalandi') : t('Nusxalash')}
            </button>
            <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> {t('Ochish')}
            </a>
          </div>
        </div>
      ) : (
        <div className="online-shop-note">
          <Info size={14} /> {t('Link do‘konni yoqqaningizdan keyin paydo bo‘ladi.')}
        </div>
      )}

      <div className="online-shop-grid">
        <label className="check-row">
          <input type="checkbox" checked={Boolean(shop.accepting)} onChange={(e) => onPatch({ accepting: e.target.checked })} />
          {t('Zakaz qabul qilinadi')}
        </label>
        <label className="check-row">
          <input type="checkbox" checked={Boolean(shop.delivery)} onChange={(e) => onPatch({ delivery: e.target.checked })} />
          {t('Yetkazib berish bor')}
        </label>
        <div className="row">
          <span className="label">{t('Minimal zakaz')}</span>
          <input
            className="input online-min"
            inputMode="numeric"
            value={minText}
            onChange={(e) => setMinText(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => onPatch({ min_total: Number(minText) || 0 })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span className="muted">so‘m</span>
        </div>
      </div>

      <div className="online-shop-note">
        <Info size={14} />
        {t('To‘lov onlayn olinmaydi. Menyuda faqat faol mahsulotlar ko‘rinadi; qabul qilingan zakaz kassada ochiq buyurtmaga aylanadi.')}
      </div>
    </section>
  );
}

function OnlineCard({ order, busy, onAccept, onReject }) {
  const mins = minutesSince(order.created_at);
  const items = order.items || [];
  const TypeIcon = order.type === 'delivery' ? Truck : ShoppingBag;

  return (
    <article className={`card online-card st-${order.status}`}>
      <div className="online-card-head">
        <div>
          <div className="online-who"><User size={14} /> {order.name}</div>
          <a className="online-phone" href={`tel:${String(order.phone).replace(/[^+0-9]/g, '')}`}>
            <Phone size={14} /> {order.phone}
          </a>
        </div>
        <div className="online-when">
          <span className={`badge ${badgeFor(order.status)}`}>{t(STATUS_LABELS[order.status])}</span>
          <span className={`elapsed ${mins >= 15 ? 'late' : mins >= 5 ? 'warn' : ''}`}>
            <Timer size={13} /> {fmtTime(order.created_at)}
          </span>
        </div>
      </div>

      <div className="online-tags">
        <span className="online-chip"><TypeIcon size={14} /> {t(TYPE_LABELS[order.type])}</span>
        <span className="online-chip mono">{t('Kuzatish kodi')} {order.token}</span>
      </div>

      {order.address && <div className="online-addr"><MapPin size={14} /> {order.address}</div>}

      <div className="online-items">
        {items.map((it, i) => (
          <div key={`${it.product_id}-${i}`} className="online-line">
            <span className="ol-qty">{fmtQty(it.qty)}×</span>
            <span className="ol-name">{it.name}</span>
            <span className="ol-sum">{fmtSum(it.total)}</span>
          </div>
        ))}
      </div>

      {order.note && <div className="online-note"><Info size={13} /> {order.note}</div>}

      <div className="online-card-foot">
        <b className="online-total">{fmtSum(order.total)}</b>
        {order.status === 'new' ? (
          <div className="row">
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onReject}>
              <CircleX size={15} /> {t('Rad etish')}
            </button>
            <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={onAccept}>
              {busy ? <Spinner size={15} /> : <CircleCheck size={15} />} {t('Qabul qilish')}
            </button>
          </div>
        ) : (
          <span className="muted online-handled">
            {order.status === 'accepted'
              ? t('Kassada №{number} · {at}', { number: order.order_number, at: fmtTime(order.handled_at) })
              : t('Rad etilgan: {reason}', { reason: order.reason || '—' })}
          </span>
        )}
      </div>
    </article>
  );
}

function RejectModal({ order, busy, onClose, onOk }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={t('Zakazni rad etish')} onClose={onClose} width={420}>
      <div className="online-reject-who">
        {order.name} · {fmtSum(order.total)}
      </div>
      <div className="field mt-2">
        <label className="label">{t('Sabab (mijoz sahifasida ko‘rinadi)')}</label>
        <input
          className="input"
          value={reason}
          maxLength={120}
          placeholder={t('Masalan: mahsulot tugadi')}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="row mt-1">
        <button className="btn btn-danger" disabled={busy} onClick={() => onOk(reason.trim())}>
          {busy ? <Spinner size={16} /> : <CircleX size={16} />} {t('Rad etish')}
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={onClose}>{t('Bekor qilish')}</button>
      </div>
    </Modal>
  );
}
