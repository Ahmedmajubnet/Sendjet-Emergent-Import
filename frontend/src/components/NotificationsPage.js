import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, CheckCheck, CreditCard, MessageCircle, Package, Truck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { BackButton } from './BackButton';
import { parseServerDate, timeAgo } from '../lib/dateTime';

const PAGE_SIZE = 40;

const iconFor = (type) => {
  if (['message', 'direct_message'].includes(type)) return <MessageCircle className="h-5 w-5 text-blue-500" />;
  if (type === 'match_request') return <Package className="h-5 w-5 text-orange-500" />;
  if (type === 'match_accepted') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (type === 'match_rejected') return <XCircle className="h-5 w-5 text-red-500" />;
  if (type?.includes('payment')) return <CreditCard className="h-5 w-5 text-indigo-500" />;
  if (type === 'shipment_update') return <Truck className="h-5 w-5 text-purple-500" />;
  return <Bell className="h-5 w-5 text-gray-500" />;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all');

  const mergeUnique = (newItems, existing) => {
    const map = new Map();
    [...newItems, ...existing].forEach((n) => n?.id && map.set(n.id, n));
    return Array.from(map.values()).sort((a, b) => {
      const ta = parseServerDate(a.created_at)?.getTime() || 0;
      const tb = parseServerDate(b.created_at)?.getTime() || 0;
      return tb - ta;
    });
  };

  const loadInitial = async () => {
    try {
      const res = await axios.get('/notifications', { params: { limit: PAGE_SIZE, offset: 0 } });
      const items = res.data || [];
      setNotifications(items);
      setHasMore(items.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  };

  const refreshLatest = async () => {
    try {
      const res = await axios.get('/notifications', { params: { limit: PAGE_SIZE, offset: 0 } });
      setNotifications((prev) => mergeUnique(res.data || [], prev));
    } catch (_) {
      // Keep already loaded history visible if a refresh fails.
    }
  };

  const loadOlder = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = notifications.length;
      const res = await axios.get('/notifications', { params: { limit: PAGE_SIZE, offset } });
      const items = res.data || [];
      setNotifications((prev) => mergeUnique(prev, items));
      setHasMore(items.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitial();
    const timer = setInterval(refreshLatest, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onRealtime = (event) => {
      const notif = event.detail;
      if (!notif?.id) return;
      setNotifications((prev) => mergeUnique([notif], prev));
    };
    window.addEventListener('sendjet:notification', onRealtime);
    return () => window.removeEventListener('sendjet:notification', onRealtime);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const shown = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    if (filter === 'messages') return notifications.filter((n) => ['message', 'direct_message'].includes(n.type));
    if (filter === 'matches') return notifications.filter((n) => n.type?.startsWith('match') || n.type === 'booking_request');
    return notifications;
  }, [notifications, filter]);

  const openNotification = async (notif) => {
    if (!notif.read) {
      // Read status changes only the visual state; the notification stays in history.
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
      axios.put(`/notifications/${notif.id}/read`).catch(() => {});
    }
    if (notif.link) navigate(notif.link);
  };

  const markAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await axios.put('/notifications/read-all').catch(() => {});
  };

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <BackButton fallback="/dashboard" className="mb-4" />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Your notification history stays here after you open or read an item.</p>
        </div>
        {unread > 0 && <Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4 mr-2" />Mark all read</Button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {[
          ['all', `All (${notifications.length}${hasMore ? '+' : ''})`],
          ['unread', `Unread (${unread})`],
          ['messages', 'Messages'],
          ['matches', 'Matches'],
        ].map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium border transition ${filter === value ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-orange-200'}`}>{label}</button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading notifications…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 sm:p-14 text-center">
            <Bell className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">Nothing here yet</p>
            <p className="text-sm text-gray-500 mt-1">New activity will appear here automatically.</p>
          </div>
        ) : shown.map((notif) => (
          <button key={notif.id} type="button" onClick={() => openNotification(notif)} className={`w-full text-left p-4 sm:p-5 border-b last:border-b-0 hover:bg-gray-50 transition flex items-start gap-3 ${!notif.read ? 'bg-orange-50/45' : 'bg-white'}`}>
            <div className="h-10 w-10 rounded-full bg-gray-50 border flex items-center justify-center flex-shrink-0">{iconFor(notif.type)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-gray-900 break-words">{notif.title}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(notif.created_at)}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1 break-words">{notif.message}</p>
              {notif.link && <span className="inline-block text-xs font-semibold text-orange-600 mt-2">Open →</span>}
            </div>
            {!notif.read && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />}
          </button>
        ))}
      </div>

      {filter === 'all' && hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load older notifications
          </Button>
        </div>
      )}
    </main>
  );
};

export default NotificationsPage;
