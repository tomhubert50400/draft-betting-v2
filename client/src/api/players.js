import { apiFetch } from './client';
export const fetchPlayerChampionStats = (name) =>
  apiFetch(`/api/players/${encodeURIComponent(name)}/champion-stats`);
