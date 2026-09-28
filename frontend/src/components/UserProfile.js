import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  User, 
  Star, 
  MapPin, 
  Calendar, 
  Package, 
  Plane, 
  MessageCircle,
  Shield,
  Clock,
  Award,
  CheckCircle,
  Handshake,
  Camera,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { openConversationWith } from '../lib/messaging';
import { BackButton } from './BackButton';
import { getCapacitySize, formatTripPrice, TransportModeBadge } from './TransportModeBadge';
import MatchRequestDialog from './MatchRequestDialog';

const resizeAvatar = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    try {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const sourceSize = Math.min(image.width, image.height);
      const sx = (image.width - sourceSize) / 2;
      const sy = (image.height - sourceSize) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    }
  };
  image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
  image.src = objectUrl;
});

const UserProfile = () => {
  const { userId } = useParams();
  const { user: currentUser, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState(null);
  const [userTrips, setUserTrips] = useState([]);
  const [userShipments, setUserShipments] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [matchOpen, setMatchOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [deleteStatusLoading, setDeleteStatusLoading] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [userStats, setUserStats] = useState({
    totalTrips: 0,
    totalShipments: 0,
    completedDeliveries: 0,
    successRate: 0
  });

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      // Fetch user data and their activity from the API
      const [userRes, tripsRes, shipmentsRes, reviewsRes] = await Promise.all([
        axios.get(`/users/${userId}`),
        axios.get('/trips').catch(() => ({ data: [] })),
        axios.get('/shipments').catch(() => ({ data: [] })),
        axios.get(`/reviews/${userId}`).catch(() => ({ data: [] }))
      ]);

      const userData = userRes.data;
      
      // Filter trips and shipments for this user
      const trips = tripsRes.data.filter(trip => trip.traveler_id === userId);
      const shipments = shipmentsRes.data.filter(shipment => shipment.sender_id === userId);
      
      setUserTrips(trips);
      setUserShipments(shipments);
      setUserReviews(reviewsRes.data);

      // Calculate stats
      const totalTrips = trips.length;
      const totalShipments = shipments.length;
      const completedDeliveries = trips.filter(t => t.status === 'completed').length + 
                                 shipments.filter(s => s.status === 'delivered').length;
      const successRate = (totalTrips + totalShipments) > 0 ? 
                         (completedDeliveries / (totalTrips + totalShipments)) * 100 : 0;

      setUserStats({
        totalTrips,
        totalShipments,
        completedDeliveries,
        successRate
      });

      setProfileUser(userData);

    } catch (error) {
      console.error('Failed to load user profile:', error);
      toast.error('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    openConversationWith(userId, navigate);
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Please choose an image smaller than 8 MB');
      return;
    }
    setAvatarUploading(true);
    try {
      const avatar = await resizeAvatar(file);
      const response = await axios.put('/users/me/avatar', { avatar });
      setProfileUser(response.data);
      try { await refreshUser?.(); } catch (_) {}
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update profile photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      const response = await axios.delete('/users/me/avatar');
      setProfileUser(response.data);
      try { await refreshUser?.(); } catch (_) {}
      toast.success('Profile photo removed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not remove profile photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const openDeleteAccount = async () => {
    setDeleteOpen(true);
    setDeleteStatus(null);
    setDeleteEmail('');
    setDeletePassword('');
    setDeleteStatusLoading(true);
    try {
      const response = await axios.get('/users/me/deletion-status');
      setDeleteStatus(response.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : detail?.message || 'Could not check account deletion status');
    } finally {
      setDeleteStatusLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser?.email || deleteEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
      toast.error('Enter your account email exactly to confirm deletion');
      return;
    }
    if (deleteStatus?.requires_password && !deletePassword) {
      toast.error('Enter your current password');
      return;
    }

    setDeletingAccount(true);
    try {
      await axios.delete('/users/me', {
        data: {
          confirm_email: deleteEmail.trim(),
          current_password: deleteStatus?.requires_password ? deletePassword : null
        }
      });
      setDeleteOpen(false);
      logout();
      navigate('/', { replace: true });
      toast.success('Your SendJet account has been deleted');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : detail?.message || 'Could not delete account');
      if (error.response?.status === 409) {
        try {
          const response = await axios.get('/users/me/deletion-status');
          setDeleteStatus(response.data);
        } catch (_) {}
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="text-center">
          <CardContent className="p-4 sm:p-8">
            <User className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-gray-600">The user profile you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/marketplace')} className="mt-4">
              Back to Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8 fade-in">
      <BackButton fallback="/marketplace" />
      
      {/* Profile Header */}
      <Card className="shadow-strong">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 sm:gap-6">
            
            {/* Avatar and Basic Info */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-6 min-w-0 w-full md:w-auto">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center overflow-hidden ring-4 ring-white shadow-md">
                  {profileUser.avatar ? (
                    <img src={profileUser.avatar} alt={`${profileUser.full_name} profile`} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                  )}
                </div>
                {currentUser?.id === userId && (
                  <>
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} className="hidden" />
                    <button type="button" disabled={avatarUploading} onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-slate-900 text-white border-2 border-white shadow flex items-center justify-center hover:bg-slate-800 disabled:opacity-60" aria-label="Change profile photo">
                      {avatarUploading ? <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
                {profileUser.is_verified && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 break-words">{profileUser.full_name}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                  <Badge className="bg-orange-50 text-orange-800 border border-orange-100">
                    {profileUser.role === 'admin' ? 'SendJet Admin' : 'SendJet Member'}
                  </Badge>
                  {profileUser.is_verified && (
                    <Badge className="bg-green-100 text-green-800">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="flex items-center">
                    {renderStars(profileUser.rating)}
                  </div>
                  <span className="font-semibold text-gray-800">{profileUser.rating}</span>
                  <span className="text-gray-500">({profileUser.total_reviews} reviews)</span>
                </div>
                
                <p className="text-gray-600 text-sm mb-3">
                  Member since {formatDate(profileUser.created_at)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:ml-auto w-full md:w-auto">
              {currentUser?.id !== userId && (
                <>
                  <Button 
                    onClick={handleSendMessage}
                    data-testid="profile-send-message"
                    className="w-full sm:w-auto btn-primary text-white px-6"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMatchOpen(true)}
                    data-testid="profile-request-match"
                    className="w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <Handshake className="h-4 w-4 mr-2" />
                    Request Match
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Award className="h-4 w-4 mr-2" />
                    Report User
                  </Button>
                </>
              )}
              {currentUser?.id === userId && (
                <div className="flex flex-col sm:flex-row md:flex-col gap-2">
                  <Button variant="outline" disabled={avatarUploading} onClick={() => avatarInputRef.current?.click()} className="w-full sm:w-auto">
                    <Camera className="h-4 w-4 mr-2" />
                    {profileUser.avatar ? 'Change photo' : 'Add profile photo'}
                  </Button>
                  {profileUser.avatar && (
                    <Button variant="ghost" disabled={avatarUploading} onClick={handleRemoveAvatar} className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove photo
                    </Button>
                  )}
                  <p className="text-xs text-gray-400 max-w-[230px]">A clear profile photo helps other members recognize who they are dealing with.</p>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profileUser.bio && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">About</h3>
              <p className="text-gray-700">{profileUser.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
            <Plane className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.totalTrips}</div>
            <p className="text-xs text-gray-500">Posted by user</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.totalShipments}</div>
            <p className="text-xs text-gray-500">Requested by user</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.completedDeliveries}</div>
            <p className="text-xs text-gray-500">Successful deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Award className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-gray-500">Completion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Profile Tabs */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto min-h-10">
          <TabsTrigger value="trips" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2"><span className="sm:hidden">Journeys</span><span className="hidden sm:inline">Recent Journeys</span></TabsTrigger>
          <TabsTrigger value="shipments" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2">Shipments</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Journeys</CardTitle>
              <CardDescription>Latest routes offered by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {userTrips.length > 0 ? (
                <div className="space-y-4">
                  {userTrips.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{trip.origin?.address}</span>
                            <span className="text-gray-400">→</span>
                            <MapPin className="h-4 w-4 text-red-500" />
                            <span className="font-medium">{trip.destination?.address}</span>
                          </div>
                          <div className="mb-2"><TransportModeBadge value={trip.transport_mode} /></div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(trip.departure_date)}
                            </span>
                            <span>{trip.available_weight}kg max</span>
                            <span>{getCapacitySize(trip.capacity_size)?.label || `${trip.available_space}L`}</span>
                            <span>{formatTripPrice(trip)}</span>
                          </div>
                        </div>
                        <Badge className={`${trip.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {trip.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Plane className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No journeys posted yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Shipments</CardTitle>
              <CardDescription>Latest packages requested by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {userShipments.length > 0 ? (
                <div className="space-y-4">
                  {userShipments.map((shipment) => (
                    <div key={shipment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">{shipment.description}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">{shipment.origin?.address}</span>
                            <span className="text-gray-400">→</span>
                            <MapPin className="h-4 w-4 text-red-500" />
                            <span className="text-sm">{shipment.destination?.address}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                            <span>{shipment.weight}kg</span>
                            <span>${shipment.declared_value}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(shipment.pickup_date)}
                            </span>
                          </div>
                        </div>
                        <Badge className={`${shipment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {shipment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No shipments requested yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Reviews</CardTitle>
              <CardDescription>What other users say about this person</CardDescription>
            </CardHeader>
            <CardContent>
              {userReviews.length > 0 ? (
                <div className="space-y-4">
                  {userReviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-4" data-testid={`review-${review.id}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{review.reviewer_name}</p>
                            <p className="text-xs text-gray-500 capitalize">{review.reviewer_role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex">{renderStars(review.rating)}</div>
                          <span className="text-xs text-gray-400">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 text-sm">"{review.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No reviews yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {currentUser?.id === userId && currentUser?.role !== 'admin' && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Permanently delete your SendJet account when you no longer want to use the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600 max-w-2xl">
              Your profile, open listings, pending requests and personal messaging data will be removed.
              Active deliveries or payment-related matches must be completed or cancelled first.
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={openDeleteAccount}
              className="w-full sm:w-auto shrink-0"
              data-testid="delete-account-button"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete account
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => !deletingAccount && setDeleteOpen(open)}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete your SendJet account?</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteStatusLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Checking your account…</div>
          ) : deleteStatus && !deleteStatus.can_delete ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold mb-1">Account deletion is temporarily unavailable.</p>
                <p>{deleteStatus.message}</p>
                {(deleteStatus.blockers?.active_matches > 0 || deleteStatus.blockers?.active_shipments > 0) && (
                  <div className="mt-3 text-xs space-y-1">
                    {deleteStatus.blockers?.active_matches > 0 && <p>Active matches: {deleteStatus.blockers.active_matches}</p>}
                    {deleteStatus.blockers?.active_shipments > 0 && <p>Active shipments: {deleteStatus.blockers.active_shipments}</p>}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          ) : deleteStatus?.can_delete ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-900 space-y-2">
                <p className="font-semibold">What will happen</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your profile and profile photo will be removed.</li>
                  <li>Open journeys, shipments and pending match requests will be removed.</li>
                  <li>Your direct-message conversations and personal notifications will be removed.</li>
                  <li>Historical payment records may remain only in anonymized form for platform records.</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your email to confirm
                </label>
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder={currentUser?.email || 'you@example.com'}
                  autoComplete="email"
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                />
              </div>

              {deleteStatus.requires_password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full h-10 rounded-md border border-gray-300 px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                  />
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" disabled={deletingAccount} onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={
                    deletingAccount ||
                    deleteEmail.trim().toLowerCase() !== (currentUser?.email || '').toLowerCase() ||
                    (deleteStatus.requires_password && !deletePassword)
                  }
                  onClick={handleDeleteAccount}
                  data-testid="confirm-delete-account"
                >
                  {deletingAccount ? 'Deleting…' : 'Permanently delete account'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4 text-sm text-gray-500">Could not load account deletion status. Close and try again.</div>
          )}
        </DialogContent>
      </Dialog>

      <MatchRequestDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        targetUserId={profileUser?.id}
        targetUserName={profileUser?.full_name}
      />
    </div>
  );
};

export default UserProfile;