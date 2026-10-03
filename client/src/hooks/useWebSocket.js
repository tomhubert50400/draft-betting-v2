import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectMatchSocket } from './matchSocket';

export function useWebSocket() {
  const queryClient = useQueryClient();
  useEffect(() => connectMatchSocket(queryClient), [queryClient]);
}
