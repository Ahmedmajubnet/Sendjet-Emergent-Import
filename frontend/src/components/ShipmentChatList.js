import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  MessageCircle, 
  Package, 
  Clock, 
  User,
  AlertCircle,
  CheckCircle,
  Truck,
  MapPin,
  Search,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const ShipmentChatList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [chatInfos, setChatInfos] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, active

  useEffect(() => {
    fetchUserShipments();
  }, [user]);

  const fetchUserShipments = async () => {
    try {
      let shipmentsData = [];
      
      if (user.role === 'admin') {
        // Admin can see all shipments
        const [shipmentsRes, tripsRes] = await Promise.all([
          axios.get('/shipments'),
          axios.get('/trips')
        ]);
        shipmentsData = shipmentsRes.data;
      } else if (user.role === 'sender') {
        // Sender sees their own shipments
        const response = await axios.get('/shipments/my');
        shipmentsData = response.data;
      } else if (user.role === 'traveler') {
        // Traveler sees shipments they're matched with
        const [matchesRes, allShipmentsRes] = await Promise.all([
          axios.get('/matches/my'),
          axios.get('/shipments')
        ]);
        
        const matchedShipmentIds = matchesRes.data.map(match => match.shipment_id);
        shipmentsData = allShipmentsRes.data.filter(shipment => 
          matchedShipmentIds.includes(shipment.id)
        );
      }
      
      setShipments(shipmentsData);
      
      // Fetch chat info for each shipment
      const chatInfoPromises = shipmentsData.map(async (shipment) => {
        try {
          const response = await axios.get(`/shipments/${shipment.id}/chat-info`);
          return { [shipment.id]: response.data };
        } catch (error) {
          console.error(`Failed to load chat info for shipment ${shipment.id}:`, error);
          return { [shipment.id]: null };
        }
      });
      
      const chatInfoResults = await Promise.all(chatInfoPromises);
      const chatInfosMap = chatInfoResults.reduce((acc, result) => ({ ...acc, ...result }), {});
      setChatInfos(chatInfosMap);
      
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
      toast.error('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredShipments = () => {
    return shipments.filter(shipment => {
      const chatInfo = chatInfos[shipment.id];
      
      switch (filter) {
        case 'unread':
          return chatInfo && chatInfo.unread_count > 0;
        case 'active':
          return shipment.status === 'in_transit' || shipment.status === 'matched';
        case 'all':
        default:
          return true;
      }
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'matched':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_transit':
        return <Truck className="h-4 w-4" />;
      case 'matched':
        return <User className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const filteredShipments = getFilteredShipments();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Shipment Messages</h1>
          <p className="text-gray-600">
            {user.role === 'admin' 
              ? 'Monitor all shipment conversations'
              : 'Communicate about your shipments'
            }
          </p>
        </div>
        
        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All ({shipments.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            onClick={() => setFilter('unread')}
            size="sm"
          >
            Unread ({Object.values(chatInfos).filter(info => info && info.unread_count > 0).length})
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
            size="sm"
          >
            Active ({shipments.filter(s => s.status === 'in_transit' || s.status === 'matched').length})
          </Button>
        </div>
      </div>

      {/* Shipment Chat List */}
      {filteredShipments.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredShipments.map((shipment) => {
            const chatInfo = chatInfos[shipment.id];
            
            return (
              <Card 
                key={shipment.id} 
                className={`cursor-pointer card-hover ${
                  chatInfo && chatInfo.unread_count > 0 
                    ? 'ring-2 ring-blue-200 bg-blue-50'
                    : ''
                }`}
                onClick={() => navigate(`/shipments/${shipment.id}/chat`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-gradient-to-r from-orange-400 to-pink-400 rounded-lg">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-1">
                          {shipment.description}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(shipment.status)}>
                            {getStatusIcon(shipment.status)}
                            <span className="ml-1 capitalize">{shipment.status}</span>
                          </Badge>
                          {chatInfo && chatInfo.match_status && (
                            <Badge variant="outline" className="text-xs">
                              {chatInfo.match_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {chatInfo && chatInfo.unread_count > 0 && (
                        <Badge className="bg-blue-500 text-white">
                          {chatInfo.unread_count}
                        </Badge>
                      )}
                      <MessageCircle className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Route Info */}
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 text-green-500 mr-1" />
                    <span className="truncate">{shipment.origin.address}</span>
                    <span className="mx-2">→</span>
                    <MapPin className="h-4 w-4 text-red-500 mr-1" />
                    <span className="truncate">{shipment.destination.address}</span>
                  </div>
                  
                  {/* Participants */}
                  {chatInfo && chatInfo.participants.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Participants:</p>
                      <div className="flex items-center gap-2">
                        {chatInfo.participants.map((participant) => (
                          <div key={participant.user_id} className="flex items-center gap-1">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className={`text-xs ${
                                participant.role === 'sender' ? 'bg-blue-100 text-blue-800' :
                                participant.role === 'traveler' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {participant.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">{participant.name}</span>
                              {participant.online && (
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Footer Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>{shipment.weight}kg</span>
                      <span>${shipment.declared_value}</span>
                      <span>Created {formatDate(shipment.created_at)}</span>
                    </div>
                    
                    {user.role === 'admin' && (
                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                        Admin View
                      </Badge>
                    )}
                  </div>
                  
                  {/* Action Button */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Button className="w-full btn-primary text-white" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Open Chat
                      {chatInfo && chatInfo.unread_count > 0 && (
                        <Badge className="ml-2 bg-white text-blue-600">
                          {chatInfo.unread_count}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <MessageCircle className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  No shipment chats found
                </h3>
                <p className="text-gray-600">
                  {filter === 'all' 
                    ? 'You don\'t have any shipments with chat threads yet.'
                    : `No shipments match the "${filter}" filter.`
                  }
                </p>
              </div>
              {filter !== 'all' && (
                <Button
                  variant="outline"
                  onClick={() => setFilter('all')}
                >
                  Show All Shipments
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShipmentChatList;