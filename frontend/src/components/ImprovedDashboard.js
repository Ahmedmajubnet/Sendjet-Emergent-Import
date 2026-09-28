import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Package, 
  Plane, 
  TrendingUp, 
  MessageCircle, 
  Star,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Upload,
  IdCard
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ReviewDialog from './ReviewDialog';
import { activeMatchStatuses, shipmentMatch, shipmentStatusLabel } from '../lib/matchLifecycle';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { getTransportMode, formatTripPrice, TransportModeBadge } from './TransportModeBadge';

const ImprovedDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalShipments: 0,
    totalTrips: 0,
    activeMatches: 0,
    completedDeliveries: 0,
    totalValue: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [myShipments, setMyShipments] = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [reviewDialog, setReviewDialog] = useState({ open: false, matchId: null, otherUser: null, shipmentDesc: '' });
  const [idUploading, setIdUploading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [shipmentsRes, tripsRes, matchesRes, pendingRevRes] = await Promise.all([
        axios.get('/shipments/my').catch(() => ({ data: [] })),
        axios.get('/trips/my').catch(() => ({ data: [] })),
        axios.get('/matches/my').catch(() => ({ data: [] })),
        axios.get('/reviews/pending/me').catch(() => ({ data: [] }))
      ]);

      const shipments = shipmentsRes.data;
      const trips = tripsRes.data;
      const matches = matchesRes.data;

      setMyShipments(shipments);
      setMyTrips(trips);
      setMyMatches(matches);

      // Calculate stats
      const completedShipments = shipments.filter(s => s.status === 'delivered').length;
      const completedTrips = trips.filter(t => t.status === 'completed').length;
      const totalValue = shipments.reduce((sum, s) => sum + (s.declared_value || 0), 0);

      setStats({
        totalShipments: shipments.length,
        totalTrips: trips.length,
        activeMatches: matches.filter(m => activeMatchStatuses.includes(m.status)).length,
        completedDeliveries: completedShipments + completedTrips,
        totalValue
      });

      // Build recent activity
      const activities = [];
      
      shipments.slice(0, 3).forEach(shipment => {
        activities.push({
          id: shipment.id,
          type: 'shipment',
          title: shipment.description,
          status: shipment.status,
          statusLabel: shipmentStatusLabel(shipment, shipmentMatch(matches, shipment.id)),
          time: shipment.created_at,
          link: `/shipment/${shipment.id}`
        });
      });

      trips.slice(0, 3).forEach(trip => {
        activities.push({
          id: trip.id,
          type: 'trip',
          title: `${trip.origin.address} → ${trip.destination.address}`,
          status: trip.status,
          time: trip.created_at,
          link: `/marketplace`
        });
      });

      // Sort by time
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      setRecentActivity(activities.slice(0, 5));
      setPendingReviews(pendingRevRes.data || []);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShipment = async (shipmentId) => {
    try {
      await axios.delete(`/shipments/${shipmentId}`);
      toast.success('Shipment deleted successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete shipment');
    }
  };

  const handleDeleteTrip = async (tripId) => {
    try {
      await axios.delete(`/trips/${tripId}`);
      toast.success('Trip deleted successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete trip');
    }
  };

  const handleIdUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }
    setIdUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await axios.post('/users/upload-id', { id_document: reader.result });
          toast.success('ID document uploaded successfully! Awaiting admin review.');
          window.location.reload();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to upload ID');
        } finally {
          setIdUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIdUploading(false);
      toast.error('Failed to read file');
    }
  };



  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      matched: 'bg-blue-100 text-blue-800',
      picked_up: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const statCards = [
    {
      title: 'Shipments',
      value: stats.totalShipments,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Trips',
      value: stats.totalTrips,
      icon: Plane,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Active',
      value: stats.activeMatches,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Completed',
      value: stats.completedDeliveries,
      icon: TrendingUp,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8 border border-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-1 sm:mb-2">
                Welcome back, {user?.full_name?.split(' ')[0]}!
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Here's what's happening with your listings today
              </p>
            </div>
            <div className="hidden md:block">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center shadow-lg">
                <Plane className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        {user?.role !== 'admin' && ['id_requested', 'id_submitted', 'rejected'].includes(user?.verification_status) && (
          <Card className={`border-2 ${
            user?.verification_status === 'rejected' ? 'border-red-300 bg-red-50' :
            user?.verification_status === 'id_requested' ? 'border-blue-300 bg-blue-50' :
            user?.verification_status === 'id_submitted' ? 'border-orange-300 bg-orange-50' :
            'border-amber-300 bg-amber-50'
          }`} data-testid="verification-banner">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  user?.verification_status === 'rejected' ? 'bg-red-100' :
                  user?.verification_status === 'id_requested' ? 'bg-blue-100' :
                  user?.verification_status === 'id_submitted' ? 'bg-orange-100' :
                  'bg-amber-100'
                }`}>
                  {user?.verification_status === 'rejected' ? (
                    <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  ) : user?.verification_status === 'id_submitted' ? (
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  ) : user?.verification_status === 'id_requested' ? (
                    <IdCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-base sm:text-lg ${
                    user?.verification_status === 'rejected' ? 'text-red-800' :
                    user?.verification_status === 'id_requested' ? 'text-blue-800' :
                    user?.verification_status === 'id_submitted' ? 'text-orange-800' :
                    'text-amber-800'
                  }`}>
                    {user?.verification_status === 'rejected' ? 'Account Verification Rejected' :
                     user?.verification_status === 'id_requested' ? 'ID Verification Required' :
                     user?.verification_status === 'id_submitted' ? 'ID Under Review' :
                     'Get verified for faster matches'}
                  </h3>
                  <p className="text-sm text-gray-700 mt-1">
                    {user?.verification_status === 'rejected' 
                      ? (user?.admin_note || 'Your verification was rejected. Please re-upload your ID.')
                      : user?.verification_status === 'id_requested'
                      ? (user?.admin_note || 'Please upload a valid government-issued ID to verify your identity.')
                      : user?.verification_status === 'id_submitted'
                      ? 'Your ID document has been submitted and is being reviewed by our admin team.'
                      : 'Post trips and packages freely. Verification is only required before your first paid match — it takes 30 seconds and unlocks faster matching.'
                    }
                  </p>
                  {['id_requested', 'rejected'].includes(user?.verification_status) && (
                    <div className="mt-3">
                      <label className="cursor-pointer inline-block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleIdUpload}
                          className="hidden"
                          data-testid="id-upload-input"
                        />
                        <Button asChild disabled={idUploading} className="btn-primary text-white">
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            {idUploading ? 'Uploading...' : 'Upload ID Document'}
                          </span>
                        </Button>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Accepted: Passport, National ID, Driver's License (max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {user?.verification_status === 'verified' && user?.role !== 'admin' && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-2 border border-green-200 text-sm">
            <ShieldCheck className="h-4 w-4" />
            <span>Your account is verified</span>
          </div>
        )}

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-semibold">My Requests / Matches</p><p className="text-sm text-gray-600">Resume requests, messages, payments, and deliveries.</p></div>
            <Button onClick={() => navigate('/match-requests')}>Open my requests ({stats.activeMatches})</Button>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className={`${stat.bgColor} border-none shadow-lg hover:shadow-xl transition-shadow`}>
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{stat.title}</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pending Reviews Banner */}
        {pendingReviews.length > 0 && (
          <Card className="shadow-lg border-yellow-200 bg-yellow-50" data-testid="pending-reviews-section">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-gray-800 text-lg">
                <Star className="h-5 w-5 text-yellow-500" />
                Rate Your Deliveries ({pendingReviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingReviews.map((item) => (
                  <div key={item.match.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.shipment?.description?.slice(0, 40)}</p>
                        <p className="text-xs text-gray-500">
                          with {item.other_user?.full_name} ({item.other_user?.role})
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      data-testid={`review-btn-${item.match.id}`}
                      onClick={() => setReviewDialog({
                        open: true,
                        matchId: item.match.id,
                        otherUser: item.other_user,
                        shipmentDesc: item.shipment?.description || ''
                      })}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Leave Review
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <ReviewDialog
          open={reviewDialog.open}
          onOpenChange={(open) => setReviewDialog(prev => ({ ...prev, open }))}
          matchId={reviewDialog.matchId}
          otherUser={reviewDialog.otherUser}
          shipmentDesc={reviewDialog.shipmentDesc}
          onReviewSubmitted={fetchDashboardData}
        />

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Actions */}
          <Card className="lg:col-span-1 shadow-lg border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Plus className="h-5 w-5 text-orange-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAdmin && (
                <>
                  <Button
                    onClick={() => navigate('/create-shipment')}
                    className="w-full btn-primary text-white justify-start h-12"
                    data-testid="quick-create-shipment-btn"
                  >
                    <Package className="h-5 w-5 mr-2" />
                    Post a Shipment
                  </Button>
                  <Button
                    onClick={() => navigate('/create-trip')}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white justify-start h-12"
                    data-testid="quick-create-trip-btn"
                  >
                    <Plane className="h-5 w-5 mr-2" />
                    Post a Trip
                  </Button>
                </>
              )}
              <Button
                onClick={() => navigate('/marketplace')}
                variant="outline"
                className="w-full justify-start h-12 border-orange-200 hover:bg-orange-50"
              >
                <MapPin className="h-5 w-5 mr-2 text-orange-500" />
                Browse Marketplace
              </Button>
              <Button
                onClick={() => navigate('/direct-messages')}
                variant="outline"
                className="w-full justify-start h-12 border-orange-200 hover:bg-orange-50"
              >
                <MessageCircle className="h-5 w-5 mr-2 text-orange-500" />
                View Messages
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 shadow-lg border-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Clock className="h-5 w-5 text-orange-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      onClick={() => navigate(activity.link)}
                      className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 hover:bg-orange-50 cursor-pointer transition-colors border border-gray-100"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.type === 'shipment' ? 'bg-blue-100' : 'bg-purple-100'
                      }`}>
                        {activity.type === 'shipment' ? (
                          <Package className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Plane className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.time).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(activity.status)} text-xs`}>
                        {activity.statusLabel || getStatusLabel(activity.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No recent activity</p>
                  <Button
                    onClick={() => navigate('/create-shipment')}
                    className="mt-4 btn-primary text-white"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My Listings - Shipments AND Trips with Delete */}
        {(myShipments.length > 0 || myTrips.length > 0) && (
          <Card className="shadow-lg border-orange-100" data-testid="my-listings-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Package className="h-5 w-5 text-orange-500" /> My Listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myShipments.length > 0 && (
                  <h4 className="text-sm font-semibold text-gray-500 mt-1">Shipments ({myShipments.length})</h4>
                )}
                {myShipments.map((shipment) => (
                  <div key={shipment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100" data-testid={`listing-shipment-${shipment.id}`}>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{shipment.description}</p>
                        <p className="text-xs text-gray-500 truncate">{shipment.origin.address} → {shipment.destination.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <Badge className={`${getStatusColor(shipment.status)} text-xs whitespace-nowrap`}>
                        {shipmentStatusLabel(shipment, shipmentMatch(myMatches, shipment.id))}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-shipment-${shipment.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Shipment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{shipment.description}" and cancel any pending match requests. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteShipment(shipment.id)}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {myTrips.length > 0 && (
                  <h4 className="text-sm font-semibold text-gray-500 mt-3">Trips ({myTrips.length})</h4>
                )}
                {myTrips.map((trip) => (
                  <div key={trip.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100" data-testid={`listing-trip-${trip.id}`}>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {React.createElement(getTransportMode(trip.transport_mode).Icon, { className: 'h-4 w-4 sm:h-5 sm:w-5 text-purple-600' })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.origin.address} → {trip.destination.address}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {new Date(trip.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}{trip.available_weight}kg · {formatTripPrice(trip)}
                        </p>
                        <div className="mt-1"><TransportModeBadge value={trip.transport_mode} /></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <Badge className={`${getStatusColor(trip.status)} text-xs whitespace-nowrap`}>
                        {getStatusLabel(trip.status)}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-trip-${trip.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Trip?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the trip from {trip.origin.address} to {trip.destination.address} and cancel any pending match requests. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};

export default ImprovedDashboard;
