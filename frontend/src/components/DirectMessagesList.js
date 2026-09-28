import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { MessageCircle, User, Loader2, Search, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { BackButton } from './BackButton';
import useDirectMessagesSocket from '../hooks/useDirectMessagesSocket';
import { formatConversationTime } from '../lib/dateTime';

const initials = (name) => (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const DirectMessagesList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const response = await axios.get('/conversations/my');
      setConversations(response.data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 20000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const onRealtimeEvent = useCallback((event) => {
    if (event.type === 'direct_message' || event.type === 'conversation_updated') fetchConversations();
  }, [fetchConversations]);
  useDirectMessagesSocket(onRealtimeEvent, !!user);

  const filtered = useMemo(() => conversations.filter((conv) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (conv.other_user?.full_name || '').toLowerCase().includes(q) || (conv.last_message?.content || '').toLowerCase().includes(q);
  }), [conversations, query]);

  if (loading) return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-orange-500" /></div>;

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <BackButton fallback="/dashboard" className="mb-4" />
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 flex items-center gap-2"><MessageCircle className="h-6 w-6 text-orange-500" />Messages</h1>
        <p className="text-sm text-gray-500 mt-1">Chat directly, agree on details, then send a match request when you're ready.</p>
      </div>

      {conversations.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {conversations.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-6">
            <div className="h-14 w-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3"><MessageCircle className="h-7 w-7 text-orange-400" /></div>
            <h3 className="font-medium text-gray-800">No conversations yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Open a traveler or sender profile and start a conversation. You can request a match directly from the chat later.</p>
            <Button onClick={() => navigate('/marketplace')} className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">Browse Marketplace</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No conversations match your search.</div>
        ) : filtered.map((conv) => (
          <button key={conv.id} type="button" onClick={() => navigate(`/direct-messages/${conv.id}`)} data-testid={`dm-conversation-${conv.id}`} className="w-full text-left flex items-center gap-3 p-3.5 sm:p-4 border-b last:border-b-0 hover:bg-gray-50 transition">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
              {conv.other_user?.avatar ? <img src={conv.other_user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : initials(conv.other_user?.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{conv.other_user?.full_name || 'Unknown User'}</h3>
                  {conv.other_user?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                </div>
                {conv.last_message && <span className="text-xs text-gray-400 flex-shrink-0">{formatConversationTime(conv.last_message.timestamp)}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">{conv.other_user?.role || 'user'}</span>
              </div>
              <p className={`text-sm truncate mt-1 ${conv.unread_count > 0 ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                {conv.last_message ? `${conv.last_message.sender_id === user.id ? 'You: ' : ''}${conv.last_message.content}` : 'New conversation'}
              </p>
            </div>
            {conv.unread_count > 0 && <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center flex-shrink-0">{conv.unread_count > 99 ? '99+' : conv.unread_count}</span>}
          </button>
        ))}
      </div>
    </main>
  );
};

export default DirectMessagesList;
