export const activeMatchStatuses = ['pending', 'accepted', 'payment_pending', 'paid', 'in_progress'];

export const matchPath = (id) => `/match-requests?match=${encodeURIComponent(id)}`;

// Other travelers may still have pending requests for an assigned shipment.
export const shipmentMatch = (matches, shipmentId) => {
  const candidates = matches.filter(match => match.shipment_id === shipmentId && [...activeMatchStatuses, 'completed'].includes(match.status));
  return candidates.find(match => match.status !== 'pending') || candidates[0] || null;
};

export const matchActions = (match, userId) => {
  const participant = Boolean(userId) && [match.sender_id, match.traveler_id].includes(userId);
  const paid = ['escrowed', 'released'].includes(match.payment_status) || ['paid', 'in_progress', 'completed'].includes(match.status);
  return {
    canRespond: participant && match.status === 'pending' && match.requested_by !== userId,
    canPay: participant && match.sender_id === userId && !paid && ['accepted', 'payment_pending'].includes(match.status) && ['unpaid', 'payment_pending'].includes(match.payment_status),
    canMessage: participant,
    canTrack: participant && paid,
  };
};

export const matchStatusLabel = (match, userId) => {
  if (match.status === 'completed') return 'Completed';
  if (match.status === 'in_progress') return 'Delivery in progress';
  if (match.status === 'paid' || ['escrowed', 'released'].includes(match.payment_status)) return 'Paid — ready for pickup';
  if (['accepted', 'payment_pending'].includes(match.status)) {
    return userId && userId === match.traveler_id ? 'Waiting for sender payment' : 'Match accepted — awaiting payment';
  }
  if (match.status === 'pending') return userId && match.requested_by === userId ? 'Request sent — awaiting response' : 'Pending request';
  return match.status === 'rejected' ? 'Declined' : match.status === 'cancelled' ? 'Cancelled' : match.status;
};

export const shipmentStatusLabel = (shipment, match) => {
  if (shipment.status === 'matched') {
    if (match) return matchStatusLabel(match);
    return 'Traveler assigned — payment not confirmed';
  }
  return ({ pending: 'Pending', picked_up: 'Package picked up', in_transit: 'In transit', arrived: 'Arrived at destination', delivered: 'Delivered', cancelled: 'Cancelled' })[shipment.status] || shipment.status;
};

export const relevantMatches = (matches, tripId, shipmentId) => matches.filter((match) =>
  activeMatchStatuses.includes(match.status) && (!tripId || match.trip_id === tripId) && (!shipmentId || match.shipment_id === shipmentId)
);
