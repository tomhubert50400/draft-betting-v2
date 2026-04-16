import { apiFetch } from './client';
export const placeBet = (matchId, predictions) =>
  apiFetch('/api/bets', { method: 'POST', body: JSON.stringify({ matchId, predictions }) });
export const fetchMyBets = () => apiFetch('/api/bets/me');
