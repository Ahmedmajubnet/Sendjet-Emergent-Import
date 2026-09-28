import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle, ArrowRight, Download, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { openMatchConversation } from '../lib/messaging';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const receiptRunning = useRef(false);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      checkPaymentStatus();
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const checkPaymentStatus = async (attempts = 0) => {
    const maxAttempts = 5;
    
    try {
      const response = await axios.get(`/payments/status/${sessionId}`);
      setPaymentStatus(response.data);
      
      if (response.data.payment_status === 'paid') {
        toast.success('Payment successful!');
        if (response.data.confirmation_notice) toast.warning(response.data.confirmation_notice);
        setLoading(false);
        return;
      } else if (response.data.status === 'expired') {
        toast.error('Payment session expired.');
        setLoading(false);
        return;
      }
      
      // Continue polling if still pending
      if (attempts < maxAttempts) {
        setTimeout(() => checkPaymentStatus(attempts + 1), 2000);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      if (attempts < maxAttempts) {
        setTimeout(() => checkPaymentStatus(attempts + 1), 2000);
      } else {
        toast.error('Failed to verify payment status');
        setLoading(false);
      }
    }
  };

  const openReceipt = async () => {
    if (receiptRunning.current || paymentStatus?.payment_status !== 'paid') return;
    receiptRunning.current = true;
    setReceiptLoading(true);
    setReceiptUrl(null);
    let receiptWindow = null;
    try {
      // Open during the click gesture, before the authenticated request awaits.
      // Detach the opener before navigating to the external hosted receipt.
      receiptWindow = window.open('about:blank', '_blank');
      if (receiptWindow) receiptWindow.opener = null;
      const result = await axios.get(`/payments/receipt/${encodeURIComponent(sessionId)}`);
      const url = new URL(result.data.receipt_url);
      if (url.protocol !== 'https:' || url.hostname !== 'pay.stripe.com' ||
          url.username || url.password || (url.port && url.port !== '443') || !url.pathname.startsWith('/receipts/')) {
        throw new Error('Invalid receipt link');
      }
      setReceiptUrl(url.href);
      if (receiptWindow && !receiptWindow.closed) {
        receiptWindow.location.replace(url.href);
      } else {
        toast.info('Use Open Stripe receipt below to open your receipt.');
      }
    } catch (error) {
      if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
      const status = error.response?.status;
      const message = status === 401 ? 'Please sign in again to view your receipt.' :
        error.response?.data?.detail || 'Could not open your Stripe receipt. Please try again.';
      toast.error(message);
    } finally {
      receiptRunning.current = false;
      setReceiptLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!sessionId || !paymentStatus) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <div className="text-red-500 mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Payment Session</h2>
            <p className="text-gray-600 mb-4">
              We couldn't find your payment session. Please try again.
            </p>
            <Button 
              onClick={() => navigate('/match-requests')}
              className="btn-primary text-white"
            >
              My Requests / Matches
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8 fade-in">
      
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Payment Successful!</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Your payment has been processed successfully. The traveler has been notified 
          and will proceed with your package delivery.
        </p>
      </div>

      {paymentStatus.confirmation_notice && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p>{paymentStatus.confirmation_notice}</p>
            <Button onClick={() => navigate(`/shipment/${paymentStatus.shipment_id}`)}>Open shipment tracking</Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Payment Summary */}
        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Payment Summary
            </CardTitle>
            <CardDescription>
              Transaction completed successfully
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-gray-100">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold text-lg text-green-600">
                ${(paymentStatus.amount_total / 100).toFixed(2)} {paymentStatus.currency.toUpperCase()}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-gray-100">
              <span className="text-gray-600">Payment Status:</span>
              <span className="font-medium text-green-600 capitalize">
                {paymentStatus.payment_status}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-gray-100">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-mono text-sm text-gray-800">
                {sessionId.slice(0, 16)}...
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2">
              <span className="text-gray-600">Date:</span>
              <span className="text-gray-800">
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-blue-500" />
              What Happens Next?
            </CardTitle>
            <CardDescription>
              Your delivery process has begun
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-medium">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Traveler Notified</p>
                  <p className="text-sm text-gray-600">The traveler has been notified about your payment and will confirm pickup details.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-600 text-sm font-medium">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Package Pickup</p>
                  <p className="text-sm text-gray-600">The traveler will coordinate with you for package pickup at the agreed location.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm font-medium">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Delivery & Confirmation</p>
                  <p className="text-sm text-gray-600">You'll receive updates during transit and confirmation upon successful delivery.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentStatus.shipment_id && <div className="text-center"><Button onClick={() => navigate(`/shipment/${paymentStatus.shipment_id}`)}>Track shipment</Button></div>}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button 
          onClick={() => paymentStatus.metadata?.match_id ? openMatchConversation(paymentStatus.metadata.match_id, navigate) : navigate('/match-requests')}
          className="w-full sm:w-auto btn-primary text-white px-8"
        >
          Message Traveler
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => navigate('/match-requests')}
          className="w-full sm:w-auto border-orange-200 text-orange-600 hover:bg-orange-50 px-8"
        >
          My Requests / Matches
        </Button>
        
        <Button 
          variant="outline"
          onClick={openReceipt}
          disabled={receiptLoading || paymentStatus.payment_status !== 'paid'}
          aria-busy={receiptLoading}
          className="w-full sm:w-auto border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          {receiptLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download Receipt
        </Button>
      </div>

      {receiptUrl && <p className="text-center"><a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">Open Stripe receipt</a></p>}
      {paymentStatus.payment_status !== 'paid' && <p className="text-center text-sm text-gray-600">A receipt is available only after payment is completed.</p>}

      {/* Rating Prompt */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardContent className="p-6 text-center">
          <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-800 mb-2">Rate Your Experience</h3>
          <p className="text-sm text-gray-600 mb-4">
            Once your package is delivered, don't forget to rate your traveler to help build trust in our community.
          </p>
          <div className="flex justify-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className="h-6 w-6 text-yellow-300 hover:text-yellow-400 cursor-pointer transition-colors"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Support Contact */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Need help? Contact our support team at{' '}
          <a href="mailto:support@sendjet.com" className="text-orange-600 hover:underline">
            support@sendjet.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccess;