import { apiFetch } from './client';
export const fetchMatches = () => apiFetch('/api/matches');
export const fetchMatch = (id) => apiFetch(`/api/matches/${id}`);
