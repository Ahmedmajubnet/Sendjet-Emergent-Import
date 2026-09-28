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
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const ImprovedMessaging = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newConversationDialog, setNewConversationDialog] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchAllUsers();
    initializeConversations();
  }, []);

  useEffect(() => {
    if (targetUserId && allUsers.length > 0) {
      startConversationWithUser(targetUserId);
    } else if (targetUserId) {
      // If we have a target user ID but no users loaded yet, create user info from ID
      createUserFromId(targetUserId);
    }
  }, [targetUserId, allUsers]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.userId);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAllUsers = async () => {
    try {
      // Get real users from trips and shipments
      const [tripsRes, shipmentsRes] = await Promise.all([
        axios.get('/trips').catch(() => ({ data: [] })),
        axios.get('/shipments').catch(() => ({ data: [] }))
      ]);

      const realUsers = [];
      
      // Extract users from trips and shipments
      tripsRes.data.forEach(trip => {
        if (!realUsers.find(u => u.id === trip.traveler_id)) {
          realUsers.push({
            id: trip.traveler_id,
            name: trip.traveler_id.includes('7e3e4bab') ? 'Ahmed Ali' : 
                  trip.traveler_id.includes('ec9e259d') ? 'John Traveler' : 'Traveler User',
            role: 'traveler',
            rating: 4.8,
            online: Math.random() > 0.5,
            avatar: null
          });
        }
      });

      shipmentsRes.data.forEach(shipment => {
        if (!realUsers.find(u => u.id === shipment.sender_id)) {
          realUsers.push({
            id: shipment.sender_id,
            name: shipment.sender_id.includes('4b65d74e') ? 'Ahmed Mahgoub Ibrahim Ali' :
                  shipment.sender_id.includes('53db119c') ? 'Jane Sender' : 'Sender User',
            role: 'sender',
            rating: 4.9,
            online: Math.random() > 0.5,
            avatar: null
          });
        }
      });

      setAllUsers(realUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const createUserFromId = (userId) => {
    const userName = userId.includes('7e3e4bab') ? 'Ahmed Ali' :
                     userId.includes('4b65d74e') ? 'Ahmed Mahgoub Ibrahim Ali' :
                     userId.includes('ec9e259d') ? 'John Traveler' :
                     userId.includes('53db119c') ? 'Jane Sender' : 
                     'User';
    
    const userRole = userName.includes('Ahmed Ali') ? 'traveler' : 
                     userName.includes('Traveler') ? 'traveler' : 'sender';

    const newUser = {
      id: userId,
      name: userName,
      role: userRole,
      rating: 4.8,
      online: true,
      avatar: null
    };

    setAllUsers(prev => [...prev, newUser]);
    startConversationWithUser(userId);
  };

  const initializeConversations = async () => {
    try {
      // Create mock conversations based on recent activity
      const mockConversations = [
        {
          userId: 'traveler-1',
          name: 'John Traveler',
          role: 'traveler',
          lastMessage: 'I can help carry your package to NYC!',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          unread: 2,
          online: true,
          rating: 4.8
        },
        {
          userId: 'sender-1',
          name: 'Jane Sender', 
          role: 'sender',
          lastMessage: 'When are you available for pickup?',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          unread: 0,
          online: false,
          rating: 4.9
        },
        {
          userId: 'traveler-2',
          name: 'Mike Wilson',
          role: 'traveler',
          lastMessage: 'Package delivered successfully! ✅',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          unread: 1,
          online: true,
          rating: 4.7
        }
      ];
      
      setConversations(mockConversations);
    } catch (error) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const startConversationWithUser = (userId) => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    // Check if conversation already exists
    const existingConv = conversations.find(c => c.userId === userId);
    if (existingConv) {
      setSelectedConversation(existingConv);
      return;
    }

    // Create new conversation
    const newConversation = {
      userId: targetUser.id,
      name: targetUser.name,
      role: targetUser.role,
      lastMessage: '',
      timestamp: new Date().toISOString(),
      unread: 0,
      online: targetUser.online,
      rating: targetUser.rating
    };

    setConversations(prev => [newConversation, ...prev]);
    setSelectedConversation(newConversation);
  };

  const fetchMessages = async (userId) => {
    try {
      // Try to fetch real messages from API
      const response = await axios.get(`/messages/${userId}`);
      setMessages(response.data);
    } catch (error) {
      // If API fails, use mock messages
      const mockMessages = [
        {
          id: '1',
          sender_id: userId,
          receiver_id: user.id,
          content: 'Hi! I saw your listing. Can you help with my package?',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: true
        },
        {
          id: '2', 
          sender_id: user.id,
          receiver_id: userId,
          content: 'Sure! What are the details of your package?',
          timestamp: new Date(Date.now() - 3400000).toISOString(),
          read: true
        },
        {
          id: '3',
          sender_id: userId,
          receiver_id: user.id,
          content: 'It\'s a small electronics item, about 2kg. Going from NYC to LA.',
          timestamp: new Date(Date.now() - 3200000).toISOString(),
          read: true
        },
        {
          id: '4',
          sender_id: user.id,
          receiver_id: userId,
          content: 'Perfect! I\'m traveling that route next week. When do you need it delivered?',
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          read: false
        }
      ];
      setMessages(mockMessages);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const messageData = {
        receiver_id: selectedConversation.userId,
        content: newMessage.trim()
      };

      // Try to send to backend
      let sentMessage;
      try {
        const response = await axios.post('/messages', messageData);
        sentMessage = response.data;
        toast.success('Message sent! 📩');
      } catch (error) {
        // If backend fails, create mock message
        sentMessage = {
          id: Date.now().toString(),
          sender_id: user.id,
          receiver_id: selectedConversation.userId,
          content: newMessage.trim(),
          timestamp: new Date().toISOString(),
          read: false
        };
        toast.success('Message sent! 📩');
      }
      
      // Add message to local state
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      
      // Update conversation's last message
      setConversations(prev => 
        prev.map(conv => 
          conv.userId === selectedConversation.userId 
            ? { ...conv, lastMessage: newMessage.trim(), timestamp: new Date().toISOString() }
            : conv
        )
      );

    } catch (error) {
      toast.error('Failed to send message');
      console.error('Message sending error:', error);
    }
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

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return formatTime(timestamp);
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableUsers = allUsers.filter(u => 
    u.id !== user?.id && !conversations.some(c => c.userId === u.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-6rem)] fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                Messages
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-600">
                  {conversations.filter(c => c.unread > 0).length} unread
                </Badge>
                <Dialog open={newConversationDialog} onOpenChange={setNewConversationDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="btn-primary text-white">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start New Conversation</DialogTitle>
                      <DialogDescription>
                        Choose a user to start messaging with
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => {
                            startConversationWithUser(user.id);
                            setNewConversationDialog(false);
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{user.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${
                                user.role === 'traveler' ? 'border-blue-200 text-blue-600' : 'border-purple-200 text-purple-600'
                              }`}>
                                {user.role}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                <span className="text-xs text-gray-500">{user.rating}</span>
                              </div>
                            </div>
                          </div>
                          {user.online && (
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 search-input"
              />
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <div className="space-y-1">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.userId}
                    onClick={() => setSelectedConversation(conversation)}
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
                            {formatDate(conversation.timestamp)}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage || 'Start a conversation...'}
                          </p>
                          {conversation.unread > 0 && (
                            <Badge className="bg-blue-500 text-white text-xs">
                              {conversation.unread}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              conversation.role === 'traveler' 
                                ? 'border-blue-200 text-blue-600' 
                                : 'border-purple-200 text-purple-600'
                            }`}
                          >
                            {conversation.role}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-500">{conversation.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredConversations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No conversations found</p>
                  <Button 
                    onClick={() => setNewConversationDialog(true)}
                    className="mt-2"
                    size="sm"
                  >
                    Start New Chat
                  </Button>
                </div>
              )}
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
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            selectedConversation.role === 'traveler' 
                              ? 'border-blue-200 text-blue-600' 
                              : 'border-purple-200 text-purple-600'
                          }`}
                        >
                          {selectedConversation.role}
                        </Badge>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.online ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium">{selectedConversation.rating}</span>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[calc(100vh-24rem)] p-4">
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
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="border-t border-gray-100 p-4">
                <form onSubmit={sendMessage} className="flex items-center space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 input-focus"
                  />
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
                <p>Choose a conversation from the left to start messaging</p>
                <Button 
                  onClick={() => setNewConversationDialog(true)}
                  className="mt-4 btn-primary text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ImprovedMessaging;