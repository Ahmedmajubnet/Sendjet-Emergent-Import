import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Banknote,
  Bus,
  Car,
  CheckCircle,
  Clock,
  CreditCard,
  Eye,
  FileCheck,
  Handshake,
  IdCard,
  MapPin,
  MessageSquare,
  Package,
  Plane,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Train,
  Trash2,
  TrendingUp,
  User,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { parseServerDate, timeAgo } from '../lib/dateTime';

const money = (value, currency = 'USD') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency || 'USD').toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

const initials = (name) => (name || 'SJ').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const PersonAvatar = ({ user, className = 'h-10 w-10' }) => (
  <div className={`${className} rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center flex-shrink-0 font-semibold`}>
    {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : initials(user?.full_name)}
  </div>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [shipmentChats, setShipmentChats] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [listingFilter, setListingFilter] = useState('all');
  const [matchFilter, setMatchFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [idViewUser, setIdViewUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [requestIdNote, setRequestIdNote] = useState("Please upload a valid government-issued ID to verify your identity.");
  const [actionDialogUser, setActionDialogUser] = useState(null);
  const [actionType, setActionType] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchAdminData = async ({ quiet = false } = {}) => {
    if (!quiet) setRefreshing(true);
    try {
      const [usersRes, tripsRes, shipmentsRes, matchesRes, paymentsRes, convsRes, shipChatsRes] = await Promise.all([
        axios.get('/admin/users'),
        axios.get('/admin/trips'),
        axios.get('/admin/shipments'),
        axios.get('/admin/matches'),
        axios.get('/admin/payments').catch(() => ({ data: [] })),
        axios.get('/admin/conversations').catch(() => ({ data: [] })),
        axios.get('/admin/shipment-chats').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data || []);
      setTrips(tripsRes.data || []);
      setShipments(shipmentsRes.data || []);
      setMatches(matchesRes.data || []);
      setPayments(paymentsRes.data || []);
      setConversations(convsRes.data || []);
      setShipmentChats(shipChatsRes.data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Admin data load failed', error);
      toast.error(error.response?.data?.detail || 'Failed to load admin operations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (value, withTime = true) => {
    const date = parseServerDate(value);
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString([], withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statusTone = (status) => {
    const value = String(status || '').toLowerCase();
    if (['verified', 'paid', 'completed', 'delivered', 'active', 'released'].includes(value)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (['pending', 'payment_pending', 'initiated', 'id_submitted'].includes(value)) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (['in_progress', 'in_transit', 'picked_up', 'matched', 'escrowed'].includes(value)) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (['rejected', 'cancelled', 'failed', 'refunded'].includes(value)) return 'bg-red-50 text-red-700 border-red-200';
    if (['id_requested'].includes(value)) return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getVerificationBadge = (status) => {
    const map = {
      verified: { label: 'Verified', icon: ShieldCheck },
      pending: { label: 'Registered', icon: Clock },
      id_requested: { label: 'ID requested', icon: IdCard },
      id_submitted: { label: 'ID submitted', icon: FileCheck },
      rejected: { label: 'Rejected', icon: ShieldX }
    };
    return map[status] || map.pending;
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const paidPayments = payments.filter((p) => ['paid', 'succeeded', 'complete', 'completed'].includes(String(p.payment_status || p.status || '').toLowerCase()));
    const paymentVolume = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const platformFees = matches
      .filter((m) => ['paid', 'in_progress', 'completed'].includes(m.status))
      .reduce((sum, m) => sum + Number(m.platform_commission_amount || 0), 0);
    const totalMessages = conversations.reduce((sum, c) => sum + Number(c.message_count || 0), 0)
      + shipmentChats.reduce((sum, c) => sum + Number(c.message_count || 0), 0);
    return {
      totalUsers: users.length,
      newUsers7d: users.filter((u) => (parseServerDate(u.created_at)?.getTime() || 0) >= weekAgo).length,
      verifiedUsers: users.filter((u) => u.verification_status === 'verified').length,
      idReviews: users.filter((u) => u.verification_status === 'id_submitted').length,
      activeTrips: trips.filter((t) => t.status === 'active').length,
      openShipments: shipments.filter((s) => ['pending', 'matched'].includes(s.status)).length,
      pendingMatches: matches.filter((m) => m.status === 'pending').length,
      awaitingPayment: matches.filter((m) => ['accepted', 'payment_pending'].includes(m.status)).length,
      liveDeliveries: matches.filter((m) => ['paid', 'in_progress'].includes(m.status)).length,
      completedMatches: matches.filter((m) => m.status === 'completed').length,
      paymentVolume,
      platformFees,
      totalMessages,
      totalConversations: conversations.length + shipmentChats.length
    };
  }, [users, trips, shipments, matches, payments, conversations, shipmentChats]);

  const recentActivity = useMemo(() => {
    const rows = [
      ...users.map((u) => ({ id: `u-${u.id}`, at: u.created_at, icon: User, title: 'New account', detail: u.full_name, tone: 'bg-blue-50 text-blue-600' })),
      ...trips.map((t) => ({ id: `t-${t.id}`, at: t.created_at, icon: t.transport_mode === 'car' ? Car : t.transport_mode === 'train' ? Train : t.transport_mode === 'bus' ? Bus : Plane, title: 'Journey posted', detail: `${t.origin?.address || 'Origin'} → ${t.destination?.address || 'Destination'}`, tone: 'bg-violet-50 text-violet-600' })),
      ...shipments.map((s) => ({ id: `s-${s.id}`, at: s.created_at, icon: Package, title: 'Shipment posted', detail: `${s.origin?.address || 'Origin'} → ${s.destination?.address || 'Destination'}`, tone: 'bg-orange-50 text-orange-600' })),
      ...matches.map((m) => ({ id: `m-${m.id}`, at: m.created_at, icon: Handshake, title: `Match ${m.status || 'created'}`, detail: `${m.sender?.full_name || 'Sender'} ↔ ${m.traveler?.full_name || 'Traveler'}`, tone: 'bg-emerald-50 text-emerald-600' })),
      ...payments.map((p) => ({ id: `p-${p.id}`, at: p.created_at, icon: CreditCard, title: `Payment ${p.payment_status || p.status || 'created'}`, detail: money(p.amount, p.currency), tone: 'bg-sky-50 text-sky-600' }))
    ];
    return rows
      .filter((row) => row.at)
      .sort((a, b) => (parseServerDate(b.at)?.getTime() || 0) - (parseServerDate(a.at)?.getTime() || 0))
      .slice(0, 10);
  }, [users, trips, shipments, matches, payments]);

  const handleVerifyUser = async (userId) => {
    try {
      await axios.put(`/admin/users/${userId}/verify`);
      toast.success('User verified');
      await fetchAdminData({ quiet: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to verify user');
    }
  };

  const handleRejectUser = async (userId) => {
    try {
      await axios.put(`/admin/users/${userId}/reject`, { reason: rejectReason || 'Verification rejected by admin.' });
      toast.success('Verification rejected');
      setActionDialogUser(null);
      setRejectReason('');
      await fetchAdminData({ quiet: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject user');
    }
  };

  const handleRequestId = async (userId) => {
    try {
      await axios.put(`/admin/users/${userId}/request-id`, { note: requestIdNote });
      toast.success('ID request sent');
      setActionDialogUser(null);
      setRequestIdNote('Please upload a valid government-issued ID to verify your identity.');
      await fetchAdminData({ quiet: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request ID');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/admin/users/${userId}`);
      toast.success('User and associated data deleted');
      await fetchAdminData({ quiet: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const openConversation = async (convId, type) => {
    setLoadingMessages(true);
    setSelectedConversation({ id: convId, type });
    try {
      const endpoint = type === 'direct' ? `/admin/conversations/${convId}/messages` : `/admin/shipment-chats/${convId}/messages`;
      const res = await axios.get(endpoint);
      setConversationMessages(res.data || {});
    } catch (error) {
      toast.error('Failed to load messages');
      setConversationMessages({});
    } finally {
      setLoadingMessages(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const searchMatch = !needle || [u.full_name, u.email, u.phone].some((v) => String(v || '').toLowerCase().includes(needle));
      if (!searchMatch) return false;
      return userFilter === 'all' || u.verification_status === userFilter;
    });
  }, [users, searchTerm, userFilter]);

  const filteredListings = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const tripRows = trips.map((item) => ({ ...item, kind: 'journey' }));
    const shipmentRows = shipments.map((item) => ({ ...item, kind: 'shipment' }));
    return [...tripRows, ...shipmentRows].filter((item) => {
      if (listingFilter !== 'all' && item.kind !== listingFilter) return false;
      if (!needle) return true;
      const hay = [item.origin?.address, item.destination?.address, item.description, item.traveler_name, item.sender_name, item.status].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [trips, shipments, listingFilter, searchTerm]);

  const filteredMatches = useMemo(() => matches.filter((m) => {
    const needle = searchTerm.trim().toLowerCase();
    const filterMatch = matchFilter === 'all' || m.status === matchFilter;
    if (!filterMatch) return false;
    if (!needle) return true;
    return [m.sender?.full_name, m.traveler?.full_name, m.shipment?.description, m.trip?.origin?.address, m.trip?.destination?.address, m.status]
      .join(' ').toLowerCase().includes(needle);
  }), [matches, matchFilter, searchTerm]);

  const filteredPayments = useMemo(() => payments.filter((p) => {
    const statusValue = String(p.payment_status || p.status || 'unknown').toLowerCase();
    if (paymentFilter !== 'all' && statusValue !== paymentFilter) return false;
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;
    return [p.id, p.match_id, p.sender?.full_name, p.traveler?.full_name, statusValue].join(' ').toLowerCase().includes(needle);
  }), [payments, paymentFilter, searchTerm]);

  if (loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div>;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card className="text-center"><CardContent className="p-8"><AlertCircle className="h-14 w-14 mx-auto mb-4 text-red-400" /><h2 className="text-xl font-semibold mb-2">Access denied</h2><p className="text-gray-600">Only administrators can access this page.</p></CardContent></Card>
      </div>
    );
  }

  const kpis = [
    { label: 'Users', value: stats.totalUsers, note: `+${stats.newUsers7d} in 7 days`, icon: Users, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Open listings', value: stats.activeTrips + stats.openShipments, note: `${stats.activeTrips} journeys · ${stats.openShipments} shipments`, icon: Package, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Live operations', value: stats.liveDeliveries, note: `${stats.awaitingPayment} awaiting payment`, icon: Activity, tone: 'bg-orange-50 text-orange-700' },
    { label: 'Paid volume', value: money(stats.paymentVolume), note: `${money(stats.platformFees)} platform fees`, icon: Banknote, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Messages', value: stats.totalMessages, note: `${stats.totalConversations} conversations`, icon: MessageSquare, tone: 'bg-sky-50 text-sky-700' }
  ];

  return (
    <main id="main-content" className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-7">
      <section className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><Shield className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Operations Control</h1>
                <Badge className="bg-slate-900 text-white">Admin</Badge>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-2xl">Monitor users, listings, matches, payments and communications from one workspace.</p>
              {lastRefresh && <p className="text-xs text-slate-400 mt-2">Last refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
          </div>
          <Button onClick={() => fetchAdminData()} disabled={refreshing} variant="outline" className="w-full sm:w-auto bg-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm min-w-0">
            <CardContent className="p-3 sm:p-4">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${item.tone}`}><item.icon className="h-4 w-4" /></div>
              <p className="text-xs sm:text-sm text-slate-500 mt-3">{item.label}</p>
              <p className="text-xl sm:text-2xl font-semibold text-slate-900 break-words">{item.value}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1 break-words">{item.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 h-auto p-1 bg-slate-100">
            {[
              ['overview', 'Overview'], ['users', 'Users'], ['listings', 'Listings'], ['matches', 'Matches'], ['payments', 'Payments'], ['messages', 'Messages']
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="px-3 sm:px-4 py-2.5">{label}{value === 'users' && stats.idReviews > 0 ? <span className="ml-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{stats.idReviews}</span> : null}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-[1.05fr_1.95fr] gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Needs attention</CardTitle><CardDescription>Items worth checking before they block an operation.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'ID reviews', count: stats.idReviews, icon: FileCheck, tone: 'text-orange-600 bg-orange-50' },
                  { label: 'Pending match requests', count: stats.pendingMatches, icon: Handshake, tone: 'text-violet-600 bg-violet-50' },
                  { label: 'Awaiting payment', count: stats.awaitingPayment, icon: CreditCard, tone: 'text-amber-600 bg-amber-50' },
                  { label: 'Deliveries in progress', count: stats.liveDeliveries, icon: Activity, tone: 'text-blue-600 bg-blue-50' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.tone}`}><item.icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800">{item.label}</p></div>
                    <span className="text-lg font-semibold text-slate-900">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Operational pipeline</CardTitle><CardDescription>Current state of matches moving through SendJet.</CardDescription></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ['Pending', stats.pendingMatches, Clock, 'text-amber-600 bg-amber-50'],
                    ['Payment', stats.awaitingPayment, CreditCard, 'text-orange-600 bg-orange-50'],
                    ['In progress', stats.liveDeliveries, TrendingUp, 'text-blue-600 bg-blue-50'],
                    ['Completed', stats.completedMatches, CheckCircle, 'text-emerald-600 bg-emerald-50']
                  ].map(([label, value, Icon, tone]) => (
                    <div key={label} className="rounded-xl border border-slate-100 p-3 sm:p-4">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone}`}><Icon className="h-4 w-4" /></div>
                      <p className="text-2xl font-semibold mt-3">{value}</p><p className="text-xs text-slate-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-3 gap-3 mt-4 pt-4 border-t">
                  <div><p className="text-xs text-slate-500">Verified users</p><p className="text-lg font-semibold">{stats.verifiedUsers} / {stats.totalUsers}</p></div>
                  <div><p className="text-xs text-slate-500">Active journeys</p><p className="text-lg font-semibold">{stats.activeTrips}</p></div>
                  <div><p className="text-xs text-slate-500">Open shipments</p><p className="text-lg font-semibold">{stats.openShipments}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-lg">Recent activity</CardTitle><CardDescription>Latest activity across users, listings, matches and payments.</CardDescription></CardHeader>
            <CardContent className="p-0 sm:px-6 sm:pb-6">
              <div className="divide-y">
                {recentActivity.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No activity yet</p> : recentActivity.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-4 sm:px-0 py-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${row.tone}`}><row.icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800">{row.title}</p><p className="text-xs text-slate-500 truncate">{row.detail}</p></div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(row.at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div><CardTitle className="text-lg">User supervision</CardTitle><CardDescription>Review trust signals and manage identity verification only when needed.</CardDescription></div>
                <div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email or phone" className="pl-9" /></div>
              </div>
              <div className="flex gap-2 overflow-x-auto pt-3 pb-1">
                {['all', 'id_submitted', 'id_requested', 'verified', 'pending', 'rejected'].map((filter) => (
                  <Button key={filter} size="sm" variant={userFilter === filter ? 'default' : 'outline'} className={`whitespace-nowrap ${userFilter === filter ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''}`} onClick={() => setUserFilter(filter)}>
                    {filter === 'all' ? 'All users' : getVerificationBadge(filter).label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredUsers.map((u) => {
                const verification = getVerificationBadge(u.verification_status);
                const VIcon = verification.icon;
                return (
                  <div key={u.id} className="rounded-xl border border-slate-200 p-3 sm:p-4 hover:border-slate-300 transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <PersonAvatar user={u} className="h-11 w-11" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 break-words">{u.full_name}</p>{u.role === 'admin' && <Badge className="bg-slate-900 text-white">Admin</Badge>}</div>
                          <p className="text-sm text-slate-500 break-all">{u.email}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className={statusTone(u.verification_status)}><VIcon className="h-3 w-3 mr-1" />{verification.label}</Badge>
                            {u.email_verified && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Email verified</Badge>}
                            <span className="text-xs text-slate-400">Joined {formatDate(u.created_at, false)}</span>
                            {Number(u.rating) > 0 && <span className="text-xs text-amber-600">★ {Number(u.rating).toFixed(1)} ({u.total_reviews || 0})</span>}
                          </div>
                          {u.admin_note && <p className="text-xs text-slate-500 mt-2 rounded-lg bg-slate-50 px-2 py-1.5">Admin note: {u.admin_note}</p>}
                        </div>
                      </div>
                      {u.role !== 'admin' && (
                        <div className="grid grid-cols-2 sm:flex gap-2 w-full xl:w-auto">
                          {u.id_document_url && <Button size="sm" variant="outline" onClick={() => setIdViewUser(u)}><Eye className="h-4 w-4 mr-1.5" /> ID</Button>}
                          {u.verification_status !== 'verified' && <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200" onClick={() => handleVerifyUser(u.id)}><ShieldCheck className="h-4 w-4 mr-1.5" /> Verify</Button>}
                          {['pending', 'rejected'].includes(u.verification_status) && <Button size="sm" variant="outline" onClick={() => { setActionDialogUser(u); setActionType('request'); }}><IdCard className="h-4 w-4 mr-1.5" /> Request ID</Button>}
                          {u.verification_status !== 'rejected' && <Button size="sm" variant="outline" className="text-amber-700 border-amber-200" onClick={() => { setActionDialogUser(u); setActionType('reject'); }}><ShieldX className="h-4 w-4 mr-1.5" /> Reject</Button>}
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => { if (window.confirm(`Delete ${u.full_name} and all associated data?`)) handleDeleteUser(u.id); }}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No users match this filter.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div><CardTitle className="text-lg">Listings & capacity</CardTitle><CardDescription>All public and match-only journeys and shipments, including completed records.</CardDescription></div>
                <div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search route, owner or status" className="pl-9" /></div>
              </div>
              <div className="flex gap-2 pt-3 overflow-x-auto">
                {[['all', 'All'], ['journey', 'Journeys'], ['shipment', 'Shipments']].map(([value, label]) => <Button key={value} size="sm" variant={listingFilter === value ? 'default' : 'outline'} className={listingFilter === value ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''} onClick={() => setListingFilter(value)}>{label}</Button>)}
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredListings.map((item) => {
                const isJourney = item.kind === 'journey';
                const mode = item.transport_mode || 'plane';
                const ModeIcon = mode === 'car' ? Car : mode === 'train' ? Train : mode === 'bus' ? Bus : Plane;
                const owner = isJourney ? { full_name: item.traveler_name, avatar: item.traveler_avatar } : { full_name: item.sender_name, avatar: item.sender_avatar };
                return (
                  <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-200 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0"><div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isJourney ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{isJourney ? <ModeIcon className="h-4 w-4" /> : <Package className="h-4 w-4" />}</div><div><p className="text-sm font-semibold">{isJourney ? 'Journey' : 'Shipment'}</p><p className="text-xs text-slate-400 capitalize">{item.visibility || 'public'}</p></div></div>
                      <Badge variant="outline" className={statusTone(item.status)}>{item.status}</Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" /><span className="break-words">{item.origin?.address || '—'}</span></div>
                      <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" /><span className="break-words">{item.destination?.address || '—'}</span></div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t min-w-0"><PersonAvatar user={owner} className="h-8 w-8" /><div className="min-w-0"><p className="text-xs font-medium text-slate-700 truncate">{owner.full_name || 'Unknown user'}</p><p className="text-[11px] text-slate-400">{isJourney ? `${item.available_weight || 0} kg capacity` : `${item.weight || 0} kg · ${item.description || 'Package'}`}</p></div></div>
                  </div>
                );
              })}
              {filteredListings.length === 0 && <p className="md:col-span-2 xl:col-span-3 text-sm text-slate-400 text-center py-10">No listings match this filter.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3"><div><CardTitle className="text-lg">Match & delivery supervision</CardTitle><CardDescription>Follow each transaction from request through payment and completion.</CardDescription></div><div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search people, package or route" className="pl-9" /></div></div>
              <div className="flex gap-2 pt-3 overflow-x-auto">{['all', 'pending', 'payment_pending', 'paid', 'in_progress', 'completed', 'cancelled', 'rejected'].map((value) => <Button key={value} size="sm" variant={matchFilter === value ? 'default' : 'outline'} className={`whitespace-nowrap ${matchFilter === value ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''}`} onClick={() => setMatchFilter(value)}>{value === 'all' ? 'All' : value.replace('_', ' ')}</Button>)}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredMatches.map((match) => (
                <div key={match.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone(match.status)}>{match.status}</Badge><Badge variant="outline" className={statusTone(match.payment_status)}>{match.payment_status || 'unpaid'}</Badge><span className="text-xs text-slate-400">#{String(match.id).slice(0, 8)}</span></div>
                      <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div className="flex items-center gap-2"><PersonAvatar user={match.sender} className="h-9 w-9" /><div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-400">Sender</p><p className="text-sm font-medium truncate">{match.sender?.full_name || 'Unknown'}</p></div></div>
                        <div className="flex items-center gap-2"><PersonAvatar user={match.traveler} className="h-9 w-9" /><div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-400">Traveler</p><p className="text-sm font-medium truncate">{match.traveler?.full_name || 'Unknown'}</p></div></div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-3"><span>{match.shipment?.description || 'Shipment'}</span><span>{match.trip?.origin?.address || match.shipment?.origin?.address || '—'} → {match.trip?.destination?.address || match.shipment?.destination?.address || '—'}</span><span>{formatDate(match.created_at)}</span></div>
                    </div>
                    <div className="lg:text-right flex lg:block items-end justify-between border-t lg:border-t-0 pt-3 lg:pt-0"><div><p className="text-xs text-slate-400">Agreed price</p><p className="text-xl font-semibold">{money(match.price_agreed)}</p></div><div className="lg:mt-1"><p className="text-xs text-slate-400">SendJet fee</p><p className="text-sm font-medium text-emerald-700">{money(match.platform_commission_amount)}</p></div></div>
                  </div>
                </div>
              ))}
              {filteredMatches.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No matches found.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3"><div><CardTitle className="text-lg">Payment ledger</CardTitle><CardDescription>Read-only operational view of payment attempts and completed charges.</CardDescription></div><div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search user, match or payment" className="pl-9" /></div></div><div className="flex gap-2 pt-3 overflow-x-auto">{['all', 'initiated', 'paid', 'failed', 'refunded'].map((value) => <Button key={value} size="sm" variant={paymentFilter === value ? 'default' : 'outline'} className={paymentFilter === value ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''} onClick={() => setPaymentFilter(value)}>{value === 'all' ? 'All' : value}</Button>)}</div></CardHeader>
            <CardContent className="space-y-3">
              {filteredPayments.map((payment) => (
                <div key={payment.id || payment.session_id} className="rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CreditCard className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{payment.sender?.full_name || 'Sender'}</p><ArrowRight className="h-3 w-3 text-slate-400" /><p className="text-sm text-slate-600">{payment.traveler?.full_name || 'Traveler'}</p><Badge variant="outline" className={statusTone(payment.payment_status || payment.status)}>{payment.payment_status || payment.status || 'unknown'}</Badge></div><p className="text-xs text-slate-400 mt-1">Match #{String(payment.match_id || '').slice(0, 8)} · {formatDate(payment.created_at)}</p></div>
                  <p className="text-lg font-semibold">{money(payment.amount, payment.currency)}</p>
                </div>
              ))}
              {filteredPayments.length === 0 && <div className="text-center py-10"><CreditCard className="h-10 w-10 mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-400">No payment transactions yet.</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          {selectedConversation ? (
            <Card className="shadow-sm">
              <CardHeader className="pb-3"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><CardTitle className="text-lg">Conversation oversight</CardTitle><CardDescription>{selectedConversation.type === 'direct' ? 'Direct conversation' : 'Shipment chat'} · read-only admin view</CardDescription></div><Button variant="outline" onClick={() => { setSelectedConversation(null); setConversationMessages([]); }}>Back to conversations</Button></div></CardHeader>
              <CardContent>
                {loadingMessages ? <div className="py-12 flex justify-center"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-orange-500" /></div> : (
                  <div>
                    {conversationMessages.participants && <div className="flex flex-wrap gap-2 mb-4">{Object.entries(conversationMessages.participants).map(([id, p]) => <Badge key={id} variant="outline">{p.full_name} · {p.role}</Badge>)}</div>}
                    <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-50 p-3 space-y-2">
                      {(conversationMessages.messages || []).map((msg, idx) => {
                        const senderName = msg.sender_id === 'system' ? 'System' : conversationMessages.participants?.[msg.sender_id]?.full_name || 'Unknown';
                        return <div key={msg.id || idx} className={`rounded-xl p-3 ${msg.sender_id === 'system' ? 'bg-amber-50 border border-amber-100 text-center' : 'bg-white border border-slate-200'}`}><div className="flex gap-2 items-center"><p className="text-xs font-semibold text-slate-700">{senderName}</p><span className="text-[11px] text-slate-400 ml-auto">{formatDate(msg.timestamp)}</span></div><p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">{msg.content}</p></div>;
                      })}
                      {(conversationMessages.messages || []).length === 0 && <p className="text-sm text-slate-400 text-center py-8">No messages in this conversation.</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid xl:grid-cols-2 gap-4">
              <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-600" />Direct conversations</CardTitle><CardDescription>{conversations.length} conversations</CardDescription></CardHeader><CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
                {conversations.map((conv) => <button key={conv.id} type="button" onClick={() => openConversation(conv.id, 'direct')} className="w-full text-left rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors"><div className="flex items-center gap-2 flex-wrap">{conv.participants?.map((p) => <span key={p.id} className="text-sm font-medium">{p.full_name}</span>)}</div><p className="text-xs text-slate-500 truncate mt-1">{conv.last_message || 'No messages yet'}</p><div className="flex justify-between mt-2 text-[11px] text-slate-400"><span>{conv.message_count || 0} messages</span><span>{timeAgo(conv.last_message_at || conv.created_at)}</span></div></button>)}
                {conversations.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No direct conversations yet.</p>}
              </CardContent></Card>
              <Card className="shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-orange-600" />Shipment chats</CardTitle><CardDescription>{shipmentChats.length} shipment threads</CardDescription></CardHeader><CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
                {shipmentChats.map((chat) => <button key={chat.id} type="button" onClick={() => openConversation(chat.shipment_id, 'shipment')} className="w-full text-left rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors"><p className="text-sm font-medium truncate">{chat.shipment_description || `Shipment #${String(chat.shipment_id || '').slice(0, 8)}`}</p><div className="flex justify-between mt-2 text-[11px] text-slate-400"><span>{chat.message_count || 0} messages</span><span>{timeAgo(chat.last_message_at || chat.created_at)}</span></div></button>)}
                {shipmentChats.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No shipment chats yet.</p>}
              </CardContent></Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!idViewUser} onOpenChange={(open) => !open && setIdViewUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ID document · {idViewUser?.full_name}</DialogTitle><DialogDescription>{idViewUser?.email}</DialogDescription></DialogHeader>
          <div className="space-y-4">{idViewUser?.id_document_url && <img src={idViewUser.id_document_url} alt="ID document" className="w-full max-h-[55vh] object-contain rounded-xl border bg-slate-50" />}<div className="grid sm:grid-cols-2 gap-2"><Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { handleVerifyUser(idViewUser.id); setIdViewUser(null); }}><ShieldCheck className="h-4 w-4 mr-2" />Approve</Button><Button variant="outline" className="text-red-600" onClick={() => { setActionDialogUser(idViewUser); setActionType('reject'); setIdViewUser(null); }}><ShieldX className="h-4 w-4 mr-2" />Reject</Button></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionDialogUser} onOpenChange={(open) => !open && setActionDialogUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'reject' ? 'Reject verification' : 'Request identity verification'}</DialogTitle><DialogDescription>{actionType === 'reject' ? `Explain why ${actionDialogUser?.full_name}'s verification is being rejected.` : `Tell ${actionDialogUser?.full_name} what document is needed.`}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2"><Textarea value={actionType === 'reject' ? rejectReason : requestIdNote} onChange={(e) => actionType === 'reject' ? setRejectReason(e.target.value) : setRequestIdNote(e.target.value)} rows={4} /><div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><Button variant="outline" onClick={() => setActionDialogUser(null)}>Cancel</Button><Button className={actionType === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'} onClick={() => actionType === 'reject' ? handleRejectUser(actionDialogUser.id) : handleRequestId(actionDialogUser.id)}>{actionType === 'reject' ? 'Reject verification' : 'Send ID request'}</Button></div></div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminDashboard;
