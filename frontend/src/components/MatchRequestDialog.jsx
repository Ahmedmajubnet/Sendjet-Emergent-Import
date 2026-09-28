import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { matchPath, matchStatusLabel, relevantMatches } from '../lib/matchLifecycle';
import { toast } from 'sonner';
import { Handshake, Package, Route, Loader2, Plus, Plane, Car, Train, Bus, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TransportModeBadge } from './TransportModeBadge';

const routeLabel = (item) => `${item?.origin?.address || 'Origin'} → ${item?.destination?.address || 'Destination'}`;
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const packageDimensions = {
  small: { length: 20, width: 15, height: 10 },
  medium: { length: 40, width: 30, height: 20 },
  large: { length: 60, width: 40, height: 40 },
};

const blankShipment = () => ({
  origin: '', destination: '', description: '', weight: '', pickupDate: tomorrow(),
  size: 'small', declaredValue: '', publish: false, recipientName: '', recipientEmail: '',
});
const blankJourney = () => ({
  origin: '', destination: '', departureDate: tomorrow(), departureTime: '', transportMode: 'car',
  capacitySize: 'medium', availableWeight: '10', publish: false, pricingModel: 'fixed', price: '',
});

const MatchRequestDialog = ({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  conversationId = null,
  preferredTripId = null,
  preferredShipmentId = null,
  initialMode = null,
}) => {
  const navigate = useNavigate();
  const [existingMatches, setExistingMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(null);
  const [options, setOptions] = useState({ target_trips: [], target_shipments: [], my_shipments: [], my_trips: [] });
  const [mode, setMode] = useState(initialMode || 'send');
  const [targetTripId, setTargetTripId] = useState('');
  const [targetShipmentId, setTargetShipmentId] = useState('');
  const [myShipmentId, setMyShipmentId] = useState('');
  const [myTripId, setMyTripId] = useState('');
  const [price, setPrice] = useState('');
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [showJourneyForm, setShowJourneyForm] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(blankShipment());
  const [journeyDraft, setJourneyDraft] = useState(blankJourney());

  const loadOptions = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/users/${targetUserId}/match-options`);
      const data = res.data || {};
      const existing = relevantMatches(data.existing_matches || [], preferredTripId, preferredShipmentId);
      setExistingMatches(existing);
      if (existing.length === 1) {
        onOpenChange(false);
        navigate(matchPath(existing[0].id));
        return;
      }
      const next = {
        target_trips: data.target_trips || [],
        target_shipments: data.target_shipments || [],
        my_shipments: data.my_shipments || [],
        my_trips: data.my_trips || [],
      };
      setOptions(next);

      const preferredTrip = next.target_trips.find((x) => x.id === preferredTripId);
      const preferredShipment = next.target_shipments.find((x) => x.id === preferredShipmentId);
      setTargetTripId(preferredTrip?.id || next.target_trips[0]?.id || '');
      setTargetShipmentId(preferredShipment?.id || next.target_shipments[0]?.id || '');
      setMyShipmentId(next.my_shipments[0]?.id || '');
      setMyTripId(next.my_trips[0]?.id || '');

      let nextMode = initialMode;
      if (nextMode === 'send' && !next.target_trips.length) nextMode = null;
      if (nextMode === 'carry' && !next.target_shipments.length) nextMode = null;
      if (!nextMode) nextMode = next.target_trips.length ? 'send' : 'carry';
      setMode(nextMode);
      setShowShipmentForm(nextMode === 'send' && !next.my_shipments.length);
      setShowJourneyForm(nextMode === 'carry' && !next.my_trips.length);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load match options');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !targetUserId) return;
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetUserId, preferredTripId, preferredShipmentId, initialMode]);

  useEffect(() => {
    if (!open) {
      setPrice('');
      setCreating(null);
      setShowShipmentForm(false);
      setShowJourneyForm(false);
      setShipmentDraft(blankShipment());
      setJourneyDraft(blankJourney());
    }
  }, [open]);

  const canSend = options.target_trips.length > 0;
  const canCarry = options.target_shipments.length > 0;
  const selectedTrip = useMemo(() => options.target_trips.find((x) => x.id === targetTripId), [options.target_trips, targetTripId]);
  const selectedMyTrip = useMemo(() => options.my_trips.find((x) => x.id === myTripId), [options.my_trips, myTripId]);

  const createShipmentInline = async () => {
    const weight = Number(shipmentDraft.weight);
    if (!shipmentDraft.origin.trim() || !shipmentDraft.destination.trim() || !shipmentDraft.description.trim() || !weight || weight <= 0 || !shipmentDraft.pickupDate) {
      toast.error('Add route, parcel details, weight and pickup date');
      return;
    }
    if (!shipmentDraft.recipientName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipmentDraft.recipientEmail.trim())) {
      toast.error('Add the final recipient name and a valid email address');
      return;
    }
    setCreating('shipment');
    try {
      const payload = {
        origin: { address: shipmentDraft.origin.trim() },
        destination: { address: shipmentDraft.destination.trim() },
        description: shipmentDraft.description.trim(),
        weight,
        dimensions: packageDimensions[shipmentDraft.size] || packageDimensions.small,
        declared_value: Number(shipmentDraft.declaredValue) || 0,
        insurance_required: false,
        pickup_date: `${shipmentDraft.pickupDate}T12:00:00Z`,
        photos: [],
        visibility: shipmentDraft.publish ? 'public' : 'private',
        recipient_name: shipmentDraft.recipientName.trim(),
        recipient_email: shipmentDraft.recipientEmail.trim(),
      };
      const res = await axios.post('/shipments', payload);
      const created = res.data;
      setOptions((prev) => ({ ...prev, my_shipments: [created, ...prev.my_shipments] }));
      setMyShipmentId(created.id);
      setShowShipmentForm(false);
      toast.success(shipmentDraft.publish ? 'Shipment posted and selected' : 'Shipment details saved for this match');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save shipment details');
    } finally {
      setCreating(null);
    }
  };

  const createJourneyInline = async () => {
    const availableWeight = Number(journeyDraft.availableWeight);
    const publicPrice = Number(journeyDraft.price);
    if (!journeyDraft.origin.trim() || !journeyDraft.destination.trim() || !journeyDraft.departureDate || !availableWeight || availableWeight <= 0) {
      toast.error('Add route, date and available weight');
      return;
    }
    if (journeyDraft.publish && (!publicPrice || publicPrice <= 0)) {
      toast.error('Add a Marketplace price or keep this journey match-only');
      return;
    }
    setCreating('journey');
    try {
      const payload = {
        transport_mode: journeyDraft.transportMode,
        origin: { address: journeyDraft.origin.trim() },
        destination: { address: journeyDraft.destination.trim() },
        departure_date: `${journeyDraft.departureDate}T12:00:00Z`,
        departure_time: journeyDraft.departureTime || null,
        available_weight: availableWeight,
        available_space: null,
        capacity_size: journeyDraft.capacitySize,
        pricing_model: journeyDraft.publish ? journeyDraft.pricingModel : 'negotiable',
        price_per_kg: journeyDraft.publish && journeyDraft.pricingModel === 'per_kg' ? publicPrice : null,
        fixed_price: journeyDraft.publish && journeyDraft.pricingModel === 'fixed' ? publicPrice : null,
        route_stops: null,
        pickup_along_route: false,
        description: 'Journey added while creating a match request',
        visibility: journeyDraft.publish ? 'public' : 'private',
      };
      const res = await axios.post('/trips', payload);
      const created = res.data;
      setOptions((prev) => ({ ...prev, my_trips: [created, ...prev.my_trips] }));
      setMyTripId(created.id);
      setShowJourneyForm(false);
      toast.success(journeyDraft.publish ? 'Journey posted and selected' : 'Journey details saved for this match');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save journey details');
    } finally {
      setCreating(null);
    }
  };

  const submit = async () => {
    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      toast.error('Enter a valid offer price');
      return;
    }
    const shipmentId = mode === 'send' ? myShipmentId : targetShipmentId;
    const tripId = mode === 'send' ? targetTripId : myTripId;
    if (!shipmentId || !tripId) {
      toast.error(mode === 'send' ? 'Add your shipment details first' : 'Add your journey details first');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { trip_id: tripId, shipment_id: shipmentId, price_offered: numericPrice };
      if (conversationId) payload.conversation_id = conversationId;
      const response = await axios.post('/matches/request', payload);
      toast.success(response.data.existing ? 'Opening your existing request' : 'Match request sent');
      navigate(matchPath(response.data.match.id));
      onOpenChange(false);
      setPrice('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send match request');
    } finally {
      setSubmitting(false);
    }
  };

  const modeSwitch = canSend && canCarry && (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
      <button type="button" onClick={() => setMode('send')} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'send' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>Send my parcel</button>
      <button type="button" onClick={() => setMode('carry')} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'carry' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>Offer to carry</button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.25rem)] sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-orange-500" /> Request a match</DialogTitle>
          <DialogDescription>
            Build the shipment + journey details here. You do not need to leave the conversation or publish a separate listing first.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-orange-500" /></div>
        ) : existingMatches.length > 0 ? (
          <div className="space-y-3">
            <p>Your existing requests with {targetUserName || 'this user'}:</p>
            {existingMatches.map((match) => (
              <Button key={match.id} variant="outline" className="w-full" onClick={() => { onOpenChange(false); navigate(matchPath(match.id)); }}>
                Open request #{match.id.slice(0, 8)} · {matchStatusLabel(match)}
              </Button>
            ))}
          </div>
        ) : !canSend && !canCarry ? (
          <div className="rounded-xl border border-dashed p-5 text-center space-y-2">
            <Handshake className="h-9 w-9 mx-auto text-gray-300" />
            <p className="font-medium text-gray-800">Nothing from {targetUserName || 'this user'} to match yet</p>
            <p className="text-sm text-gray-500">They need either an active journey or an active shipment. Keep chatting and try again when one is available.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {modeSwitch}

            {mode === 'send' && canSend && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-800 flex items-center gap-2 mb-1.5"><Route className="h-4 w-4" /> Their journey</label>
                  <select value={targetTripId} onChange={(e) => setTargetTripId(e.target.value)} className="w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                    {options.target_trips.map((trip) => <option key={trip.id} value={trip.id}>{routeLabel(trip)}</option>)}
                  </select>
                  {selectedTrip && <div className="mt-2"><TransportModeBadge value={selectedTrip.transport_mode} /></div>}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-medium text-gray-800 flex items-center gap-2"><Package className="h-4 w-4" /> Your shipment</label>
                    <button type="button" className="text-xs font-semibold text-orange-600" onClick={() => setShowShipmentForm((v) => !v)}>{showShipmentForm ? 'Use saved shipment' : '+ Add another'}</button>
                  </div>
                  {options.my_shipments.length > 0 && !showShipmentForm && (
                    <select value={myShipmentId} onChange={(e) => setMyShipmentId(e.target.value)} className="w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                      {options.my_shipments.map((shipment) => <option key={shipment.id} value={shipment.id}>{routeLabel(shipment)} · {shipment.description || 'Shipment'}{shipment.visibility === 'private' ? ' · Match only' : ''}</option>)}
                    </select>
                  )}
                  {(showShipmentForm || !options.my_shipments.length) && (
                    <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3.5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800"><Plus className="h-4 w-4 text-orange-500" /> Add parcel details here</div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input placeholder="From" value={shipmentDraft.origin} onChange={(e) => setShipmentDraft((d) => ({ ...d, origin: e.target.value }))} />
                        <Input placeholder="To" value={shipmentDraft.destination} onChange={(e) => setShipmentDraft((d) => ({ ...d, destination: e.target.value }))} />
                      </div>
                      <Input placeholder="What are you sending?" value={shipmentDraft.description} onChange={(e) => setShipmentDraft((d) => ({ ...d, description: e.target.value }))} />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input type="number" min="0.1" step="0.1" inputMode="decimal" placeholder="Weight kg" value={shipmentDraft.weight} onChange={(e) => setShipmentDraft((d) => ({ ...d, weight: e.target.value }))} />
                        <select value={shipmentDraft.size} onChange={(e) => setShipmentDraft((d) => ({ ...d, size: e.target.value }))} className="min-h-10 rounded-md border border-input bg-white px-3 text-sm">
                          <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                        </select>
                        <Input type="date" min={today()} value={shipmentDraft.pickupDate} onChange={(e) => setShipmentDraft((d) => ({ ...d, pickupDate: e.target.value }))} />
                        <Input type="number" min="0" inputMode="decimal" placeholder="Value € (optional)" value={shipmentDraft.declaredValue} onChange={(e) => setShipmentDraft((d) => ({ ...d, declaredValue: e.target.value }))} />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input aria-label="Final recipient name" placeholder="Final recipient name" value={shipmentDraft.recipientName} onChange={(e) => setShipmentDraft((d) => ({ ...d, recipientName: e.target.value }))} />
                        <Input aria-label="Final recipient email" type="email" placeholder="Final recipient email" value={shipmentDraft.recipientEmail} onChange={(e) => setShipmentDraft((d) => ({ ...d, recipientEmail: e.target.value }))} />
                      </div>
                      <p className="text-xs text-gray-500">The delivery code goes only to this recipient after arrival. These details stay private.</p>
                      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" className="mt-0.5" checked={shipmentDraft.publish} onChange={(e) => setShipmentDraft((d) => ({ ...d, publish: e.target.checked }))} />
                        <span className="flex items-center gap-1">{shipmentDraft.publish ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Also show this shipment in Marketplace. Otherwise it stays match-only.</span>
                      </label>
                      <Button type="button" size="sm" onClick={createShipmentInline} disabled={creating === 'shipment'} className="bg-orange-500 hover:bg-orange-600 text-white">
                        {creating === 'shipment' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Save shipment details
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mode === 'carry' && canCarry && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-800 flex items-center gap-2 mb-1.5"><Package className="h-4 w-4" /> Shipment you can carry</label>
                  <select value={targetShipmentId} onChange={(e) => setTargetShipmentId(e.target.value)} className="w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                    {options.target_shipments.map((shipment) => <option key={shipment.id} value={shipment.id}>{routeLabel(shipment)} · {shipment.description || 'Shipment'}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-medium text-gray-800 flex items-center gap-2"><Route className="h-4 w-4" /> Your journey</label>
                    <button type="button" className="text-xs font-semibold text-orange-600" onClick={() => setShowJourneyForm((v) => !v)}>{showJourneyForm ? 'Use saved journey' : '+ Add another'}</button>
                  </div>
                  {options.my_trips.length > 0 && !showJourneyForm && (
                    <div className="space-y-2">
                      <select value={myTripId} onChange={(e) => setMyTripId(e.target.value)} className="w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                        {options.my_trips.map((trip) => <option key={trip.id} value={trip.id}>{routeLabel(trip)}{trip.visibility === 'private' ? ' · Match only' : ''}</option>)}
                      </select>
                      {selectedMyTrip && <TransportModeBadge value={selectedMyTrip.transport_mode} />}
                    </div>
                  )}
                  {(showJourneyForm || !options.my_trips.length) && (
                    <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3.5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800"><Plus className="h-4 w-4 text-orange-500" /> Add journey details here</div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input placeholder="From" value={journeyDraft.origin} onChange={(e) => setJourneyDraft((d) => ({ ...d, origin: e.target.value }))} />
                        <Input placeholder="To" value={journeyDraft.destination} onChange={(e) => setJourneyDraft((d) => ({ ...d, destination: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input type="date" min={today()} value={journeyDraft.departureDate} onChange={(e) => setJourneyDraft((d) => ({ ...d, departureDate: e.target.value }))} />
                        <Input type="time" value={journeyDraft.departureTime} onChange={(e) => setJourneyDraft((d) => ({ ...d, departureTime: e.target.value }))} />
                        <select value={journeyDraft.transportMode} onChange={(e) => setJourneyDraft((d) => ({ ...d, transportMode: e.target.value }))} className="min-h-10 rounded-md border border-input bg-white px-2 text-sm">
                          <option value="plane">✈ Plane</option><option value="car">🚗 Car</option><option value="train">🚆 Train</option><option value="bus">🚌 Bus</option>
                        </select>
                        <Input type="number" min="0.1" step="0.1" inputMode="decimal" placeholder="Available kg" value={journeyDraft.availableWeight} onChange={(e) => setJourneyDraft((d) => ({ ...d, availableWeight: e.target.value }))} />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <select value={journeyDraft.capacitySize} onChange={(e) => setJourneyDraft((d) => ({ ...d, capacitySize: e.target.value }))} className="min-h-10 rounded-md border border-input bg-white px-3 text-sm">
                          <option value="small">Small parcel space</option><option value="medium">Medium parcel space</option><option value="large">Large parcel space</option>{journeyDraft.transportMode === 'car' && <option value="xlarge">Extra large space</option>}
                        </select>
                        <label className="flex items-center gap-2 px-3 min-h-10 rounded-md border bg-white text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={journeyDraft.publish} onChange={(e) => setJourneyDraft((d) => ({ ...d, publish: e.target.checked }))} /> Show in Marketplace
                        </label>
                      </div>
                      {journeyDraft.publish && (
                        <div className="grid grid-cols-2 gap-2">
                          <select value={journeyDraft.pricingModel} onChange={(e) => setJourneyDraft((d) => ({ ...d, pricingModel: e.target.value }))} className="min-h-10 rounded-md border border-input bg-white px-3 text-sm">
                            <option value="fixed">Fixed price</option><option value="per_kg">Per kg</option>
                          </select>
                          <Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Marketplace price €" value={journeyDraft.price} onChange={(e) => setJourneyDraft((d) => ({ ...d, price: e.target.value }))} />
                        </div>
                      )}
                      <p className="text-xs text-gray-500">If you leave Marketplace off, the journey exists only for this transaction and your own account.</p>
                      <Button type="button" size="sm" onClick={createJourneyInline} disabled={creating === 'journey'} className="bg-orange-500 hover:bg-orange-600 text-white">
                        {creating === 'journey' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Save journey details
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-800 mb-1.5 block">Agreed / offered price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="e.g. 25" className="pl-8" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">The match is created only when both a shipment and a journey are attached. Payment starts only after acceptance.</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" onClick={submit} disabled={submitting || (mode === 'send' ? !myShipmentId : !myTripId)} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Handshake className="h-4 w-4 mr-2" />}
                Send request
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MatchRequestDialog;
