import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Truck,
  Plane,
  Home,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const ShipmentTracking = () => {
  const { shipmentId } = useParams();
  const { user } = useAuth();
  const [shipment, setShipment] = useState(null);
  const [pickupCode, setPickupCode] = useState('');
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [canUpdateStatus, setCanUpdateStatus] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState('');
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [resendingPickup, setResendingPickup] = useState(false);
  const [resendingDelivery, setResendingDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canResend, setCanResend] = useState(false);
  const [cooldowns, setCooldowns] = useState({ pickup: 0, delivery: 0 });
  const resendInFlight = useRef(false);

  useEffect(() => {
    if (shipmentId && user?.id) fetchShipmentDetails();
  }, [shipmentId, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setCooldowns((previous) => ({
      pickup: Math.max(0, previous.pickup - 1),
      delivery: Math.max(0, previous.delivery - 1),
    })), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchShipmentDetails = async () => {
    try {
      const [shipmentResponse, matchesResponse] = await Promise.all([
        axios.get(`/shipments/${shipmentId}`),
        axios.get('/matches/my'),
      ]);
      setShipment(shipmentResponse.data);
      const paidMatches = matchesResponse.data.filter((match) =>
        match.shipment_id === shipmentId && match.payment_status === 'escrowed' &&
        ['paid', 'in_progress'].includes(match.status)
      );
      const match = paidMatches.length === 1 ? paidMatches[0] : null;
      setCanUpdateStatus(Boolean(match && match.traveler_id === user?.id));
      setCanResend(Boolean(match && [match.sender_id, match.traveler_id].includes(user?.id)));
    } catch (error) {
      toast.error('Failed to load shipment details');
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async (kind) => {
    const code = (kind === 'pickup' ? pickupCode : deliveryCode).trim();
    if (!/^[0-9]{6}$/.test(code)) {
      toast.error(`Please enter the 6-digit ${kind} code`);
      return;
    }
    if (confirmingPickup || confirmingDelivery || resendInFlight.current) return;
    const setConfirming = kind === 'pickup' ? setConfirmingPickup : setConfirmingDelivery;
    try {
      setConfirming(true);
      await axios.post(`/shipments/${shipmentId}/confirm-${kind}`, { code });
      toast.success(`Package ${kind} confirmed`);
      if (kind === 'pickup') setPickupCode('');
      else setDeliveryCode('');
      await fetchShipmentDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to confirm ${kind}`);
    } finally {
      setConfirming(false);
    }
  };

  const resendCode = async (kind) => {
    // The ref closes the interval before React renders a disabled button.
    if (resendInFlight.current || cooldowns[kind] > 0 || confirmingPickup || confirmingDelivery) return;
    resendInFlight.current = true;
    const setResending = kind === 'pickup' ? setResendingPickup : setResendingDelivery;
    setResending(true);
    try {
      await axios.post(`/shipments/${shipmentId}/resend-${kind}-code`);
      setCooldowns((previous) => ({ ...previous, [kind]: 60 }));
      if (kind === 'pickup') setPickupCode('');
      else setDeliveryCode('');
      toast.success(`A new ${kind} code was sent to the ${kind === 'pickup' ? 'sender' : 'recipient'}`);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = Number(error.response.headers?.['retry-after']);
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60;
        setCooldowns((previous) => ({ ...previous, [kind]: seconds }));
        toast.error(`Please wait ${seconds} seconds before requesting another ${kind} code. A send may already be running.`);
      } else {
        toast.error(error.response?.data?.detail || `Failed to resend ${kind} code`);
      }
    } finally {
      resendInFlight.current = false;
      setResending(false);
    }
  };

  const resendButton = (kind) => {
    const resending = kind === 'pickup' ? resendingPickup : resendingDelivery;
    return (
      <Button type="button" variant="outline" onClick={() => resendCode(kind)}
        disabled={resendingPickup || resendingDelivery || confirmingPickup || confirmingDelivery || cooldowns[kind] > 0}>
        {resending ? 'Sending...' : cooldowns[kind] > 0 ? `Resend in ${cooldowns[kind]}s` : `Resend ${kind === 'pickup' ? 'Pickup' : 'Delivery'} Code`}
      </Button>
    );
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      pending: Clock,
      matched: CheckCircle,
      picked_up: Package,
      in_transit: Truck,
      arrived: Plane,
      delivered: Home,
      cancelled: AlertCircle
    };
    return iconMap[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'bg-gray-100 text-gray-800',
      matched: 'bg-blue-100 text-blue-800',
      picked_up: 'bg-yellow-100 text-yellow-800',
      in_transit: 'bg-purple-100 text-purple-800',
      arrived: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      matched: 'Matched with Traveler',
      picked_up: 'Package Picked Up',
      in_transit: 'In Transit',
      arrived: 'Arrived at Destination',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
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
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Shipment Not Found</h2>
            <p className="text-gray-600">The shipment you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ensure status_history exists
  const statusHistory = shipment.status_history || [];
  const currentStatus = shipment.status;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Shipment Tracking</h1>
          <p className="text-gray-600 mt-1">Track your package in real-time</p>
        </div>
        <Badge className={`${getStatusColor(currentStatus)} text-sm px-4 py-2`}>
          {getStatusLabel(currentStatus)}
        </Badge>
      </div>

      {/* Shipment Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            Package Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Description</label>
              <p className="text-gray-800">{shipment.description}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Weight</label>
              <p className="text-gray-800">{shipment.weight} kg</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Origin</label>
              <p className="text-gray-800 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-green-500" />
                {shipment.origin.address}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Destination</label>
              <p className="text-gray-800 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-red-500" />
                {shipment.destination.address}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Declared Value</label>
              <p className="text-gray-800">${shipment.declared_value}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Pickup Date</label>
              <p className="text-gray-800">{formatTimestamp(shipment.pickup_date)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Tracking Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusHistory.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {/* Timeline items */}
              <div className="space-y-6">
                {statusHistory.map((milestone, index) => {
                  const StatusIcon = getStatusIcon(milestone.status);
                  const isLatest = index === statusHistory.length - 1;
                  
                  return (
                    <div key={index} className="relative flex items-start gap-4">
                      {/* Icon */}
                      <div className={`
                        relative z-10 flex items-center justify-center w-12 h-12 rounded-full
                        ${isLatest ? 'bg-orange-500' : 'bg-gray-300'}
                      `}>
                        <StatusIcon className={`h-6 w-6 ${isLatest ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-gray-800">
                              {getStatusLabel(milestone.status)}
                            </h3>
                            <Badge className={`${getStatusColor(milestone.status)} text-xs`}>
                              {milestone.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {milestone.notes}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(milestone.timestamp)}
                            </span>
                            {milestone.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {milestone.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tracking updates yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canResend && !canUpdateStatus && ['matched', 'arrived'].includes(currentStatus) && (
        <Card>
          <CardHeader><CardTitle>Confirmation code</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              {currentStatus === 'matched' ? 'The pickup code is emailed only to you, the sender.' : 'The delivery code is emailed only to the final recipient.'}
            </p>
            {resendButton(currentStatus === 'matched' ? 'pickup' : 'delivery')}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons (for traveler to update status) */}
      {canUpdateStatus && currentStatus !== 'delivered' && currentStatus !== 'cancelled' && (
        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
             {currentStatus === 'matched' && (
  <div className="flex flex-col sm:flex-row gap-3 w-full">
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={pickupCode}
      onChange={(e) =>
        setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))
      }
      placeholder="Enter 6-digit pickup code"
      className="border rounded-md px-4 py-2 flex-1"
    />

    <Button
      onClick={() => confirmCode('pickup')}
      disabled={confirmingPickup || resendingPickup || pickupCode.length !== 6}
      className="btn-primary text-white"
    >
      {confirmingPickup ? 'Confirming...' : 'Confirm Pickup'}
    </Button>
    {resendButton('pickup')}
  </div>
)}
              
              {currentStatus === 'picked_up' && (
                <Button
                  onClick={async () => {
                    try {
                      await axios.put(`/shipments/${shipmentId}/status`, {
                        status: 'in_transit',
                        notes: 'Package is now in transit'
                      });
                      toast.success('Status updated to In Transit');
                      fetchShipmentDetails();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to update status');
                      await fetchShipmentDetails();
                    }
                  }}
                  className="btn-primary text-white"
                >
                  Mark as In Transit
                </Button>
              )}
              
              {currentStatus === 'in_transit' && (
                <Button
                  onClick={async () => {
                    try {
                      await axios.put(`/shipments/${shipmentId}/status`, {
                        status: 'arrived',
                        notes: 'Package has arrived at destination',
                        location: shipment.destination.address
                      });
                      toast.success('Status updated to Arrived');
                      fetchShipmentDetails();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to update status');
                      await fetchShipmentDetails();
                    }
                  }}
                  className="btn-primary text-white"
                >
                  Mark as Arrived
                </Button>
              )}
              
              {currentStatus === 'arrived' && (
  <div className="flex flex-col sm:flex-row gap-3 w-full">
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={deliveryCode}
      onChange={(e) =>
        setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))
      }
      placeholder="Enter 6-digit delivery code"
      className="border rounded-md px-4 py-2 flex-1"
    />

    <Button
      onClick={() => confirmCode('delivery')}
      disabled={confirmingDelivery || resendingDelivery || deliveryCode.length !== 6}
      className="bg-green-500 hover:bg-green-600 text-white"
    >
      {confirmingDelivery ? 'Confirming...' : 'Confirm Delivery'}
    </Button>
    {resendButton('delivery')}
  </div>
)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShipmentTracking;
