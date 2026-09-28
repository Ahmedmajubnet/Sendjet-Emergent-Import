import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MessageCircle, MapPin } from 'lucide-react';
import { BackButton } from './BackButton';
import ShipmentChat from './ShipmentChat';
import ShipmentTracking from './ShipmentTracking';
import axios from 'axios';
import { toast } from 'sonner';

const ShipmentDetails = () => {
  const { shipmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shipmentId) {
      fetchShipment();
    }
  }, [shipmentId]);

  const fetchShipment = async () => {
    try {
      const response = await axios.get(`/shipments/${shipmentId}`);
      setShipment(response.data);
    } catch (error) {
      console.error('Failed to load shipment:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have access to this shipment');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2 sm:gap-4 min-w-0">
          <BackButton fallback="/dashboard" />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Shipment Details</h1>
            {shipment && (
              <p className="text-sm sm:text-base text-gray-600 mt-1 break-words">{shipment.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs for Chat and Tracking */}
      <Tabs defaultValue="tracking" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tracking" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
            <MapPin className="h-4 w-4" />
            Tracking & Status
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 text-xs sm:text-sm">
            <MessageCircle className="h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="tracking" className="mt-6">
          <ShipmentTracking />
        </TabsContent>
        
        <TabsContent value="chat" className="mt-6">
          <ShipmentChat />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShipmentDetails;
