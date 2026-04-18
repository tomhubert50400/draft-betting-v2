import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchMatches } from '../api/matches';
import {
  createMatch,
  deleteMatch,
  lockMatch,
  unlockMatch,
  triggerSync,
  fetchSettings,
  updateSettings,
  fetchEvents,
  createEvent,
} from '../api/admin';

function MatchesTab() {
  const queryClient = useQueryClient();
  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
  });

  const [form, setForm] = useState({
    team1: '',
    team2: '',
    best_of: 'bo1',
    scheduled_time: '',
    event_id: '',
  });

  const createMut = useMutation({
    mutationFn: createMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      setForm({ team1: '', team2: '', best_of: 'bo1', scheduled_time: '', event_id: '' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });

  const lockMut = useMutation({
    mutationFn: lockMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });

  const unlockMut = useMutation({
    mutationFn: unlockMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.team1.trim() || !form.team2.trim()) return;
    createMut.mutate({
      team1: form.team1.trim(),
      team2: form.team2.trim(),
      best_of: form.best_of,
      scheduled_time: form.scheduled_time || null,
      event_id: form.event_id ? Number(form.event_id) : null,
    });
  };

  const allMatches = Array.isArray(matches) ? matches : [];

  return (
    <div className="space-y-6">
      {/* Create match form */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Create Match</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Team 1"
              value={form.team1}
              onChange={(e) => setForm({ ...form, team1: e.target.value })}
              className="px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
            />
            <input
              type="text"
              placeholder="Team 2"
              value={form.team2}
              onChange={(e) => setForm({ ...form, team2: e.target.value })}
              className="px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={form.best_of}
              onChange={(e) => setForm({ ...form, best_of: e.target.value })}
              className="px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm focus:outline-none focus:border-accent-purple/50"
            >
              <option value="bo1">BO1</option>
              <option value="bo3">BO3</option>
              <option value="bo5">BO5</option>
            </select>
            <input
              type="datetime-local"
              value={form.scheduled_time}
              onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
              className="px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
            />
            <input
              type="text"
              placeholder="Event ID (opt)"
              value={form.event_id}
              onChange={(e) => setForm({ ...form, event_id: e.target.value })}
              className="px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating...' : 'Create Match'}
          </button>
          {createMut.isError && (
            <p className="text-accent-pink text-xs">{createMut.error.message}</p>
          )}
        </form>
      </div>

      {/* Match list */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">All Matches</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allMatches.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">No matches</p>
        ) : (
          <div className="space-y-2">
            {allMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg bg-bg-primary/50 border border-white/5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {m.team1} vs {m.team2}
                  </p>
                  <p className="text-xs text-text-muted">
                    {m.status} · {m.best_of?.toUpperCase()} · Game {m.game_number || 1}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {m.status === 'open' && (
                    <button
                      onClick={() => lockMut.mutate(m.id)}
                      className="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    >
                      Lock
                    </button>
                  )}
                  {m.status === 'locked' && (
                    <button
                      onClick={() => unlockMut.mutate(m.id)}
                      className="px-2 py-1 text-xs rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
                    >
                      Unlock
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${m.team1} vs ${m.team2}?`)) {
                        deleteMut.mutate(m.id);
                      }
                    }}
                    className="px-2 py-1 text-xs rounded bg-accent-pink/20 text-accent-pink hover:bg-accent-pink/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  const createMut = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setName('');
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMut.mutate(name.trim());
  };

  const eventList = Array.isArray(events) ? events : [];

  return (
    <div className="space-y-6">
      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Create Event</h3>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="px-4 py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>

      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Events</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : eventList.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">No events</p>
        ) : (
          <div className="space-y-2">
            {eventList.map((ev) => (
              <div
                key={ev.id}
                className="p-3 rounded-lg bg-bg-primary/50 border border-white/5"
              >
                <p className="text-sm font-medium text-text-primary">{ev.name}</p>
                <p className="text-xs text-text-muted">ID: {ev.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const [lockDelay, setLockDelay] = useState('');

  const updateMut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const syncMut = useMutation({
    mutationFn: triggerSync,
  });

  const handleSave = (e) => {
    e.preventDefault();
    updateMut.mutate({ lock_delay_minutes: Number(lockDelay) });
  };

  // Sync lock delay from settings when data loads
  const currentDelay = settings?.lock_delay_minutes;
  if (currentDelay != null && lockDelay === '') {
    setLockDelay(String(currentDelay));
  }

  return (
    <div className="space-y-6">
      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Settings</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Lock Delay (minutes before match)
              </label>
              <input
                type="number"
                min="0"
                value={lockDelay}
                onChange={(e) => setLockDelay(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm focus:outline-none focus:border-accent-purple/50"
              />
            </div>
            <button
              type="submit"
              disabled={updateMut.isPending}
              className="px-4 py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {updateMut.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            {updateMut.isSuccess && (
              <p className="text-green-400 text-xs">Saved!</p>
            )}
          </form>
        )}
      </div>

      <div className="bg-bg-card rounded-xl border border-white/5 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Sync</h3>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan text-sm font-semibold hover:bg-accent-cyan/30 transition-colors disabled:opacity-50"
        >
          {syncMut.isPending ? 'Syncing...' : 'Trigger Sync'}
        </button>
        {syncMut.isSuccess && (
          <p className="text-green-400 text-xs mt-2">Sync triggered</p>
        )}
        {syncMut.isError && (
          <p className="text-accent-pink text-xs mt-2">{syncMut.error.message}</p>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'events', label: 'Events' },
  { key: 'settings', label: 'Settings' },
];

export default function Admin() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('matches');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card rounded-xl p-1 border border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-gradient-accent text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'matches' && <MatchesTab />}
      {activeTab === 'events' && <EventsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}
