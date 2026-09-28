import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Package, CheckCircle, CreditCard, XCircle, Truck, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { buildWebSocketUrl } from '../lib/websocket';
import { timeAgo } from '../lib/dateTime';
import { isMessageSoundEnabled, playIncomingMessageSound, primeMessageSound, setMessageSoundEnabled } from '../lib/messageSound';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isMessageSoundEnabled());
  const dropdownRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const stoppedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axios.get('/notifications', { params: { limit: 50, offset: 0 } });
      setNotifications(response.data || []);
      setUnreadCount((response.data || []).filter((n) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // Browsers only allow audio after a user gesture. Prime once, then future
  // incoming-message sounds can play even when the user is on another page.
  useEffect(() => {
    const prime = () => primeMessageSound();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!user || stoppedRef.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = new WebSocket(buildWebSocketUrl(`/api/ws/notifications/${user.id}`, { token }));
    wsRef.current = socket;
    let pingInterval;

    socket.onopen = () => {
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        const newNotif = {
          id: data.id || `notif-${Date.now()}`,
          user_id: user.id,
          type: data.type,
          title: data.title,
          message: data.message,
          created_at: data.timestamp || new Date().toISOString(),
          read: false,
          link: data.link,
          match_id: data.match_id,
        };
        setNotifications((prev) => prev.some((n) => n.id === newNotif.id) ? prev : [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
        window.dispatchEvent(new CustomEvent('sendjet:notification', { detail: newNotif }));

        if (['message', 'direct_message', 'new_message'].includes(data.type)) {
          playIncomingMessageSound();
        }

        const nav = navigateRef.current;
        const action = data.link ? { label: 'View', onClick: () => nav(data.link) } : undefined;
        toast.success(data.title || 'New notification', { description: data.message, action });
      } catch (error) {
        console.warn('Invalid notification WebSocket payload', error);
      }
    };

    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearInterval(pingInterval);
      if (!stoppedRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connectWebSocket, 4000);
      }
    };
  }, [user]);

  useEffect(() => {
    stoppedRef.current = false;
    if (user) {
      fetchNotifications();
      connectWebSocket();
    }
    return () => {
      stoppedRef.current = true;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [user, fetchNotifications, connectWebSocket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notifId) => {
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    axios.put(`/notifications/${notifId}/read`).catch(() => {});
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) markAsRead(notif.id);
    setIsOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const markAllRead = async () => {
    // Marking read does NOT delete notifications. Full history stays on /notifications.
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    axios.put('/notifications/read-all').catch(() => {});
  };

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setMessageSoundEnabled(next);
    if (next) {
      await primeMessageSound();
      playIncomingMessageSound();
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'match_request': return <Package className="h-5 w-5 text-orange-500" />;
      case 'match_accepted': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'match_rejected': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'payment_required':
      case 'payment_received': return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'message':
      case 'direct_message': return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'shipment_update': return <Truck className="h-5 w-5 text-purple-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen((v) => !v)} className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" data-testid="notification-bell" aria-label="Notifications">
        <Bell className="h-6 w-6 text-gray-700" />
        {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-[25rem] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-[calc(100dvh-5rem)] overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-3.5 sm:p-4 border-b border-gray-200">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={toggleSound} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label={soundEnabled ? 'Mute message sound' : 'Enable message sound'} title={soundEnabled ? 'Message sound on' : 'Message sound off'}>
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              {unreadCount > 0 && <button onClick={markAllRead} className="text-xs sm:text-sm font-medium text-orange-600 hover:text-orange-700 px-1">Mark all read</button>}
            </div>
          </div>

          <div className="max-h-[calc(100dvh-12rem)] sm:max-h-[25rem] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center"><Bell className="h-11 w-11 mx-auto mb-3 text-gray-300" /><p className="text-sm text-gray-500">No notifications yet</p></div>
            ) : notifications.slice(0, 8).map((notif) => (
              <button key={notif.id} type="button" onClick={() => handleNotificationClick(notif)} className={`w-full text-left p-3.5 sm:p-4 border-b border-gray-100 hover:bg-gray-50 transition flex items-start gap-3 ${!notif.read ? 'bg-orange-50/50' : ''}`} data-testid={`notification-${notif.type}`}>
                <div className="mt-0.5 h-9 w-9 rounded-full bg-white border flex items-center justify-center flex-shrink-0">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-gray-900 break-words">{notif.title}</p><span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(notif.created_at)}</span></div>
                  <p className="text-sm text-gray-600 mt-0.5 break-words line-clamp-2">{notif.message}</p>
                </div>
                {!notif.read && <span className="h-2 w-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => { setIsOpen(false); navigate('/notifications'); }} className="w-full p-3 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition flex items-center justify-center gap-1.5">
            View notification history <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
