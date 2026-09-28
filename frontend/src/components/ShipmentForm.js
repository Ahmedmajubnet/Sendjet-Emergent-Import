import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Switch } from './ui/switch';
import { 
  Package, 
  MapPin, 
  Calendar as CalendarIcon, 
  Weight, 
  DollarSign,
  ArrowRight,
  Ruler,
  Shield,
  Plane
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import axios from 'axios';
import LocationAutocomplete from './LocationAutocomplete';
import { BackButton } from './BackButton';

const ShipmentForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  
  const [formData, setFormData] = useState({
    origin: { lat: 0, lng: 0, address: '' },
    destination: { lat: 0, lng: 0, address: '' },
    pickup_date: '',
    description: '',
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    declared_value: '',
    insurance_required: false,
    recipient_name: '',
    recipient_email: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('dimensions.')) {
      const dimension = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        dimensions: {
          ...prev.dimensions,
          [dimension]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleLocationChange = (field, location) => {
    setFormData(prev => ({
      ...prev,
      [field]: { lat: location.lat, lng: location.lng, address: location.address }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDate) {
      toast.error('Please select a pickup date');
      return;
    }

    if (!formData.origin.address || !formData.destination.address) {
      toast.error('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    
    try {
      const shipmentData = {
        ...formData,
        pickup_date: selectedDate.toISOString(),
        weight: parseFloat(formData.weight),
        dimensions: {
          length: parseFloat(formData.dimensions.length),
          width: parseFloat(formData.dimensions.width),
          height: parseFloat(formData.dimensions.height)
        },
        declared_value: parseFloat(formData.declared_value)
      };

      await axios.post('/shipments', shipmentData);
      toast.success('Shipment posted successfully! 📦');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post shipment');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <Plane className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Admin accounts cannot post shipments</h2>
            <Button 
              onClick={() => navigate('/admin')}
              className="mt-4 btn-primary text-white"
            >
              Go to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8 fade-in">
      <BackButton fallback="/dashboard" />

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
          <Package className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Post a Shipment</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Need to send a package? Connect with trusted travelers heading to your destination. 
          Safe, affordable, and reliable package delivery.
        </p>
      </div>

      {/* Main Form */}
      <Card className="shadow-strong">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-500" />
            Shipment Details
          </CardTitle>
          <CardDescription>
            Provide details about the package you want to send
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Route Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="origin_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  Pickup Location
                </Label>
                <LocationAutocomplete
                  id="origin_address"
                  name="origin_address"
                  placeholder="e.g., Cairo, Egypt"
                  value={formData.origin.address}
                  onChange={(loc) => handleLocationChange('origin', loc)}
                  required
                  iconColor="text-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="destination_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  Delivery Location
                </Label>
                <LocationAutocomplete
                  id="destination_address"
                  name="destination_address"
                  placeholder="e.g., Riyadh, Saudi Arabia"
                  value={formData.destination.address}
                  onChange={(loc) => handleLocationChange('destination', loc)}
                  required
                  iconColor="text-red-500"
                />
              </div>
            </div>

            {/* Package Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Package Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What are you sending? (e.g., documents, electronics, clothing, etc.)"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={3}
                className="input-focus"
              />
            </div>

            {/* Package Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Weight & Date */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-blue-500" />
                    Pickup Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal input-focus"
                      >
                        {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="weight" className="flex items-center gap-2">
                    <Weight className="h-4 w-4 text-purple-500" />
                    Weight (kg)
                  </Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="number"
                    placeholder="e.g., 2.5"
                    value={formData.weight}
                    onChange={handleInputChange}
                    required
                    min="0.1"
                    step="0.1"
                    className="input-focus"
                  />
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-orange-500" />
                  Dimensions (cm)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    name="dimensions.length"
                    type="number"
                    placeholder="Length (cm)"
                    value={formData.dimensions.length}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="input-focus"
                  />
                  <Input
                    name="dimensions.width"
                    type="number"
                    placeholder="Width (cm)"
                    value={formData.dimensions.width}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="input-focus"
                  />
                  <Input
                    name="dimensions.height"
                    type="number"
                    placeholder="Height (cm)"
                    value={formData.dimensions.height}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="input-focus"
                  />
                </div>
              </div>
            </div>

            {/* Value & Insurance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="declared_value" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Declared Value ($)
                </Label>
                <Input
                  id="declared_value"
                  name="declared_value"
                  type="number"
                  placeholder="e.g., 100.00"
                  value={formData.declared_value}
                  onChange={handleInputChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="input-focus"
                />
              </div>

              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  Insurance Required
                </Label>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Switch
                    id="insurance_required"
                    checked={formData.insurance_required}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, insurance_required: checked }))
                    }
                  />
                  <Label htmlFor="insurance_required" className="text-sm text-gray-600">
                    I want insurance coverage for this package
                  </Label>
                </div>
              </div>
            </div>
                          {/* Recipient Details */}
<div className="space-y-4">
  <div>
    <h3 className="text-lg font-semibold">Recipient Details</h3>
    <p className="text-sm text-gray-500">
      The delivery confirmation code will be sent to this recipient.
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-2">
      <Label htmlFor="recipient_name">Recipient Name</Label>
      <Input
        id="recipient_name"
        name="recipient_name"
        type="text"
        placeholder="Recipient full name"
        value={formData.recipient_name}
        onChange={handleInputChange}
        required
        className="input-focus"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="recipient_email">Recipient Email</Label>
      <Input
        id="recipient_email"
        name="recipient_email"
        type="email"
        placeholder="recipient@example.com"
        value={formData.recipient_email}
        onChange={handleInputChange}
        required
        className="input-focus"
      />
    </div>
  </div>
</div>

            {/* Submit Button */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto btn-primary text-white px-8"
              >
                {loading ? (
                  'Posting Shipment...'
                ) : (
                  <>
                    Post Shipment
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-800">💡 Tips for Success</CardTitle>
        </CardHeader>
        <CardContent className="text-purple-700">
          <ul className="space-y-2 text-sm">
            <li>• Provide accurate package dimensions and weight</li>
            <li>• Be clear about what you're sending</li>
            <li>• Consider insurance for valuable items</li>
            <li>• Respond quickly to traveler inquiries</li>
            <li>• Keep prohibited items in mind (no liquids, hazardous materials, etc.)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipmentForm;