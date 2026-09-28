import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { openConversationWith } from '../lib/messaging';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Plane,
  Package,
  MapPin,
  Weight,
  DollarSign,
  Star,
  Search,
  Calendar,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { motion } from 'framer-motion';
import { TRANSPORT_MODES, getTransportMode, getCapacitySize, formatTripPrice, TransportModeBadge } from './TransportModeBadge';
import MatchRequestDialog from './MatchRequestDialog';

const cardEntrance = (idx) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: (idx % 6) * 0.06 },
  whileHover: { y: -6 },
});

// Person avatar with the owner's name — falls back to initials on a branded gradient.
const initialsOf = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

const PersonBadge = ({ name, avatar, rating, reviews, role, gradient, testId, onClick }) => {
  const displayName = name || role;
  const hasRating = typeof rating === 'number' && rating > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      title={`View ${displayName}'s profile`}
      className="flex items-center gap-3 w-full text-left rounded-xl -mx-1 px-1 py-1 group/person hover:bg-gray-50 transition-colors"
    >
      {avatar ? (
        <img
          src={avatar}
          alt={displayName}
          className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
        />
      ) : (
        <div className={`w-11 h-11 rounded-full ${gradient} flex items-center justify-center text-white font-semibold text-sm ring-2 ring-white shadow-sm flex-shrink-0`}>
          {initialsOf(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-sm text-gray-900 leading-snug break-words group-hover/person:text-orange-600 transition-colors">{displayName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{role}</span>
          {hasRating ? (
            <span className="flex items-center gap-0.5 text-xs text-gray-600">
              <Star className="h-3 w-3 text-yellow-400 fill-current" />
              {rating.toFixed(1)}
              {typeof reviews === 'number' && reviews > 0 && (
                <span className="text-gray-400">({reviews})</span>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-orange-500 font-medium">New member</span>
          )}
        </div>
      </div>
    </button>
  );
};

const MarketPlace = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [matchContext, setMatchContext] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState('all');

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    try {
      const [tripsRes, shipmentsRes] = await Promise.all([
        axios.get('/trips'),
        axios.get('/shipments')
      ]);

      setTrips(tripsRes.data);
      setShipments(shipmentsRes.data);
    } catch (error) {
      toast.error('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const requireAuth = (action, intentPath, intentAction) => {
    if (!isAuthenticated) {
      toast.info('Please sign in to ' + action);
      // Preserve intent: after auth, land back exactly where the user was.
      const params = new URLSearchParams();
      const next = intentPath || `${window.location.pathname}${window.location.search}`;
      params.set('next', next);
      if (intentAction) params.set('action', intentAction);
      navigate(`/auth?${params.toString()}`);
      return false;
    }
    return true;
  };

  const goToProfile = (userId) => {
    if (!userId) return;
    if (!requireAuth('view profiles', null, 'view-profile')) return;
    navigate(`/profile/${userId}`);
  };

  const handlePayment = async (matchId) => {
    try {
      const response = await axios.post('/payments/checkout', {
        match_id: matchId,
        origin_url: window.location.origin
      });

      window.location.href = response.data.url;
    } catch (error) {
      toast.error('Failed to initiate payment');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const q = searchTerm.toLowerCase();
  const filteredTrips = trips.filter(trip => {
    const matchesSearch =
      (trip.origin?.address || '').toLowerCase().includes(q) ||
      (trip.destination?.address || '').toLowerCase().includes(q) ||
      (trip.description || '').toLowerCase().includes(q);
    const mode = trip.transport_mode || 'plane';
    const matchesTransport = selectedTransport === 'all' || mode === selectedTransport;
    return matchesSearch && matchesTransport;
  });

  const filteredShipments = shipments.filter(shipment =>
    (shipment.origin?.address || '').toLowerCase().includes(q) ||
    (shipment.destination?.address || '').toLowerCase().includes(q) ||
    (shipment.description || '').toLowerCase().includes(q)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-8 fade-in">

      {/* Header */}
      <div className="text-center space-y-2 sm:space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Marketplace</h1>
        <p className="text-sm sm:text-base text-gray-600">
          {!isAuthenticated
            ? 'Browse journeys by plane, car, train or bus — and find shipment requests going your way.'
            : 'Find people already traveling your way or shipments you can carry on your journey.'
          }
        </p>
      </div>

      {/* Search & transport filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by location or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 search-input"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible no-scrollbar" aria-label="Filter trips by transport">
          <button
            type="button"
            onClick={() => setSelectedTransport('all')}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${selectedTransport === 'all' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}
          >
            All transport
          </button>
          {TRANSPORT_MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedTransport(value)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${selectedTransport === value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}
              aria-pressed={selectedTransport === value}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Marketplace Tabs */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto min-h-10">
          <TabsTrigger value="trips" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2 text-xs sm:text-sm whitespace-normal leading-tight">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="sm:hidden">Journeys ({filteredTrips.length})</span>
            <span className="hidden sm:inline">Available Journeys ({filteredTrips.length})</span>
          </TabsTrigger>
          <TabsTrigger value="shipments" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2 text-xs sm:text-sm whitespace-normal leading-tight">
            <Package className="h-4 w-4 flex-shrink-0" />
            <span className="sm:hidden">Shipments ({filteredShipments.length})</span>
            <span className="hidden sm:inline">Shipment Requests ({filteredShipments.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Trips Tab */}
        <TabsContent value="trips" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip, idx) => (
              <motion.div key={trip.id} {...cardEntrance(idx)}>
              <Card className="card-hover overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => goToProfile(trip.traveler_id)}
                        className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 hover:bg-blue-100 hover:scale-105 transition-all cursor-pointer"
                        title="View traveler profile"
                        data-testid={`trip-icon-profile-${trip.id}`}
                      >
                        {React.createElement(getTransportMode(trip.transport_mode).Icon, { className: 'h-5 w-5 text-blue-500' })}
                      </button>
                      Journey Available
                    </CardTitle>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <TransportModeBadge value={trip.transport_mode} />
                    <Badge className="status-active text-white text-xs">
                      {trip.status}
                    </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="font-medium">From:</span>
                      <span className="text-gray-600 truncate">{trip.origin?.address || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-red-500" />
                      <span className="font-medium">To:</span>
                      <span className="text-gray-600 truncate">{trip.destination?.address || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span>{formatDate(trip.departure_date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Weight className="h-3 w-3 text-gray-400" />
                      <span>{trip.available_weight}kg max</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span>{getCapacitySize(trip.capacity_size)?.label || `${trip.available_space}L`}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <span>{formatTripPrice(trip)}</span>
                    </div>
                  </div>

                  {trip.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {trip.description}
                    </p>
                  )}

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <PersonBadge
                      name={trip.traveler_name}
                      avatar={trip.traveler_avatar}
                      rating={trip.traveler_rating}
                      reviews={trip.traveler_reviews}
                      role="Traveler"
                      gradient="bg-gradient-to-br from-blue-400 to-indigo-500"
                      testId={`trip-traveler-${trip.id}`}
                      onClick={() => goToProfile(trip.traveler_id)}
                    />

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`send-message-trip-${trip.id}`}
                        onClick={() => {
                          if (!requireAuth('send messages', null, 'send-message')) return;
                          openConversationWith(trip.traveler_id, navigate);
                        }}
                        title="Send Message"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                      {isAuthenticated && trip.traveler_id !== user?.id ? (
                        <Button
                          size="sm"
                          className="btn-primary text-white"
                          data-testid={`request-match-trip-${trip.id}`}
                          onClick={() => setMatchContext({
                            targetUserId: trip.traveler_id,
                            targetUserName: trip.traveler_name || 'Traveler',
                            initialMode: 'send',
                            preferredTripId: trip.id,
                          })}
                        >
                          Request Match
                        </Button>
                      ) : !isAuthenticated ? (
                        <Button
                          size="sm"
                          className="btn-primary text-white"
                          onClick={() => requireAuth('request a match', null, 'request-match')}
                          data-testid={`request-match-guest-trip-${trip.id}`}
                        >
                          Request Match
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </div>

          {filteredTrips.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No journeys found</h3>
              <p className="text-gray-500">Try adjusting your search terms or check back later.</p>
            </div>
          )}
        </TabsContent>

        {/* Shipments Tab */}
        <TabsContent value="shipments" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShipments.map((shipment, idx) => (
              <motion.div key={shipment.id} {...cardEntrance(idx)}>
              <Card className="card-hover overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => goToProfile(shipment.sender_id)}
                        className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 hover:bg-purple-100 hover:scale-105 transition-all cursor-pointer"
                        title="View sender profile"
                        data-testid={`shipment-icon-profile-${shipment.id}`}
                      >
                        <Package className="h-5 w-5 text-purple-500" />
                      </button>
                      Shipment Request
                    </CardTitle>
                    <Badge className="status-pending text-white text-xs">
                      {shipment.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">From:</span>
                      <span className="text-gray-600 truncate">{shipment.origin?.address || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-red-500" />
                      <span className="font-medium">To:</span>
                      <span className="text-gray-600 truncate">{shipment.destination?.address || '—'}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Package Details:</p>
                    <p className="text-sm text-gray-600">{shipment.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span>{formatDate(shipment.pickup_date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Weight className="h-3 w-3 text-gray-400" />
                      <span>{shipment.weight}kg</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span>
                        {shipment.dimensions.length}×{shipment.dimensions.width}×{shipment.dimensions.height} cm
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <span>${shipment.declared_value}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <PersonBadge
                      name={shipment.sender_name}
                      avatar={shipment.sender_avatar}
                      rating={shipment.sender_rating}
                      reviews={shipment.sender_reviews}
                      role="Sender"
                      gradient="bg-gradient-to-br from-purple-400 to-pink-500"
                      testId={`shipment-sender-${shipment.id}`}
                      onClick={() => goToProfile(shipment.sender_id)}
                    />

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`view-shipment-details-${shipment.id}`}
                        onClick={() => navigate(`/shipment/${shipment.id}`)}
                        title="View shipment details"
                      >
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`send-message-shipment-${shipment.id}`}
                        onClick={() => {
                          if (!requireAuth('send messages', null, 'send-message')) return;
                          openConversationWith(shipment.sender_id, navigate);
                        }}
                        title="Send Message"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                      {isAuthenticated && shipment.sender_id !== user?.id ? (
                        <Button
                          size="sm"
                          className="btn-primary text-white"
                          data-testid={`offer-carry-${shipment.id}`}
                          onClick={() => setMatchContext({
                            targetUserId: shipment.sender_id,
                            targetUserName: shipment.sender_name || 'Sender',
                            initialMode: 'carry',
                            preferredShipmentId: shipment.id,
                          })}
                        >
                          Offer to Carry
                        </Button>
                      ) : !isAuthenticated ? (
                        <Button
                          size="sm"
                          className="btn-primary text-white"
                          onClick={() => requireAuth('make an offer', null, 'make-offer')}
                          data-testid={`offer-carry-guest-${shipment.id}`}
                        >
                          Offer to Carry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </div>

          {filteredShipments.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No shipments found</h3>
              <p className="text-gray-500">Try adjusting your search terms or check back later.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {matchContext && (
        <MatchRequestDialog
          open={!!matchContext}
          onOpenChange={(open) => { if (!open) setMatchContext(null); }}
          targetUserId={matchContext.targetUserId}
          targetUserName={matchContext.targetUserName}
          initialMode={matchContext.initialMode}
          preferredTripId={matchContext.preferredTripId}
          preferredShipmentId={matchContext.preferredShipmentId}
        />
      )}
    </div>
  );
};

export default MarketPlace;