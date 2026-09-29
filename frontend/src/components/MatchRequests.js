import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, MessageCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { BackButton } from './BackButton';
import { matchActions, matchPath, matchStatusLabel } from '../lib/matchLifecycle';
import { openMatchConversation } from '../lib/messaging';

const MatchRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedId = params.get('match');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const actionRunning = useRef(false);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await axios.get(selectedId ? `/bookings/${selectedId}` : '/matches/requests');
      setRequests(selectedId ? [response.data] : response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load your requests. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    fetchRequests();
    const refresh = () => fetchRequests();
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 20000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, [fetchRequests]);

  const respond = async (id, action) => {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(id);
    try {
      await axios.put(`/matches/${id}/${action}`);
      toast.success(action === 'accept' ? 'Match accepted — awaiting sender payment' : action === 'cancel' ? 'Unpaid booking cancelled' : 'Request declined');
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update this request');
      await fetchRequests();
    } finally {
      actionRunning.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
      <BackButton fallback="/dashboard" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Requests / Matches</h1>
        {selectedId && <Button variant="outline" onClick={() => navigate('/match-requests')}>View all requests</Button>}
      </div>
      <p className="text-gray-600">Reopen requests, message each other, pay after acceptance, and follow delivery here.</p>
      {loading ? <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading requests" /> : error ? (
        <Card><CardContent className="p-6"><p role="alert">{error}</p><Button onClick={fetchRequests}>Retry</Button></CardContent></Card>
      ) : requests.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><p>No requests yet. Requests you send and receive will stay here.</p></CardContent></Card>
      ) : requests.map(({ match, shipment, trip, sender, traveler }) => {
        const otherUser = match.sender_id === user?.id ? traveler : sender;
        const actions = matchActions(match, user?.id);
        const canCancel = [match.sender_id, match.traveler_id].includes(user?.id)
          && (match.status === 'accepted' || (match.status === 'pending' && match.requested_by === user?.id))
          && !match.payment_intent_id
          && !['paid', 'escrowed', 'released', 'refunded'].includes(match.payment_status);
        return (
          <Card key={match.id} data-testid={`match-${match.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />{shipment?.description || 'Shipment unavailable'}</CardTitle>
              <p>{otherUser?.full_name || 'Participant'} · {match.sender_id === user?.id ? 'Your traveler' : 'Your sender'}</p>
              <div><Badge variant="outline">{matchStatusLabel(match, user?.id)}</Badge></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{shipment?.origin?.address} → {shipment?.destination?.address}</p>
              {trip && <p className="text-sm text-gray-600">Journey: {trip.origin?.address} → {trip.destination?.address}</p>}
              <p className="font-semibold">Agreed / offered price: ${Number(match.price_agreed).toFixed(2)}</p>
              <div className="flex flex-wrap gap-2">
                {!selectedId && <Button variant="outline" onClick={() => navigate(matchPath(match.id))}>Open request</Button>}
                {actions.canMessage && <Button variant="outline" onClick={() => openMatchConversation(match.id, navigate)}><MessageCircle className="h-4 w-4 mr-2" />Message</Button>}
                {actions.canRespond && <>
                  <Button disabled={busy === match.id} onClick={() => respond(match.id, 'accept')} data-testid={`accept-match-${match.id}`}>Accept</Button>
                  <Button variant="outline" disabled={busy === match.id} onClick={() => respond(match.id, 'reject')} data-testid={`reject-match-${match.id}`}>Decline</Button>
                </>}
                {canCancel && <Button variant="outline" disabled={busy === match.id} onClick={() => respond(match.id, 'cancel')}>Cancel booking</Button>}
                {actions.canPay && <Button onClick={() => navigate(`/booking/${match.id}/payment`)}>Pay Now</Button>}
                {actions.canTrack && <Button onClick={() => navigate(`/shipment/${match.shipment_id}`)}>Track shipment</Button>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
export default MatchRequests;
