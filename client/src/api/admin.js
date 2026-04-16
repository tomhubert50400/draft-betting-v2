import { apiFetch } from './client';
export const createMatch = (data) =>
  apiFetch('/api/admin/matches', { method: 'POST', body: JSON.stringify(data) });
export const deleteMatch = (id) =>
  apiFetch(`/api/admin/matches/${id}`, { method: 'DELETE' });
export const lockMatch = (id) =>
  apiFetch(`/api/admin/matches/${id}/lock`, { method: 'POST' });
export const unlockMatch = (id) =>
  apiFetch(`/api/admin/matches/${id}/unlock`, { method: 'POST' });
export const triggerSync = () =>
  apiFetch('/api/admin/sync', { method: 'POST' });
export const fetchSettings = () => apiFetch('/api/admin/settings');
export const updateSettings = (data) =>
  apiFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
export const fetchEvents = () => apiFetch('/api/admin/events');
export const createEvent = (name) =>
  apiFetch('/api/admin/events', { method: 'POST', body: JSON.stringify({ name }) });
