import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { webSocketUrl } from '../api/client';

export function useWebSocket() {
  const ws = useRef(null);
  const connectRef = useRef(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    ws.current = new WebSocket(webSocketUrl());

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'match_updated' || data.type === 'match_created' || data.type === 'match_deleted') {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
    };

    ws.current.onclose = () => {
      setTimeout(() => connectRef.current?.(), 3000);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [queryClient]);

  useEffect(() => {
    connectRef.current = connect;
    connect();
    return () => { ws.current?.close(); };
  }, [connect]);
}
