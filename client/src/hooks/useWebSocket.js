import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const ws = useRef(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('token');
    const url = `${protocol}://${window.location.host}/ws${token ? `?token=${token}` : ''}`;

    ws.current = new WebSocket(url);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'match_updated' || data.type === 'match_created' || data.type === 'match_deleted') {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
    };

    ws.current.onclose = () => {
      setTimeout(connect, 3000);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => { ws.current?.close(); };
  }, [connect]);
}
