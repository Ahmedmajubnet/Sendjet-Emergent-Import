import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Route,
  MapPin,
  Calendar as CalendarIcon,
  Weight,
  DollarSign,
  ArrowRight,
  Package,
  Clock,
  Map,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import axios from 'axios';
import LocationAutocomplete from './LocationAutocomplete';
import { BackButton } from './BackButton';
import { CAPACITY_SIZES, TRANSPORT_MODES } from './TransportModeBadge';

const SPACE_LITERS_BY_SIZE = {
  small: 10,
  medium: 30,
  large: 60,
  xlarge: 100,
};

const MODE_COPY = {
  plane: {
    capacityTitle: 'Baggage space',
    capacityHint: 'Choose the parcel size that comfortably fits in your available luggage space.',
    weightLabel: 'Available weight (kg)',
    weightPlaceholder: 'e.g., 10',
  },
  car: {
    capacityTitle: 'Available vehicle space',
    capacityHint: 'Choose the largest parcel size you can comfortably carry in your vehicle.',
    weightLabel: 'Maximum parcel weight (kg)',
    weightPlaceholder: 'e.g., 25',
  },
  train: {
    capacityTitle: 'Available parcel space',
    capacityHint: 'Choose a parcel size you can comfortably manage during your train journey.',
    weightLabel: 'Maximum parcel weight (kg)',
    weightPlaceholder: 'e.g., 8',
  },
  bus: {
    capacityTitle: 'Available parcel space',
    capacityHint: 'Choose a parcel size that fits comfortably with your own luggage.',
    weightLabel: 'Maximum parcel weight (kg)',
    weightPlaceholder: 'e.g., 8',
  },
};

const TripForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const [formData, setFormData] = useState({
    transport_mode: 'plane',
    origin: { lat: 0, lng: 0, address: '' },
    destination: { lat: 0, lng: 0, address: '' },
    departure_date: '',
    departure_time: '',
    available_weight: '',
    capacity_size: 'medium',
    pricing_model: 'per_kg',
    price_per_kg: '',
    fixed_price: '',
    route_stops: '',
    pickup_along_route: false,
    description: '',
  });

  const modeCopy = MODE_COPY[formData.transport_mode] || MODE_COPY.plane;
  const capacityOptions = useMemo(
    () => CAPACITY_SIZES.filter((item) => formData.transport_mode === 'car' || item.value !== 'xlarge'),
    [formData.transport_mode]
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (field, location) => {
    setFormData((prev) => ({
      ...prev,
      [field]: { lat: location.lat, lng: location.lng, address: location.address },
    }));
  };

  const setTransportMode = (value) => {
    setFormData((prev) => ({
      ...prev,
      transport_mode: value,
      pickup_along_route: value === 'car' ? prev.pickup_along_route : false,
      capacity_size: value === 'car' ? prev.capacity_size : (prev.capacity_size === 'xlarge' ? 'large' : prev.capacity_size),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDate) {
      toast.error('Please select a departure date');
      return;
    }
    if (!formData.origin.address || !formData.destination.address) {
      toast.error('Please enter both origin and destination');
      return;
    }
    if (!formData.available_weight || Number(formData.available_weight) <= 0) {
      toast.error('Please enter the weight you can carry');
      return;
    }
    if (formData.pricing_model === 'per_kg' && (!formData.price_per_kg || Number(formData.price_per_kg) <= 0)) {
      toast.error('Please enter your price per kg');
      return;
    }
    if (formData.pricing_model === 'fixed' && (!formData.fixed_price || Number(formData.fixed_price) <= 0)) {
      toast.error('Please enter your fixed price');
      return;
    }

    setLoading(true);
    try {
      const tripData = {
        ...formData,
        departure_date: selectedDate.toISOString(),
        available_weight: parseFloat(formData.available_weight),
        // Kept for backward compatibility with the existing marketplace/data model.
        // The UI now presents human-friendly parcel-size categories instead of liters.
        available_space: SPACE_LITERS_BY_SIZE[formData.capacity_size] || 30,
        price_per_kg: formData.pricing_model === 'per_kg' ? parseFloat(formData.price_per_kg) : null,
        fixed_price: formData.pricing_model === 'fixed' ? parseFloat(formData.fixed_price) : null,
      };

      await axios.post('/trips', tripData);
      toast.success('Journey posted successfully! 🎉');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post journey');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="text-center">
          <CardContent className="p-8">
            <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Admin accounts cannot post journeys</h2>
            <Button onClick={() => navigate('/admin')} className="mt-4 btn-primary text-white">
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

      <div className="text-center space-y-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Route className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Post a Trip</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Share your journey and use the space you're already taking with you.
        </p>
      </div>

      <Card className="shadow-strong">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-orange-500" />
            Journey Details
          </CardTitle>
          <CardDescription>Tell senders where you're going, how you're traveling, and what you can carry.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-3">
              <Label>How are you traveling?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TRANSPORT_MODES.map(({ value, label, Icon }) => {
                  const selected = formData.transport_mode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransportMode(value)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                        selected
                          ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/50'
                      }`}
                      aria-pressed={selected}
                      data-testid={`transport-${value}`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="origin_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  Origin
                </Label>
                <LocationAutocomplete
                  id="origin_address"
                  name="origin_address"
                  placeholder="e.g., Berlin, Germany"
                  value={formData.origin.address}
                  onChange={(loc) => handleLocationChange('origin', loc)}
                  required
                  iconColor="text-green-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  Destination
                </Label>
                <LocationAutocomplete
                  id="destination_address"
                  name="destination_address"
                  placeholder="e.g., Hamburg, Germany"
                  value={formData.destination.address}
                  onChange={(loc) => handleLocationChange('destination', loc)}
                  required
                  iconColor="text-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-500" />
                  Departure date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal input-focus">
                      {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="departure_time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-500" />
                  Departure time <span className="font-normal text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="departure_time"
                  name="departure_time"
                  type="time"
                  value={formData.departure_time}
                  onChange={handleInputChange}
                  className="input-focus"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div>
                <Label>{modeCopy.capacityTitle}</Label>
                <p className="text-xs text-gray-500 mt-1">{modeCopy.capacityHint}</p>
              </div>
              <div className={`grid grid-cols-2 ${formData.transport_mode === 'car' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                {capacityOptions.map(({ value, label, helper, Icon }) => {
                  const selected = formData.capacity_size === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, capacity_size: value }))}
                      className={`relative rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-orange-500 bg-white ring-2 ring-orange-100'
                          : 'border-gray-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-orange-600" />}
                      <Icon className={`h-5 w-5 mb-2 ${selected ? 'text-orange-600' : 'text-gray-500'}`} />
                      <div className="text-sm font-medium text-gray-900">{label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{helper}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="available_weight" className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-purple-500" />
                {modeCopy.weightLabel}
              </Label>
              <Input
                id="available_weight"
                name="available_weight"
                type="number"
                placeholder={modeCopy.weightPlaceholder}
                value={formData.available_weight}
                onChange={handleInputChange}
                required
                min="0.1"
                step="0.1"
                className="input-focus"
              />
            </div>

            <div className="space-y-3">
              <Label>How do you want to price this journey?</Label>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, pricing_model: 'per_kg' }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    formData.pricing_model === 'per_kg'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'
                  }`}
                >
                  Per kg
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, pricing_model: 'fixed' }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    formData.pricing_model === 'fixed'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200'
                  }`}
                >
                  Fixed price
                </button>
              </div>

              <div className="max-w-sm">
                {formData.pricing_model === 'per_kg' ? (
                  <div className="space-y-2">
                    <Label htmlFor="price_per_kg" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      Price per kg
                    </Label>
                    <Input
                      id="price_per_kg"
                      name="price_per_kg"
                      type="number"
                      placeholder="e.g., 5.00"
                      value={formData.price_per_kg}
                      onChange={handleInputChange}
                      min="0.01"
                      step="0.01"
                      className="input-focus"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="fixed_price" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      Fixed price for the parcel
                    </Label>
                    <Input
                      id="fixed_price"
                      name="fixed_price"
                      type="number"
                      placeholder="e.g., 25.00"
                      value={formData.fixed_price}
                      onChange={handleInputChange}
                      min="0.01"
                      step="0.01"
                      className="input-focus"
                    />
                  </div>
                )}
              </div>
            </div>

            {formData.transport_mode !== 'plane' && (
              <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
                <div className="space-y-2">
                  <Label htmlFor="route_stops" className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-orange-500" />
                    Stops / route details <span className="font-normal text-gray-400">(optional)</span>
                  </Label>
                  <Input
                    id="route_stops"
                    name="route_stops"
                    placeholder={formData.transport_mode === 'car' ? 'e.g., Potsdam → Magdeburg → Hanover' : 'e.g., direct service or important stops'}
                    value={formData.route_stops}
                    onChange={handleInputChange}
                    className="input-focus"
                  />
                </div>

                {formData.transport_mode === 'car' && (
                  <label className="flex items-start gap-3 rounded-xl bg-orange-50/60 border border-orange-100 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.pickup_along_route}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pickup_along_route: e.target.checked }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">I can pick up parcels along my route</span>
                      <span className="block text-xs text-gray-500 mt-0.5">Senders near your route may contact you even if they are not exactly at the start point.</span>
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Anything else senders should know? <span className="font-normal text-gray-400">(optional)</span></Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Parcel limits, preferences, meeting point, timing, or anything useful..."
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="input-focus"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto border-gray-300 text-gray-600 hover:bg-gray-50">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto btn-primary text-white px-8">
                {loading ? 'Posting Journey...' : (
                  <>
                    Post Trip
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100">
        <CardHeader>
          <CardTitle className="text-orange-900">A good listing gets better matches</CardTitle>
        </CardHeader>
        <CardContent className="text-orange-900/80">
          <ul className="space-y-2 text-sm">
            <li>• Choose a parcel size you can comfortably carry — don't overestimate your space.</li>
            <li>• Add useful route or stop details when traveling by road, train or bus.</li>
            <li>• Use a clear price and reply quickly when a sender contacts you.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default TripForm;
