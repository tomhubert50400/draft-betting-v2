import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChampions } from '../contexts/ChampionsContext';
import { fetchPlayerChampionStats } from '../api/players';
import { getChampionsForRole } from '../data/championRoles';

const buildFilters = (role) => [
  { id: 'role', label: role ? `${role} champs` : 'Role' },
  { id: 'all', label: 'All' },
  { id: 'preferred', label: 'Preferred' },
];

export default function ChampionSearch({ role, playerName, onSelect, onClose }) {
  const { champions, getChampionImageUrl, loading } = useChampions();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('role');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const { data: champStats } = useQuery({
    queryKey: ['playerChampionStats', playerName],
    queryFn: () => fetchPlayerChampionStats(playerName),
    enabled: !!playerName && filter === 'preferred',
    staleTime: 60_000,
  });

  const roleChampionNames = useMemo(() => {
    if (!role) return null;
    return new Set(getChampionsForRole(role));
  }, [role]);

  const filtered = useMemo(() => {
    let list = champions;

    if (filter === 'role' && roleChampionNames) {
      list = list.filter((c) => roleChampionNames.has(c.name));
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    if (filter === 'preferred') {
      if (!champStats?.length) return [];
      const statsMap = new Map(champStats.map((s) => [s.id, s]));
      const scoreOf = (s) => s.picks * (1 + s.wins / s.picks);
      return list
        .filter((c) => statsMap.get(c.id)?.picks > 0)
        .sort((a, b) => {
          const sa = scoreOf(statsMap.get(a.id));
          const sb = scoreOf(statsMap.get(b.id));
          if (sb !== sa) return sb - sa;
          return a.name.localeCompare(b.name);
        });
    }

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, roleChampionNames, search, filter, champStats]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-bg-secondary rounded-2xl p-8 text-text-secondary">
          Loading champions...
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-text-primary">
            {playerName ? `${playerName} (${role})` : role ? `Select ${role} Champion` : 'Select Champion'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search champion..."
            className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/30"
          />
        </div>

        {/* Filter tabs */}
        <div className="px-4 pb-2 flex gap-1.5">
          {buildFilters(role).map((f) => {
            const disabled = f.id === 'preferred' && !playerName;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => !disabled && setFilter(f.id)}
                disabled={disabled}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-gradient-accent text-white'
                    : disabled
                      ? 'bg-bg-primary/40 text-text-muted/40 cursor-not-allowed'
                      : 'bg-bg-primary/60 text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-8">No champions found</p>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {filtered.map((champ) => {
                const stat = filter === 'preferred' && champStats
                  ? champStats.find((s) => s.id === champ.id)
                  : null;
                return (
                  <button
                    key={champ.id}
                    onClick={() => onSelect(champ)}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-bg-hover transition-colors group relative"
                  >
                    <img
                      src={getChampionImageUrl(champ.id)}
                      alt={champ.name}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg ring-1 ring-white/10 group-hover:ring-accent-purple/50 transition-all"
                      loading="lazy"
                    />
                    <span className="text-[10px] text-text-muted group-hover:text-text-primary leading-tight text-center truncate w-full">
                      {champ.name}
                    </span>
                    {stat && stat.picks > 0 && (
                      <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-accent-cyan bg-bg-primary/90 px-1 rounded leading-tight">
                        {stat.picks}g {Math.round(100 * stat.wins / stat.picks)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear selection */}
        <div className="px-4 py-2 border-t border-white/5">
          <button
            onClick={() => onSelect(null)}
            className="w-full py-2 text-sm text-text-muted hover:text-accent-pink transition-colors"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}
