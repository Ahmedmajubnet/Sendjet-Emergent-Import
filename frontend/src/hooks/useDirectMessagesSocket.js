import { useEffect, useRef, useState } from 'react';
import { buildWebSocketUrl } from '../lib/websocket';

export const useDirectMessagesSocket = (onEvent, enabled = true) => {
  const callbackRef = useRef(onEvent);
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const pingRef = useRef(null);
  const stoppedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const socket = new WebSocket(buildWebSocketUrl('/api/ws/direct-messages', { token }));
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== 'pong') callbackRef.current?.(payload);
        } catch (error) {
          console.warn('Invalid direct-message WebSocket payload', error);
        }
      };

      socket.onerror = () => socket.close();
      socket.onclose = () => {
        setConnected(false);
        clearInterval(pingRef.current);
        if (!stoppedRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      stoppedRef.current = true;
      clearTimeout(reconnectRef.current);
      clearInterval(pingRef.current);
      if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [enabled]);

  return connected;
};

export default useDirectMessagesSocket;
