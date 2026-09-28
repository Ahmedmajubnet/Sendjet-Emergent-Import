import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { XCircle, ArrowLeft, RefreshCw, MessageCircle } from 'lucide-react';

const PaymentCancelled = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8 fade-in">
      
      {/* Cancelled Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Payment Cancelled</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Your payment was cancelled and no charges were made to your account. 
          You can try again or contact the traveler directly to discuss alternative arrangements.
        </p>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* What Happened */}
        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              What Happened?
            </CardTitle>
            <CardDescription>
              Payment process was interrupted
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <strong>Payment Status:</strong> Cancelled
              </p>
              <p className="text-red-700 text-sm mt-1">
                No charges were made to your payment method.
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Possible reasons:</strong>
              </p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>You clicked the back button or closed the payment window</li>
                <li>Session timed out due to inactivity</li>
                <li>Payment method was declined</li>
                <li>You chose to cancel the transaction</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="shadow-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              What Can You Do?
            </CardTitle>
            <CardDescription>
              Options to proceed with your delivery
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <RefreshCw className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Try Payment Again</p>
                  <p className="text-sm text-gray-600">Return to the marketplace and retry the payment process with the same or different payment method.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="h-3 w-3 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Contact Traveler</p>
                  <p className="text-sm text-gray-600">Message the traveler directly to discuss payment alternatives or negotiate different terms.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ArrowLeft className="h-3 w-3 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">Find Another Traveler</p>
                  <p className="text-sm text-gray-600">Browse other travelers on the same route who might be able to carry your package.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button 
          onClick={() => navigate('/marketplace')}
          className="w-full sm:w-auto btn-primary text-white px-8"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        
        <Button 
          onClick={() => navigate('/messages')}
          variant="outline"
          className="w-full sm:w-auto border-green-200 text-green-600 hover:bg-green-50 px-8"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Message Traveler
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="w-full sm:w-auto border-gray-200 text-gray-600 hover:bg-gray-50 px-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Help Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold text-gray-800 mb-2">Need Help?</h3>
          <p className="text-sm text-gray-600 mb-4">
            If you're experiencing technical issues or need assistance with payments, 
            our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="sm">
              Contact Support
            </Button>
            <Button variant="outline" size="sm">
              View FAQ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Support Contact */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Having trouble? Contact our support team at{' '}
          <a href="mailto:support@sendjet.com" className="text-blue-600 hover:underline">
            support@sendjet.com
          </a>{' '}
          or call{' '}
          <a href="tel:+1-555-SENDJET" className="text-blue-600 hover:underline">
            +1 (555) SENDJET
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentCancelled;