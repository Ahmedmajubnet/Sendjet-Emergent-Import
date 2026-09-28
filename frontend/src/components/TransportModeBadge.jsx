import React from 'react';
import { Plane, Car, TrainFront, BusFront, Package, Briefcase, Luggage, Box } from 'lucide-react';

export const TRANSPORT_MODES = [
  { value: 'plane', label: 'Plane', Icon: Plane },
  { value: 'car', label: 'Car', Icon: Car },
  { value: 'train', label: 'Train', Icon: TrainFront },
  { value: 'bus', label: 'Bus', Icon: BusFront },
];

export const CAPACITY_SIZES = [
  { value: 'small', label: 'Small', helper: 'Documents / shoebox', Icon: Package },
  { value: 'medium', label: 'Medium', helper: 'Backpack / small parcel', Icon: Briefcase },
  { value: 'large', label: 'Large', helper: 'Suitcase-size parcel', Icon: Luggage },
  { value: 'xlarge', label: 'Extra large', helper: 'Car boot / bulky parcel', Icon: Box },
];

export const getTransportMode = (value) =>
  TRANSPORT_MODES.find((mode) => mode.value === (value || 'plane')) || TRANSPORT_MODES[0];

export const getCapacitySize = (value) =>
  CAPACITY_SIZES.find((size) => size.value === value) || null;

export const formatTripPrice = (trip) => {
  if (!trip) return 'Price not set';
  if (trip.pricing_model === 'fixed' && trip.fixed_price != null) {
    return `$${Number(trip.fixed_price).toFixed(2)} fixed`;
  }
  if (trip.price_per_kg != null) {
    return `$${Number(trip.price_per_kg).toFixed(2)}/kg`;
  }
  return 'Price negotiable';
};

export const TransportModeBadge = ({ value, className = '' }) => {
  const { label, Icon } = getTransportMode(value);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};
