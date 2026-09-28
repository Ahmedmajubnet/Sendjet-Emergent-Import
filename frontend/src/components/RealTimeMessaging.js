import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  MessageCircle, 
  Send, 
  User, 
  Search,
  Star,
  Plus,
  Clock,
  Check,
  CheckCheck,
  Phone,
  Video,
  MapPin,
  Paperclip,
  Smile
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
  }

  connect(userId, onMessage, onConnect, onDisconnect) {
    try {
      // NOTE: This legacy component is no longer mounted (MessagingHub is the active
      // messaging UI). Path kept under the /api-routed prefix for consistency; the
      // live real-time transport lives in hooks/useDirectMessagesSocket.js.
      const configuredBackend = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const base = new URL(configuredBackend, window.location.origin);
      base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
      base.pathname = `/api/ws/notifications/${userId}`;
      const wsUrl = base.toString();
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        onConnect && onConnect();
        
        // Send ping to keep connection alive
        this.sendPing();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            // Handle pong response
            return;
          }
          onMessage && onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        onDisconnect && onDisconnect();
        this.attemptReconnect(userId, onMessage, onConnect, onDisconnect);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Fallback to polling
      this.setupPolling(userId, onMessage);
    }
  }
  
  setupPolling(userId, onMessage) {
    // Fallback polling mechanism
    this.pollingInterval = setInterval(async () => {
      try {
        // Poll for new messages every 2 seconds
        const response = await axios.get(`/messages/recent/${userId}`);
        if (response.data && response.data.length > 0) {
          response.data.forEach(message => {
            onMessage({ type: 'new_message', data: message });
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }
  
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
      setTimeout(() => this.sendPing(), 30000); // Ping every 30 seconds
    }
  }
  
  attemptReconnect(userId, onMessage, onConnect, onDisconnect) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(userId, onMessage, onConnect, onDisconnect);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}

const RealTimeMessaging = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  const wsManager = useRef(new WebSocketManager());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (user) {
      initializeMessaging();
      connectWebSocket();
    }
    
    return () => {
      wsManager.current.disconnect();
    };
    // initializeMessaging/connectWebSocket are defined in component scope.
    // Re-running only when user changes is the desired behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (targetUserId && conversations.length > 0) {
      startConversationWithUser(targetUserId);
    }
    // startConversationWithUser is stable in scope; deps cover the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    if (!user) return;
    
    wsManager.current.connect(
      user.id,
      handleWebSocketMessage,
      () => setConnectionStatus('connected'),
      () => setConnectionStatus('disconnected')
    );
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'new_message':
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.find(m => m.id === data.data.id);
          if (!exists) {
            return [...prev, data.data];
          }
          return prev;
        });
        
        // Update conversation list
        updateConversationLastMessage(data.data);
        
        // Show notification if not current conversation
        if (selectedConversation?.userId !== data.data.sender_id) {
          showNotification(data.data);
        }
        break;
        
      case 'user_online':
        setOnlineUsers(prev => new Set(prev).add(data.userId));
        break;
        
      case 'user_offline':
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        break;
        
      case 'typing_start':
        setTypingUsers(prev => new Set(prev).add(data.userId));
        break;
        
      case 'typing_stop':
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        break;
    }
  };

  const initializeMessaging = async () => {
    try {
      // Fetch conversations and users
      const [tripsRes, shipmentsRes] = await Promise.all([
        axios.get('/trips').catch(() => ({ data: [] })),
        axios.get('/shipments').catch(() => ({ data: [] }))
      ]);

      const conversations = [];
      
      // Create conversations from trips and shipments
      tripsRes.data.forEach(trip => {
        if (trip.traveler_id !== user.id) {
          conversations.push(createConversationFromTrip(trip));
        }
      });

      shipmentsRes.data.forEach(shipment => {
        if (shipment.sender_id !== user.id) {
          conversations.push(createConversationFromShipment(shipment));
        }
      });

      // Remove duplicates and add existing conversations
      const uniqueConversations = conversations.filter((conv, index, self) => 
        index === self.findIndex(c => c.userId === conv.userId)
      );

      setConversations(uniqueConversations);
    } catch (error) {
      console.error('Failed to initialize messaging:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConversationFromTrip = (trip) => {
    return {
      userId: trip.traveler_id,
      name: getUserName(trip.traveler_id),
      role: 'traveler',
      lastMessage: 'Available for trip',
      timestamp: trip.created_at,
      unread: 0,
      online: onlineUsers.has(trip.traveler_id),
      rating: 4.8,
      context: {
        type: 'trip',
        id: trip.id,
        route: `${trip.origin.address} → ${trip.destination.address}`,
        date: trip.departure_date,
        price: trip.price_per_kg
      }
    };
  };

  const createConversationFromShipment = (shipment) => {
    return {
      userId: shipment.sender_id,
      name: getUserName(shipment.sender_id),
      role: 'sender',
      lastMessage: 'Package delivery request',
      timestamp: shipment.created_at,
      unread: 0,
      online: onlineUsers.has(shipment.sender_id),
      rating: 4.9,
      context: {
        type: 'shipment',
        id: shipment.id,
        route: `${shipment.origin.address} → ${shipment.destination.address}`,
        weight: shipment.weight,
        value: shipment.declared_value
      }
    };
  };

  const getUserName = (userId) => {
    if (userId.includes('7e3e4bab')) return 'Ahmed Ali';
    if (userId.includes('4b65d74e')) return 'Ahmed Mahgoub Ibrahim Ali';
    if (userId.includes('ec9e259d')) return 'John Traveler';
    if (userId.includes('53db119c')) return 'Jane Sender';
    return 'User';
  };

  const startConversationWithUser = async (userId) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(c => c.userId === userId);
      
      if (existingConv) {
        setSelectedConversation(existingConv);
      } else {
        // Create new conversation
        const newConv = {
          userId,
          name: getUserName(userId),
          role: userId.includes('traveler') || userId.includes('7e3e4bab') ? 'traveler' : 'sender',
          lastMessage: '',
          timestamp: new Date().toISOString(),
          unread: 0,
          online: onlineUsers.has(userId),
          rating: 4.8,
          context: null
        };
        
        setConversations(prev => [newConv, ...prev]);
        setSelectedConversation(newConv);
      }
      
      // Load messages for this conversation
      await fetchMessages(userId);
      
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await axios.get(`/messages/${userId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;

    const messageData = {
      receiver_id: selectedConversation.userId,
      content: newMessage.trim()
    };

    // Optimistically add message to UI
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedConversation.userId,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      sending: true
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      // Send via WebSocket first
      const sent = wsManager.current.sendMessage({
        type: 'send_message',
        data: messageData
      });

      // If WebSocket fails, use HTTP API
      if (!sent) {
        const response = await axios.post('/messages', messageData);
        
        // Replace temp message with real message
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? response.data : msg
        ));
      }
      
      // Update conversation
      updateConversationLastMessage({ 
        ...messageData, 
        content: messageData.content,
        sender_id: user.id,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    }
  };

  const handleTyping = () => {
    if (!selectedConversation) return;
    
    // Send typing indicator
    wsManager.current.sendMessage({
      type: 'typing_start',
      userId: selectedConversation.userId
    });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      wsManager.current.sendMessage({
        type: 'typing_stop',
        userId: selectedConversation.userId
      });
    }, 2000);
  };

  const updateConversationLastMessage = (message) => {
    setConversations(prev => prev.map(conv => {
      if (conv.userId === message.sender_id || conv.userId === message.receiver_id) {
        return {
          ...conv,
          lastMessage: message.content,
          timestamp: message.timestamp,
          unread: message.sender_id !== user.id ? conv.unread + 1 : conv.unread
        };
      }
      return conv;
    }));
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${getUserName(message.sender_id)}`, {
        body: message.content,
        icon: '/favicon.ico'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showNotification(message);
        }
      });
    }
    
    // Also show toast
    toast.info(`New message from ${getUserName(message.sender_id)}`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-6rem)] fade-in">
      {/* Connection Status */}
      <div className="mb-4">
        <Badge 
          className={`${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}
        >
          {connectionStatus === 'connected' ? '🟢 Real-time messaging active' : '🔴 Offline mode'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                Real-time Messages
              </CardTitle>
              <Badge variant="secondary" className="bg-blue-100 text-blue-600">
                {conversations.filter(c => c.unread > 0).length} unread
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.userId}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      fetchMessages(conversation.userId);
                    }}
                    className={`p-4 cursor-pointer transition-colors border-l-4 ${
                      selectedConversation?.userId === conversation.userId
                        ? 'bg-blue-50 border-blue-400'
                        : 'hover:bg-gray-50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-white" />
                        </div>
                        {conversation.online && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conversation.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(conversation.timestamp)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage || 'Start conversation...'}
                          </p>
                          {conversation.unread > 0 && (
                            <Badge className="bg-blue-500 text-white text-xs">
                              {conversation.unread}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Context info */}
                        {conversation.context && (
                          <div className="mt-1">
                            <p className="text-xs text-purple-600 truncate">
                              {conversation.context.type === 'trip' ? '✈️' : '📦'} {conversation.context.route}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      {selectedConversation.online && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedConversation.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedConversation.online ? '🟢 Online' : '⚪ Offline'} • {selectedConversation.role}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[calc(100vh-28rem)] p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl message-bubble ${
                            message.sender_id === user.id
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          } ${
                            message.sending ? 'opacity-70' : ''
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            message.sender_id === user.id ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            <p className="text-xs">{formatTime(message.timestamp)}</p>
                            {message.sender_id === user.id && (
                              message.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                            )}
                            {message.sending && (
                              <Clock className="h-3 w-3 animate-spin" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing indicator */}
                    {typingUsers.has(selectedConversation.userId) && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 px-4 py-2 rounded-2xl">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="border-t border-gray-100 p-4">
                <form onSubmit={sendMessage} className="flex items-center space-x-2">
                  <Button type="button" variant="ghost" size="sm">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type your message..."
                    className="flex-1 input-focus"
                  />
                  <Button type="button" variant="ghost" size="sm">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="btn-primary text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                <p>Choose a conversation to start real-time messaging</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RealTimeMessaging;