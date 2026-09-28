import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { openConversationWith } from '../lib/messaging';

/**
 * Legacy /messages route — now a thin redirector into the unified, match-free
 * direct-messaging system.
 *  - /messages?user=<id>  -> immediately open (or reuse) a 1:1 conversation
 *  - /messages            -> the user's conversations list
 * Messaging no longer requires a shipment match.
 */
const MessagingHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');

  useEffect(() => {
    if (targetUserId) {
      openConversationWith(targetUserId, navigate, { replace: true });
    } else {
      navigate('/direct-messages', { replace: true });
    }
    // eslint-disable-next-line
  }, [targetUserId]);

  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="messaging-redirect">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
    </div>
  );
};

export default MessagingHub;
