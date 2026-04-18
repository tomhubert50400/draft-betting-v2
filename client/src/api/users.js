import { apiFetch } from './client';
export const fetchLeaderboard = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.match_id) params.set('match_id', filters.match_id);
  if (filters.series_id) params.set('series_id', filters.series_id);
  const qs = params.toString();
  return apiFetch(`/api/users/leaderboard${qs ? `?${qs}` : ''}`);
};
export const fetchUser = (id) => apiFetch(`/api/users/${id}`);
export const fetchUserBets = (id) => apiFetch(`/api/users/${id}/bets`);
export const fetchChampionStats = (id) => apiFetch(`/api/users/${id}/champion-stats`);
