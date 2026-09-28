import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Route,
  Zap,
  Truck,
  AlertCircle,
  CheckCircle,
  Plane,
  Target,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

const libraries = ['places', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '12px'
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357
};

const EnhancedGoogleMaps = ({ 
  origin, 
  destination, 
  currentLocation = null,
  locationHistory = [],
  showTracking = false, 
  shipmentId = null,
  onLocationUpdate = null 
}) => {
  const [directions, setDirections] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [routeInfo, setRouteInfo] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const directionsServiceRef = useRef(null);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || 'AIzaSyDemo123456789',
    libraries
  });

  useEffect(() => {
    if (isLoaded && origin && destination) {
      calculateRoute();
    }
  }, [isLoaded, origin, destination, travelMode]);

  useEffect(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
      if (mapRef.current) {
        mapRef.current.panTo(currentLocation);
      }
    } else if (origin) {
      setMapCenter(origin);
    }
  }, [currentLocation, origin]);

  const calculateRoute = useCallback(async () => {
    if (!isLoaded || !origin || !destination) return;
    
    try {
      const directionsService = new window.google.maps.DirectionsService();
      directionsServiceRef.current = directionsService;
      
      const request = {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode[travelMode],
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      };
      
      const result = await new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });
      
      setDirections(result);
      
      // Extract route information
      const route = result.routes[0];
      const leg = route.legs[0];
      
      setRouteInfo({
        distance: leg.distance.text,
        duration: leg.duration.text,
        distanceValue: leg.distance.value,
        durationValue: leg.duration.value,
        steps: leg.steps.length,
        startAddress: leg.start_address,
        endAddress: leg.end_address
      });
      
      // Calculate ETA if we have current location
      if (currentLocation) {
        calculateETA();
      }
      
    } catch (error) {
      console.error('Error calculating route:', error);
      toast.error('Failed to calculate route - using demo mode');
    }
  }, [isLoaded, origin, destination, travelMode, currentLocation]);

  const calculateETA = async () => {
    if (!currentLocation || !destination || !directionsServiceRef.current) return;
    
    try {
      const request = {
        origin: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode[travelMode]
      };
      
      const result = await new Promise((resolve, reject) => {
        directionsServiceRef.current.route(request, (result, status) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            reject(new Error(`ETA calculation failed: ${status}`));
          }
        });
      });
      
      const durationSeconds = result.routes[0].legs[0].duration.value;
      const eta = new Date(Date.now() + durationSeconds * 1000);
      setEstimatedArrival(eta);
      
    } catch (error) {
      console.error('ETA calculation error:', error);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    };
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: new Date().toISOString()
        };
        
        // Update current location
        setMapCenter(newLocation);
        
        // Notify parent component
        if (onLocationUpdate) {
          onLocationUpdate(newLocation);
        }
        
        // Send to backend if shipment is active
        if (shipmentId) {
          sendLocationUpdate(newLocation);
        }
      },
      (error) => {
        console.error('Location error:', error);
        handleLocationError(error);
      },
      options
    );
    
    setTrackingActive(true);
    toast.success('🛰️ GPS tracking started - location will update automatically');
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
    toast.info('📍 GPS tracking stopped');
  };

  const sendLocationUpdate = async (location) => {
    try {
      await fetch(`/api/shipments/${shipmentId}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ location })
      });
    } catch (error) {
      console.error('Failed to send location update:', error);
    }
  };

  const handleLocationError = (error) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        toast.error('📍 Location access denied. Please enable location sharing in your browser.');
        break;
      case error.POSITION_UNAVAILABLE:
        toast.error('📍 Location information unavailable.');
        break;
      case error.TIMEOUT:
        toast.error('📍 Location request timed out.');
        break;
      default:
        toast.error('📍 An unknown location error occurred.');
        break;
    }
  };

  const centerMapOnCurrentLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(16);
    }
  };

  const formatETA = (eta) => {
    if (!eta) return 'Calculating...';
    return eta.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short'
    });
  };

  const getLocationAge = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  if (loadError) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Google Maps Unavailable</h3>
          <p className="text-sm mb-4">Maps are currently in demo mode. In production, this would show live tracking.</p>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-gray-700 font-medium">Demo Route Information:</p>
            <p className="text-sm text-gray-600 mt-1">📍 Origin: {origin?.address || 'Loading...'}</p>
            <p className="text-sm text-gray-600">📍 Destination: {destination?.address || 'Loading...'}</p>
            {currentLocation && (
              <p className="text-sm text-green-600 mt-2">🛰️ Live tracking: Active</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>Loading Google Maps...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Map Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Travel Mode:</label>
          <select 
            value={travelMode} 
            onChange={(e) => setTravelMode(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="DRIVING">🚗 Driving</option>
            <option value="TRANSIT">🚌 Transit</option>
            <option value="WALKING">🚶 Walking</option>
            <option value="BICYCLING">🚲 Bicycling</option>
          </select>
        </div>
        
        {showTracking && (
          <Button
            onClick={trackingActive ? stopLocationTracking : startLocationTracking}
            className={`${trackingActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
          >
            {trackingActive ? (
              <>
                🔴 Stop Live Tracking
              </>
            ) : (
              <>
                🛰️ Start Live Tracking
              </>
            )}
          </Button>
        )}
        
        {currentLocation && (
          <Button
            onClick={centerMapOnCurrentLocation}
            variant="outline"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Target className="h-4 w-4 mr-1" />
            Center on Traveler
          </Button>
        )}
      </div>

      {/* Route Information Cards */}
      {routeInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Route className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{routeInfo.distance}</p>
              <p className="text-sm text-gray-500">Total Distance</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{routeInfo.duration}</p>
              <p className="text-sm text-gray-500">Travel Time</p>
            </CardContent>
          </Card>
          
          {trackingActive && estimatedArrival && (
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-lg font-bold">{formatETA(estimatedArrival)}</p>
                <p className="text-sm text-gray-500">Estimated Arrival</p>
              </CardContent>
            </Card>
          )}
          
          {currentLocation && (
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-green-600">
                  🟢 Live
                </p>
                <p className="text-xs text-gray-500">
                  {getLocationAge(currentLocation.timestamp)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Google Map */}
      <Card className="overflow-hidden shadow-strong">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={currentLocation ? 14 : 10}
          center={mapCenter}
          onLoad={(map) => { mapRef.current = map; }}
          options={{
            zoomControl: true,
            streetViewControl: true,
            mapTypeControl: true,
            fullscreenControl: true,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
              }
            ]
          }}
        >
          {/* Route */}
          {directions && (
            <DirectionsRenderer 
              directions={directions}
              options={{
                suppressMarkers: false,
                polylineOptions: {
                  strokeColor: '#2563eb',
                  strokeWeight: 5,
                  strokeOpacity: 0.8
                },
                markerOptions: {
                  icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    `),
                    scaledSize: new window.google.maps.Size(32, 32)
                  }
                }
              }}
            />
          )}
          
          {/* Current Location of Traveler */}
          {currentLocation && (
            <>
              <Marker
                position={currentLocation}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8" fill="#4285f4" stroke="white" stroke-width="3"/>
                      <circle cx="12" cy="12" r="3" fill="white"/>
                    </svg>
                  `),
                  scaledSize: new window.google.maps.Size(40, 40)
                }}
                onClick={() => setSelectedMarker('current')}
              />
              
              {selectedMarker === 'current' && (
                <InfoWindow 
                  position={currentLocation} 
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="text-center p-2">
                    <p className="font-semibold text-blue-600">🛰️ Traveler Location</p>
                    <p className="text-sm text-gray-600 mt-1">Live GPS Position</p>
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Accuracy: ±{Math.round(currentLocation.accuracy)}m</p>
                      {currentLocation.speed && (
                        <p>Speed: {Math.round(currentLocation.speed * 3.6)} km/h</p>
                      )}
                      <p>Updated: {getLocationAge(currentLocation.timestamp)}</p>
                    </div>
                  </div>
                </InfoWindow>
              )}
              
              {/* Accuracy Circle */}
              {currentLocation.accuracy && (() => {
                const GoogleCircle = window.google?.maps?.Circle;
                if (!GoogleCircle) return null;
                return (
                  <GoogleCircle
                    center={currentLocation}
                    radius={currentLocation.accuracy}
                    options={{
                      fillColor: '#4285f4',
                      fillOpacity: 0.1,
                      strokeColor: '#4285f4',
                      strokeOpacity: 0.3,
                      strokeWeight: 1
                    }}
                  />
                );
              })()}
            </>
          )}
          
          {/* Location History Trail */}
          {locationHistory.length > 1 && (
            <Polyline
              path={locationHistory.map(loc => ({ lat: loc.location.lat, lng: loc.location.lng }))}
              options={{
                strokeColor: '#10b981',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                geodesic: true
              }}
            />
          )}
          
          {/* Origin Marker */}
          {origin && (
            <Marker
              position={origin}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32)
              }}
              onClick={() => setSelectedMarker('origin')}
            />
          )}
          
          {selectedMarker === 'origin' && origin && (
            <InfoWindow 
              position={origin} 
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="text-center p-2">
                <p className="font-semibold text-green-600">📦 Pickup Location</p>
                <p className="text-sm text-gray-600">{origin.address}</p>
              </div>
            </InfoWindow>
          )}
          
          {/* Destination Marker */}
          {destination && (
            <Marker
              position={destination}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32)
              }}
              onClick={() => setSelectedMarker('destination')}
            />
          )}
          
          {selectedMarker === 'destination' && destination && (
            <InfoWindow 
              position={destination} 
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="text-center p-2">
                <p className="font-semibold text-red-600">🎯 Delivery Location</p>
                <p className="text-sm text-gray-600">{destination.address}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </Card>
      
      {/* Live Tracking Status */}
      {trackingActive && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-semibold text-green-800">🛰️ Live Tracking Active</p>
                  <p className="text-sm text-green-600">
                    Location updates automatically • Privacy protected
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-green-100 text-green-800">
                  <Truck className="h-3 w-3 mr-1" />
                  {locationHistory.length} GPS points
                </Badge>
                {estimatedArrival && (
                  <p className="text-sm text-green-600 mt-1">
                    ETA: {formatETA(estimatedArrival)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Privacy Notice */}
      <div className="text-center text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p className="flex items-center justify-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>🔒 Privacy Protected: Location sharing is only active during shipment delivery and automatically disabled when completed.</span>
        </p>
      </div>
    </div>
  );
};

export default EnhancedGoogleMaps;