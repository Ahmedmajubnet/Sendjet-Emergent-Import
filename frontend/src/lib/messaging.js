import axios from 'axios';
import { toast } from 'sonner';

// Single source of truth for opening a 1:1 conversation.
// Creates the conversation if it doesn't exist, reuses it if it does,
// then navigates to the direct-messages thread. Used by both the
// Marketplace cards and the User Profile "Send Message" button so the
// two entry points share identical behaviour.
export const openConversationWith = async (recipientId, navigate, { replace = false } = {}) => {
  if (!recipientId) return;
  try {
    const res = await axios.post(`/conversations/start/${recipientId}`);
    navigate(`/direct-messages/${res.data.conversation_id}`, { replace });
  } catch (error) {
    if (error.response?.status === 400) {
      toast.error("You can't message yourself");
    } else {
      toast.error('Failed to start conversation');
    }
  }
};
