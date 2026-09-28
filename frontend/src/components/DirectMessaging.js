import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ArrowLeft, Send, User, MessageCircle, Loader2, Handshake, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatchRequestDialog from './MatchRequestDialog';
import useDirectMessagesSocket from '../hooks/useDirectMessagesSocket';
import { formatMessageTime } from '../lib/dateTime';

const DirectMessaging = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const handleBack = () => {
    if (location.key && location.key !== 'default') navigate(-1);
    else navigate('/direct-messages');
  };

  const fetchConversation = useCallback(async () => {
    try {
      const res = await axios.get(`/conversations/${conversationId}`);
      if (res.data?.other_user) setOtherUser(res.data.other_user);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await axios.get(`/conversations/${conversationId}/messages`);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied to this conversation');
        navigate('/direct-messages');
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, navigate]);

  const markAsRead = useCallback(async () => {
    try {
      await axios.put(`/conversations/${conversationId}/read`);
    } catch (error) {
      console.warn('Failed to mark conversation as read:', error?.message);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    fetchConversation();
    fetchMessages();
    markAsRead();
    // Low-frequency safety fallback; live updates come from WebSocket.
    const interval = setInterval(fetchMessages, 20000);
    return () => clearInterval(interval);
  }, [conversationId, fetchConversation, fetchMessages, markAsRead]);

  const onRealtimeEvent = useCallback((event) => {
    if (event.type !== 'direct_message' || event.conversation_id !== conversationId || !event.message) return;
    setMessages((prev) => prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]);
    if (event.message.sender_id !== user?.id) markAsRead();
  }, [conversationId, markAsRead, user?.id]);

  const liveConnected = useDirectMessagesSocket(onRealtimeEvent, !!user);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const response = await axios.post(`/conversations/${conversationId}/messages`, { content });
      setMessages((prev) => prev.some((m) => m.id === response.data.id) ? prev : [...prev, response.data]);
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-orange-500" /></div>;
  }

  return (
    <main id="main-content" className="mx-auto max-w-4xl h-[100dvh] bg-white sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:shadow-sm flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-2.5 sm:px-4 py-2.5 sm:py-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="back-button" aria-label="Go back" className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <button type="button" onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl hover:bg-gray-50 px-1.5 py-1 transition">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{otherUser?.full_name || 'Conversation'}</h2>
                {otherUser?.is_verified && <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 capitalize">{otherUser?.role || 'user'}</span>
                <span className={`text-[11px] flex items-center gap-1 ${liveConnected ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {liveConnected ? 'Live' : 'Connecting'}
                </span>
              </div>
            </div>
          </button>

          {otherUser?.id && (
            <Button variant="outline" size="sm" onClick={() => setMatchOpen(true)} className="flex-shrink-0 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50" data-testid="chat-request-match">
              <Handshake className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Requests / Match</span>
            </Button>
          )}
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-[#fafafa] overscroll-contain">
        {messages.length === 0 ? (
          <div className="h-full min-h-64 flex flex-col items-center justify-center text-center px-6">
            <div className="h-14 w-14 rounded-full bg-orange-50 flex items-center justify-center mb-3"><MessageCircle className="h-7 w-7 text-orange-400" /></div>
            <p className="font-medium text-gray-800">Start the conversation</p>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">Ask about the route, parcel details or timing. When you're ready, send a match request without leaving the chat.</p>
            {otherUser?.id && <Button variant="outline" size="sm" onClick={() => setMatchOpen(true)} className="mt-4"><Handshake className="h-4 w-4 mr-2" />Request a match</Button>}
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((message) => {
              const isMe = message.sender_id === user.id;
              return (
                <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-sm ${isMe ? 'bg-orange-500 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'}`}>
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-[11px] mt-1 text-right ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>{formatMessageTime(message.timestamp)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </section>

      <footer className="bg-white border-t border-gray-200 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message…" className="flex-1 rounded-xl min-h-11" disabled={sending} data-testid="dm-message-input" />
          <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11 w-11 p-0" data-testid="dm-send-button" aria-label="Send message">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </footer>

      <MatchRequestDialog open={matchOpen} onOpenChange={setMatchOpen} targetUserId={otherUser?.id} targetUserName={otherUser?.full_name} conversationId={conversationId} />
    </main>
  );
};

export default DirectMessaging;
