import { shipmentStatusLabel } from '../lib/matchLifecycle';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  MessageCircle, 
  Send, 
  User, 
  Package,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Truck,
  MapPin,
  Phone,
  Settings,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { buildWebSocketUrl } from '../lib/websocket';

// WebSocket manager for shipment-specific chats
class ShipmentChatManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.shipmentId = null;
    this.userId = null;
  }

  connect(shipmentId, userId, onMessage, onConnect, onDisconnect) {
    this.shipmentId = shipmentId;
    this.userId = userId;
    
    try {
      // Route through the /api-prefixed backend path so the ingress proxies the
      // WebSocket to the backend (bare /ws/... would hit the frontend).
      const wsUrl = buildWebSocketUrl(`/api/ws/shipment/${shipmentId}/${userId}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log(`Connected to shipment ${shipmentId} chat`);
        this.reconnectAttempts = 0;
        onConnect && onConnect();
        
        // Send ping to keep connection alive
        this.sendPing();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            return;
          }
          onMessage && onMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log(`Disconnected from shipment ${shipmentId} chat:`, event.code, event.reason);
        onDisconnect && onDisconnect();
        this.attemptReconnect(onMessage, onConnect, onDisconnect);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to connect to shipment chat:', error);
      onDisconnect && onDisconnect();
    }
  }
  
  sendMessage(content) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'send_message',
        content: content
      }));
      return true;
    }
    return false;
  }
  
  sendTyping(isTyping) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        typing: isTyping
      }));
    }
  }
  
  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
      setTimeout(() => this.sendPing(), 30000); // Ping every 30 seconds
    }
  }
  
  attemptReconnect(onMessage, onConnect, onDisconnect) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(this.shipmentId, this.userId, onMessage, onConnect, onDisconnect);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

const ShipmentChat = () => {
  const { shipmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatInfo, setChatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  const chatManager = useRef(new ShipmentChatManager());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (shipmentId && user) {
      initializeChat();
      connectToShipmentChat();
    }
    
    return () => {
      chatManager.current.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
    // initializeChat/connectToShipmentChat are defined in component scope and
    // close over shipmentId/user already; re-running on those deps is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      // Load chat info and messages
      const [chatInfoRes, messagesRes] = await Promise.all([
        axios.get(`/shipments/${shipmentId}/chat-info`),
        axios.get(`/shipments/${shipmentId}/messages`)
      ]);
      
      setChatInfo(chatInfoRes.data);
      setMessages(messagesRes.data);
      
      // Mark messages as read
      const unreadMessages = messagesRes.data.filter(
        msg => msg.sender_id !== user.id && !msg.read_by.includes(user.id)
      );
      
      for (const msg of unreadMessages) {
        await axios.post(`/shipments/${shipmentId}/messages/${msg.id}/read`);
      }
      
    } catch (error) {
      console.error('Failed to load chat:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have access to this shipment chat');
        navigate('/dashboard');
      } else {
        toast.error('Failed to load chat');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectToShipmentChat = () => {
    chatManager.current.connect(
      shipmentId,
      user.id,
      handleWebSocketMessage,
      () => setConnectionStatus('connected'),
      () => setConnectionStatus('disconnected')
    );
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'new_message':
        const newMsg = data.data;
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.find(m => m.id === newMsg.id);
          if (!exists) {
            return [...prev, newMsg];
          }
          return prev;
        });
        
        // Mark as read if not from current user
        if (newMsg.sender_id !== user.id) {
          setTimeout(() => {
            axios.post(`/shipments/${shipmentId}/messages/${newMsg.id}/read`)
              .catch(err => console.error('Failed to mark message as read:', err));
          }, 1000);
        }
        break;
        
      case 'message_read':
        setMessages(prev => prev.map(msg => 
          msg.id === data.data.message_id
            ? { ...msg, read_by: [...msg.read_by, data.data.user_id] }
            : msg
        ));
        break;
        
      case 'user_joined':
        setOnlineUsers(prev => new Set(prev).add(data.user_id));
        break;
        
      case 'user_left':
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user_id);
          return newSet;
        });
        break;
        
      case 'typing':
        if (data.typing) {
          setTypingUsers(prev => new Set(prev).add(data.user_id));
        } else {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.user_id);
            return newSet;
          });
        }
        break;
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage('');

    // Try WebSocket first
    const sent = chatManager.current.sendMessage(content);
    
    if (!sent) {
      // Fallback to HTTP API
      try {
        await axios.post(`/shipments/${shipmentId}/messages`, {
          shipment_id: shipmentId,
          content: content,
          message_type: 'user'
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('Failed to send message');
        setNewMessage(content); // Restore message
      }
    }
  };

  const handleTyping = () => {
    chatManager.current.sendTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      chatManager.current.sendTyping(false);
    }, 2000);
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

  const getMessageIcon = (messageType) => {
    switch (messageType) {
      case 'system':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'user':
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getUserName = (userId) => {
    if (!chatInfo) return 'User';
    const participant = chatInfo.participants.find(p => p.user_id === userId);
    return participant ? participant.name : 'User';
  };

  const getUserRole = (userId) => {
    if (!chatInfo) return 'user';
    const participant = chatInfo.participants.find(p => p.user_id === userId);
    return participant ? participant.role : 'user';
  };

  const isMessageRead = (message) => {
    return message.read_by && message.read_by.length > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!chatInfo) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-semibold mb-2">Chat Not Found</h2>
            <p className="text-gray-600">This shipment chat doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 h-[calc(100vh-6rem)] fade-in">
      {/* Chat Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Shipment Chat: {chatInfo.shipment_description}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2">
                  <Badge 
                    className={`${
                      chatInfo.shipment_status === 'delivered' ? 'bg-green-100 text-green-800' :
                      chatInfo.shipment_status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                      chatInfo.shipment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {shipmentStatusLabel({ status: chatInfo.shipment_status }, chatInfo.match_status ? { status: chatInfo.match_status, payment_status: chatInfo.payment_status } : null)}
                  </Badge>
                  {chatInfo.match_status && (
                    <Badge variant="outline">
                      Match: {chatInfo.match_status}
                    </Badge>
                  )}
                  <Badge 
                    className={`${
                      connectionStatus === 'connected' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Offline'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <Badge className="bg-purple-100 text-purple-800">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin View
                </Badge>
              )}
              <Button variant="outline" size="sm">
                <MapPin className="h-4 w-4 mr-1" />
                Track
              </Button>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1" />
                Contact
              </Button>
            </div>
          </div>
          
          {/* Participants */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-sm font-medium text-gray-600">Participants:</span>
            {chatInfo.participants.map((participant) => (
              <div key={participant.user_id} className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={`text-xs ${
                    participant.role === 'sender' ? 'bg-blue-100 text-blue-800' :
                    participant.role === 'traveler' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {participant.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{participant.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {participant.role} {participant.online ? '• 🟢 Online' : '• ⚪ Offline'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-24rem)] p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.message_type === 'system' ? (
                    // System Message
                    <div className="flex justify-center my-4">
                      <div className="bg-gray-100 border border-gray-200 rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{message.content}</span>
                        <span className="text-xs text-gray-400">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // User Message
                    <div
                      className={`flex ${
                        message.sender_id === user.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div className="flex items-start gap-3 max-w-xs lg:max-w-md">
                        {message.sender_id !== user.id && (
                          <Avatar className="w-8 h-8 mt-1">
                            <AvatarFallback className={`text-xs ${
                              getUserRole(message.sender_id) === 'sender' ? 'bg-blue-100 text-blue-800' :
                              getUserRole(message.sender_id) === 'traveler' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getUserName(message.sender_id).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            message.sender_id === user.id
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.sender_id !== user.id && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {getUserName(message.sender_id)}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            message.sender_id === user.id ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            <p className="text-xs">{formatTime(message.timestamp)}</p>
                            {message.sender_id === user.id && (
                              isMessageRead(message) ? 
                                <CheckCheck className="h-3 w-3" /> : 
                                <Check className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {Array.from(typingUsers).map(userId => getUserName(userId)).join(', ')} typing...
                    </span>
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
            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder={`Type a message about this shipment...`}
              className="flex-1 input-focus"
              disabled={connectionStatus === 'disconnected'}
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || connectionStatus === 'disconnected'}
              className="btn-primary text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          {connectionStatus === 'disconnected' && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Disconnected - messages will be sent when connection is restored
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ShipmentChat;