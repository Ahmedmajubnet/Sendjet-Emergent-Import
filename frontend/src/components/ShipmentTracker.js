import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Package,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  Truck,
  Plane,
  AlertCircle,
  Eye,
  MessageCircle,
  Navigation,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import GoogleMapsIntegration from './GoogleMapsIntegration';

const ShipmentTracker = () => {
  const { shipmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingPermission, setTrackingPermission] = useState(false);
  const [liveTrackingActive, setLiveTrackingActive] = useState(false);

  const TRACKING_STATUSES = [
    {
      key: 'shipment_created',
      label: 'Shipment Created',
      icon: <Package className="h-5 w-5" />,
      description: 'Shipment request has been posted',
      color: 'text-blue-500'
    },
    {
      key: 'picked_up',
      label: 'Package Picked Up',
      icon: <CheckCircle className="h-5 w-5" />,
      description: 'Traveler has collected the package',
      color: 'text-green-500'
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      icon: <Truck className="h-5 w-5" />,
      description: 'Package is on the way',
      color: 'text-orange-500'
    },
    {
      key: 'at_origin_airport',
      label: 'Ready to Depart',
      icon: <Plane className="h-5 w-5" />,
      description: 'Package is ready to begin the journey',
      color: 'text-purple-500'
    },
    {
      key: 'departed_origin',
      label: 'Departed Origin',
      icon: <Plane className="h-5 w-5" />,
      description: 'The journey has started from the origin',
      color: 'text-blue-600'
    },
    {
      key: 'arrived_destination_airport',
      label: 'Arrived at Destination',
      icon: <Plane className="h-5 w-5" />,
      description: 'Package has reached the destination area',
      color: 'text-indigo-500'
    },
    {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      icon: <Truck className="h-5 w-5" />,
      description: 'Package is out for final delivery',
      color: 'text-yellow-600'
    },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: <CheckCircle className="h-5 w-5" />,
      description: 'Package has been successfully delivered',
      color: 'text-green-600'
    }
  ];

  useEffect(() => {
    if (shipmentId) {
      fetchTrackingData();
    }
  }, [shipmentId]);

  const fetchTrackingData = async () => {
    try {
      const [shipmentRes, trackingRes, locationRes] = await Promise.all([
        axios.get(`/shipments/${shipmentId}`).catch(() => ({ data: null })),
        axios.get(`/shipments/${shipmentId}/tracking`),
        axios.get(`/shipments/${shipmentId}/location/current`)
      ]);

      if (!shipmentRes.data) {
        // Get shipment from general API
        const allShipments = await axios.get('/shipments');
        const shipmentData = allShipments.data.find(s => s.id === shipmentId);
        setShipment(shipmentData);
      } else {
        setShipment(shipmentRes.data);
      }
      
      setMilestones(trackingRes.data);
      
      if (locationRes.data.has_location) {
        setCurrentLocation(locationRes.data.location.location);
        
        // Fetch location history
        const historyRes = await axios.get(`/shipments/${shipmentId}/location/history`);
        setLocationHistory(historyRes.data);
      }
      
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have access to this shipment');
        navigate('/dashboard');
      } else {
        toast.error('Failed to load tracking data');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status, notes = '') => {
    try {
      await axios.post(`/shipments/${shipmentId}/tracking`, {
        status,
        notes,
        location: getCurrentPosition()
      });
      
      toast.success('Status updated successfully! 📦');
      fetchTrackingData();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        resolve(null);
      }
    });
  };

  const toggleLiveTracking = async () => {
    try {
      const response = await axios.post(`/shipments/${shipmentId}/location/toggle`);
      setLiveTrackingActive(response.data.sharing);
      
      if (response.data.sharing) {
        startLocationSharing();
        toast.success('🛰️ Live tracking started');
      } else {
        stopLocationSharing();
        toast.info('📍 Live tracking stopped');
      }
      
    } catch (error) {
      toast.error('Failed to toggle location sharing');
    }
  };

  const startLocationSharing = () => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: new Date().toISOString()
          };
          
          try {
            await axios.post(`/shipments/${shipmentId}/location`, { location });
            setCurrentLocation(location);
          } catch (error) {
            console.error('Failed to update location:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Failed to get location');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
      
      // Store watch ID for cleanup
      setTrackingPermission(watchId);
    }
  };

  const stopLocationSharing = () => {
    if (trackingPermission && typeof trackingPermission === 'number') {
      navigator.geolocation.clearWatch(trackingPermission);
      setTrackingPermission(false);
    }
  };

  const getStatusIndex = (status) => {
    return TRACKING_STATUSES.findIndex(s => s.key === status);
  };

  const getCurrentStatusIndex = () => {
    if (milestones.length === 0) return 0;
    const latestMilestone = milestones[milestones.length - 1];
    return getStatusIndex(latestMilestone.status);
  };

  const calculateProgress = () => {
    const currentIndex = getCurrentStatusIndex();
    return ((currentIndex + 1) / TRACKING_STATUSES.length) * 100;
  };

  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isMilestoneCompleted = (statusKey) => {
    return milestones.some(milestone => milestone.status === statusKey);
  };

  const getMilestoneTime = (statusKey) => {
    const milestone = milestones.find(m => m.status === statusKey);
    return milestone ? formatDateTime(milestone.timestamp) : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-semibold mb-2">Shipment Not Found</h2>
            <p className="text-gray-600">This shipment doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 fade-in">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
          <Package className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Shipment Tracking</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Track your package in real-time from pickup to delivery
        </p>
      </div>

      {/* Shipment Info */}
      <Card className="shadow-strong">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{shipment.description}</CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>{shipment.origin.address}</span>
                </div>
                <span className="text-gray-400">→</span>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span>{shipment.destination.address}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <Badge className={`mb-2 ${
                shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                shipment.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {shipment.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <div className="text-sm text-gray-600">
                <div>Weight: {shipment.weight}kg</div>
                <div>Value: ${shipment.declared_value}</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Delivery Progress</h3>
            <span className="text-2xl font-bold text-orange-600">
              {Math.round(calculateProgress())}% Complete
            </span>
          </div>
          <Progress value={calculateProgress()} className="h-3 mb-6" />
          
          <div className="text-center text-sm text-gray-600">
            {getCurrentStatusIndex() < TRACKING_STATUSES.length - 1 ? (
              <span>Next: {TRACKING_STATUSES[getCurrentStatusIndex() + 1]?.label}</span>
            ) : (
              <span className="text-green-600 font-medium">🎉 Delivery Complete!</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestone Timeline */}
      <Card className="shadow-strong">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Tracking Timeline
          </CardTitle>
          <CardDescription>
            Detailed milestone tracking for your shipment
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {TRACKING_STATUSES.map((status, index) => {
              const isCompleted = isMilestoneCompleted(status.key);
              const isCurrent = getCurrentStatusIndex() === index;
              const milestoneTime = getMilestoneTime(status.key);
              
              return (
                <div key={status.key} className={`flex items-start space-x-4 ${
                  isCompleted ? 'opacity-100' : 
                  isCurrent ? 'opacity-100' : 'opacity-50'
                }`}>
                  
                  {/* Status Icon */}
                  <div className={`relative flex-shrink-0 ${
                    isCompleted ? 'text-green-500' :
                    isCurrent ? status.color :
                    'text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                    ) : isCurrent ? (
                      <div className={`w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center animate-pulse`}>
                        {status.icon}
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Circle className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Connector Line */}
                    {index < TRACKING_STATUSES.length - 1 && (
                      <div className={`absolute top-12 left-1/2 w-0.5 h-6 transform -translate-x-1/2 ${
                        isCompleted ? 'bg-green-300' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                  
                  {/* Status Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`font-semibold ${
                          isCompleted ? 'text-green-700' :
                          isCurrent ? 'text-orange-700' :
                          'text-gray-500'
                        }`}>
                          {status.label}
                        </h4>
                        <p className={`text-sm ${
                          isCompleted ? 'text-green-600' :
                          isCurrent ? 'text-orange-600' :
                          'text-gray-400'
                        }`}>
                          {status.description}
                        </p>
                      </div>
                      
                      {milestoneTime && (
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            ✅ {milestoneTime}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    {/* Status Update Controls for Traveler */}
                    {user.role === 'traveler' && isCurrent && !isCompleted && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={() => updateStatus(status.key, `Status updated by ${user.full_name}`)}
                          className="btn-primary text-white"
                        >
                          Mark as {status.label}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live Tracking Section */}
      {(user.role === 'traveler' || user.role === 'sender' || user.role === 'admin') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Live Location Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-purple-500" />
                Live Location Tracking
              </CardTitle>
              <CardDescription>
                {user.role === 'traveler' 
                  ? 'Share your live location during delivery'
                  : 'View traveler\'s live location (if shared)'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {user.role === 'traveler' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Location Sharing</span>
                    <Badge className={liveTrackingActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {liveTrackingActive ? '🛰️ Active' : '📍 Inactive'}
                    </Badge>
                  </div>
                  
                  <Button
                    onClick={toggleLiveTracking}
                    className={`w-full ${
                      liveTrackingActive 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'btn-primary text-white'
                    }`}
                  >
                    {liveTrackingActive ? 'Stop Sharing Location' : 'Start Sharing Location'}
                  </Button>
                  
                  <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                    <p className="font-medium mb-1">Privacy Notice:</p>
                    <p>Your location is only shared during active deliveries and is automatically disabled when the shipment is completed.</p>
                  </div>
                </div>
              )}
              
              {/* Current Location Info */}
              {currentLocation && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Current Location</span>
                  </div>
                  <div className="text-sm text-green-700">
                    <div>Lat: {currentLocation.lat.toFixed(6)}</div>
                    <div>Lng: {currentLocation.lng.toFixed(6)}</div>
                    <div>Accuracy: ±{Math.round(currentLocation.accuracy)}m</div>
                    <div>Last Updated: {formatDateTime(currentLocation.timestamp)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <Button 
                onClick={() => navigate(`/shipments/${shipmentId}/chat`)}
                className="w-full btn-primary text-white"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Open Shipment Chat
              </Button>
              
              <Button 
                onClick={() => window.open(`/tracking/${shipmentId}/map`, '_blank')}
                variant="outline"
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                View Full Map
              </Button>
              
              {user.role === 'admin' && (
                <Button 
                  onClick={() => navigate(`/admin/shipments/${shipmentId}`)}
                  variant="outline"
                  className="w-full border-purple-200 text-purple-600"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Admin View
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Google Maps Integration */}
      {(currentLocation || (shipment.origin && shipment.destination)) && (
        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Live Map View
            </CardTitle>
            <CardDescription>
              {currentLocation 
                ? 'Real-time location and route tracking'
                : 'Planned route visualization'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <GoogleMapsIntegration
              origin={shipment.origin}
              destination={shipment.destination}
              currentLocation={currentLocation}
              locationHistory={locationHistory}
              showTracking={user.role === 'traveler'}
              shipmentId={shipmentId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShipmentTracker;