import { apiFetch } from './client';
export const fetchLeaderboard = () => apiFetch('/api/users/leaderboard');
export const fetchUser = (id) => apiFetch(`/api/users/${id}`);
export const fetchUserBets = (id) => apiFetch(`/api/users/${id}/bets`);
export const fetchChampionStats = (id) => apiFetch(`/api/users/${id}/champion-stats`);
