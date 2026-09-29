import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  CreditCard,
  Package,
  User,
  MapPin,
  DollarSign,
  Shield,
  Loader2,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { BackButton } from './BackButton';
import { matchActions, matchPath, matchStatusLabel } from '../lib/matchLifecycle';
import { openMatchConversation } from '../lib/messaging';

const BookingPayment = () => {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const paymentInFlight = useRef(false);

  useEffect(() => {
    fetchBooking();
  }, [matchId]);

  const fetchBooking = async () => {
    try {
      const response = await axios.get(`/bookings/${matchId}`);
      setBooking(response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (paymentInFlight.current || !booking || !matchActions(booking.match, user?.id).canPay) return;
    paymentInFlight.current = true;
    setPaying(true);
    try {
      const response = await axios.post('/payments/checkout', {
        match_id: matchId,
        origin_url: window.location.origin
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      
      if (status === 401) {
        toast.error('Session expired. Please log in again.');
      } else if (status === 400) {
        toast.error(detail || 'This match is not in a payable state.');
      } else if (status === 403) {
        toast.error(detail || 'Only the sender can make this payment.');
      } else {
        toast.error(detail || 'Failed to initiate payment. Please try again.');
      }
    } finally {
      paymentInFlight.current = false;
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-4">We couldn't find this booking.</p>
            <Button onClick={() => navigate('/dashboard')} className="btn-primary text-white">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { match, shipment, traveler } = booking;
  const actions = matchActions(match, user?.id);
  const commission = match.platform_commission_amount || (match.price_agreed * 0.1);
  const travelerPayout = match.traveler_payout_amount || (match.price_agreed - commission);

  // If already paid, show status
  if (actions.canTrack) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-green-700">Payment Complete</h2>
            <p className="text-gray-600 mb-4">
              {matchStatusLabel(match, user?.id)}. Open tracking to continue this shipment.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(`/shipment/${match.shipment_id}`)} className="btn-primary text-white">
                Track Shipment
              </Button>
              <Button variant="outline" onClick={() => navigate(matchPath(match.id))}>Open request</Button>
              <Button variant="outline" onClick={() => openMatchConversation(match.id, navigate)}>Message</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6" data-testid="booking-payment-page">
      {/* Back button */}
      <BackButton fallback={matchPath(match.id)} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(matchPath(match.id))}>Open request</Button>
        <Button variant="outline" onClick={() => openMatchConversation(match.id, navigate)}>Message</Button>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">{matchStatusLabel(match, user?.id)}</h1>
        <p className="text-gray-600">Secure your delivery with escrow protection</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Booking Summary */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-orange-500" />
              Booking Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Shipment Details */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Package</p>
              <p className="text-sm text-gray-600">{shipment?.description}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">{shipment?.origin?.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-red-500" />
                <span className="text-gray-600">{shipment?.destination?.address}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-gray-400" />
              <span>{shipment?.weight}kg</span>
            </div>

            {/* Traveler Info */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Traveler</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">{traveler?.full_name}</p>
                  <Badge variant="outline" className="text-xs capitalize">{traveler?.role}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-green-500" />
              Payment Details
            </CardTitle>
            <CardDescription>Escrow-protected payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Price Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium">${match.price_agreed?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee (10%)</span>
                <span className="font-medium text-gray-500">${commission?.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-xl text-green-600">${match.price_agreed?.toFixed(2)}</span>
              </div>
            </div>

            {/* Escrow Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Escrow Protection</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Your payment is held securely. The traveler receives ${travelerPayout?.toFixed(2)} only after successful delivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay Button */}
            {actions.canPay && (
              <Button
                onClick={handlePayment}
                disabled={paying}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg"
                data-testid="pay-now-btn"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    Pay ${match.price_agreed?.toFixed(2)}
                  </>
                )}
              </Button>
            )}

            {!actions.canPay && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-sm text-yellow-800">
                  {matchStatusLabel(match, user?.id)}
                </p>
              </div>
            )}

            {/* Security Note */}
            <div className="text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Secured by Stripe. Your payment details are never stored.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BookingPayment;
