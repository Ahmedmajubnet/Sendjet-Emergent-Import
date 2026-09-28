import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Package, 
  User,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { BackButton } from './BackButton';

const MatchRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get('/matches/requests/pending');
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to load match requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (matchId) => {
    try {
      await axios.put(`/matches/${matchId}/accept`);
      toast.success('Match accepted!');
      
      // If the current user is the sender (shipment owner) in this match, redirect to payment
      const match = requests.find(r => r.match.id === matchId);
      if (match && match.match.sender_id === user.id) {
        toast.info('Redirecting to payment...');
        setTimeout(() => navigate(`/booking/${matchId}/payment`), 1000);
      } else {
        // The shipment owner will be notified to proceed with payment
        toast.success('The shipment owner will be notified to proceed with payment.');
        setRequests(prev => prev.filter(r => r.match.id !== matchId));
      }
    } catch (error) {
      console.error('Failed to accept match:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept match');
    }
  };

  const handleReject = async (matchId) => {
    try {
      await axios.put(`/matches/${matchId}/reject`);
      toast.success('Match request declined');
      setRequests(prev => prev.filter(r => r.match.id !== matchId));
    } catch (error) {
      console.error('Failed to reject match:', error);
      toast.error('Failed to reject match');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      <BackButton fallback="/dashboard" className="mb-4" />
      <Card className="shadow-lg">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Match Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No pending requests</h3>
              <p className="text-gray-500">
                When someone sends you a match request, it will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const { match, shipment, trip, traveler, sender } = request;
                // Show the user who SENT the request (the requester)
                const requesterIsTraverler = match.requested_by === match.traveler_id;
                const otherUser = requesterIsTraverler ? traveler : sender;
                
                return (
                  <Card key={match.id} className="border-2 border-orange-100">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        
                        {/* User Info */}
                        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
                              {otherUser?.full_name}
                            </h3>
                            <Badge className="text-xs mb-2 capitalize">
                              {otherUser?.role}
                            </Badge>
                            
                            <div className="space-y-1.5 mt-2 sm:mt-3">
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <Package className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <span className="break-words">{shipment?.description}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="font-medium flex-shrink-0">From:</span>
                                <span className="break-words">{shipment?.origin?.address}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="font-medium flex-shrink-0">To:</span>
                                <span className="break-words">{shipment?.destination?.address}</span>
                              </div>
                              {trip && (
                                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Journey</div>
                                  <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <span className="font-medium flex-shrink-0">Route:</span>
                                    <span className="break-words">{trip?.origin?.address} → {trip?.destination?.address}</span>
                                  </div>
                                  <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <span className="font-medium flex-shrink-0">Travel:</span>
                                    <span className="capitalize">{trip?.transport_mode || 'Journey'} · {trip?.departure_date ? new Date(trip.departure_date).toLocaleDateString() : ''}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price & Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:flex-shrink-0">
                          <div className="bg-green-50 px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                              <span className="text-xl sm:text-2xl font-bold text-green-600">
                                {match.price_agreed}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 text-center mt-0.5">
                              Offered
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReject(match.id)}
                              variant="outline"
                              className="border-red-200 hover:bg-red-50"
                              data-testid={`reject-match-${match.id}`}
                            >
                              <XCircle className="h-4 w-4 sm:mr-2 text-red-600" />
                              <span className="hidden sm:inline">Decline</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAccept(match.id)}
                              className="bg-green-500 hover:bg-green-600 text-white"
                              data-testid={`accept-match-${match.id}`}
                            >
                              <CheckCircle className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Accept</span>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Info Note */}
                      {match.traveler_id === user.id ? (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            You'll receive <strong>${match.traveler_payout_amount?.toFixed(2)}</strong> after delivery
                            (${match.price_agreed?.toFixed(2)} - ${match.platform_commission_amount?.toFixed(2)} platform fee)
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">
                            Total cost: <strong>${match.price_agreed?.toFixed(2)}</strong> (includes ${match.platform_commission_amount?.toFixed(2)} platform fee)
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchRequests;
