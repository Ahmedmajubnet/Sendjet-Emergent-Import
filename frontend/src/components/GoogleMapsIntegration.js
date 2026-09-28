import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
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
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const libraries = ['places', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px'
};

const defaultCenter = {
  lat: 30.0444,
  lng: 31.2357
};

const GoogleMapsIntegration = ({ 
  origin, 
  destination, 
  showTracking = false, 
  tripId = null,
  onLocationUpdate = null 
}) => {
  const [directions, setDirections] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [routeInfo, setRouteInfo] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [locationHistory, setLocationHistory] = useState([]);
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const directionsServiceRef = useRef(null);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY || '',
    libraries
  });

  useEffect(() => {
    if (isLoaded && origin && destination) {
      calculateRoute();
    }
  }, [isLoaded, origin, destination, travelMode]);

  useEffect(() => {
    if (showTracking) {
      startLocationTracking();
    }
    
    return () => {
      stopLocationTracking();
    };
  }, [showTracking]);

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
        steps: leg.steps.length,
        startAddress: leg.start_address,
        endAddress: leg.end_address
      });
      
    } catch (error) {
      console.error('Error calculating route:', error);
      toast.error('Failed to calculate route');
    }
  }, [isLoaded, origin, destination, travelMode]);

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      options
    );
    
    setTrackingActive(true);
    toast.success('🛰️ GPS tracking started');
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
  };

  const handleLocationUpdate = (position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date().toISOString(),
      speed: position.coords.speed,
      heading: position.coords.heading
    };
    
    setCurrentLocation(newLocation);
    setLocationHistory(prev => [...prev.slice(-99), newLocation]); // Keep last 100 locations
    
    // Calculate ETA if we have destination
    if (destination && isLoaded) {
      calculateETA(newLocation);
    }
    
    // Notify parent component
    if (onLocationUpdate) {
      onLocationUpdate(newLocation);
    }
    
    // Send location to backend if trip is active
    if (tripId) {
      sendLocationUpdate(newLocation);
    }
  };

  const handleLocationError = (error) => {
    console.error('Location error:', error);
    switch (error.code) {
      case error.PERMISSION_DENIED:
        toast.error('Location access denied. Please enable location sharing.');
        break;
      case error.POSITION_UNAVAILABLE:
        toast.error('Location information unavailable.');
        break;
      case error.TIMEOUT:
        toast.error('Location request timed out.');
        break;
      default:
        toast.error('An unknown location error occurred.');
        break;
    }
  };

  const calculateETA = async (currentPos) => {
    if (!directionsServiceRef.current) return;
    
    try {
      const request = {
        origin: new window.google.maps.LatLng(currentPos.lat, currentPos.lng),
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
      
      const eta = new Date(Date.now() + result.routes[0].legs[0].duration.value * 1000);
      setEstimatedArrival(eta);
      
    } catch (error) {
      console.error('ETA calculation error:', error);
    }
  };

  const sendLocationUpdate = async (location) => {
    try {
      // Send location update to backend
      await fetch('/api/trips/location-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          trip_id: tripId,
          location,
          timestamp: location.timestamp
        })
      });
    } catch (error) {
      console.error('Failed to send location update:', error);
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
    return eta.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loadError) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-2" />
          <p>Failed to load Google Maps</p>
          <p className="text-sm">Please check your internet connection and API key</p>
        </div>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-2"></div>
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
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
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
              <>🔴 Stop Tracking</>
            ) : (
              <>🛰️ Start Tracking</>
            )}
          </Button>
        )}
        
        {currentLocation && (
          <Button
            onClick={centerMapOnCurrentLocation}
            variant="outline"
            className="border-blue-200 text-blue-600"
          >
            <Navigation className="h-4 w-4 mr-1" />
            Center on Me
          </Button>
        )}
      </div>

      {/* Route Information */}
      {routeInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Route className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{routeInfo.distance}</p>
              <p className="text-sm text-gray-500">Distance</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{routeInfo.duration}</p>
              <p className="text-sm text-gray-500">Duration</p>
            </CardContent>
          </Card>
          
          {trackingActive && estimatedArrival && (
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{formatETA(estimatedArrival)}</p>
                <p className="text-sm text-gray-500">ETA</p>
              </CardContent>
            </Card>
          )}
          
          {currentLocation && (
            <Card>
              <CardContent className="p-4 text-center">
                <MapPin className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-lg font-bold">
                  ±{Math.round(currentLocation.accuracy)}m
                </p>
                <p className="text-sm text-gray-500">Accuracy</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Google Map */}
      <Card className="overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={10}
          center={currentLocation || origin || defaultCenter}
          onLoad={(map) => { mapRef.current = map; }}
          options={{
            zoomControl: true,
            streetViewControl: true,
            mapTypeControl: true,
            fullscreenControl: true,
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
                  strokeWeight: 4,
                  strokeOpacity: 0.8
                }
              }}
            />
          )}
          
          {/* Current Location */}
          {currentLocation && (
            <>
              <Marker
                position={currentLocation}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#4285f4',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }}
              >
                <InfoWindow position={currentLocation}>
                  <div className="text-center">
                    <p className="font-semibold">Current Location</p>
                    <p className="text-sm">Accuracy: ±{Math.round(currentLocation.accuracy)}m</p>
                    {currentLocation.speed && (
                      <p className="text-sm">Speed: {Math.round(currentLocation.speed * 3.6)} km/h</p>
                    )}
                  </div>
                </InfoWindow>
              </Marker>
              
              {/* Accuracy Circle */}
              {(() => {
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
          {locationHistory.length > 1 && trackingActive && (
            <>
              {locationHistory.map((loc, index) => (
                <Marker
                  key={index}
                  position={loc}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 2,
                    fillColor: '#10b981',
                    fillOpacity: 0.6,
                    strokeWeight: 0
                  }}
                />
              ))}
            </>
          )}
        </GoogleMap>
      </Card>
      
      {/* Tracking Status */}
      {trackingActive && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-semibold text-green-800">Live Tracking Active</p>
                  <p className="text-sm text-green-600">
                    Location updates every few seconds • {locationHistory.length} points recorded
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">
                <Truck className="h-3 w-3 mr-1" />
                In Transit
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleMapsIntegration;