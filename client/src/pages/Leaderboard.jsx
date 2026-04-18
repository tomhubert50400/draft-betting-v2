import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchLeaderboard } from '../api/users';
import { fetchMatches } from '../api/matches';
import { useAuth } from '../contexts/AuthContext';
import BadgeDisplay from '../components/BadgeDisplay';

export default function Leaderboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState({ kind: 'all' }); // 'all' | { kind: 'series', id } | { kind: 'match', id }

  const { data: matches } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
  });

  // Build filter options grouped by series, sorted by date (newest first)
  const filterOptions = useMemo(() => {
    const list = Array.isArray(matches) ? matches : [];
    const seriesMap = new Map();
    const standaloneMatches = [];
    for (const m of list) {
      if (m.status !== 'completed') continue;
      if (m.series_id && m.best_of !== 'bo1') {
        if (!seriesMap.has(m.series_id)) seriesMap.set(m.series_id, []);
        seriesMap.get(m.series_id).push(m);
      } else {
        standaloneMatches.push(m);
      }
    }

    const fmtDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    };

    const seriesOpts = [...seriesMap.entries()]
      .map(([id, ms]) => {
        ms.sort((a, b) => (a.game_number || 1) - (b.game_number || 1));
        const lastDate = ms[ms.length - 1].completed_at || ms[ms.length - 1].scheduled_time;
        return {
          kind: 'series',
          id,
          label: `${ms[0].team1} vs ${ms[0].team2} (${ms[0].best_of?.toUpperCase()})  ·  ${fmtDate(lastDate)}`,
          sortKey: lastDate || '',
        };
      })
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    const matchOpts = standaloneMatches
      .map((m) => ({
        kind: 'match',
        id: m.id,
        label: `${m.team1} vs ${m.team2}${m.game_number ? ` G${m.game_number}` : ''}  ·  ${fmtDate(m.completed_at || m.scheduled_time)}`,
        sortKey: m.completed_at || m.scheduled_time || '',
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    return { series: seriesOpts, matches: matchOpts };
  }, [matches]);

  const queryParams = filter.kind === 'all' ? {} : { [`${filter.kind}_id`]: filter.id };

  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard', filter.kind, filter.id],
    queryFn: () => fetchLeaderboard(queryParams),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-accent-pink text-sm">Failed to load leaderboard</p>
      </div>
    );
  }

  const rows = Array.isArray(leaderboard) ? leaderboard : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Leaderboard</h1>
        <p className="text-text-secondary text-sm mt-1">Top predictors ranked by score</p>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <label className="block text-xs uppercase tracking-wider text-text-muted mb-2">Filter</label>
        <select
          value={filter.kind === 'all' ? 'all' : `${filter.kind}:${filter.id}`}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'all') return setFilter({ kind: 'all' });
            const [kind, id] = v.split(':');
            setFilter({ kind, id });
          }}
          className="w-full px-3 py-2 rounded-lg bg-bg-card border border-white/10 text-text-primary text-sm focus:outline-none focus:border-accent-purple/50"
        >
          <option value="all">All time</option>
          {filterOptions.series.length > 0 && (
            <optgroup label="Series">
              {filterOptions.series.map((o) => (
                <option key={`series:${o.id}`} value={`series:${o.id}`}>{o.label}</option>
              ))}
            </optgroup>
          )}
          {filterOptions.matches.length > 0 && (
            <optgroup label="Matches">
              {filterOptions.matches.map((o) => (
                <option key={`match:${o.id}`} value={`match:${o.id}`}>{o.label}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-white/5 p-8 text-center">
          <p className="text-text-muted text-sm">No rankings yet. Be the first to bet!</p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-white/5 overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_5rem_5rem_auto] gap-4 px-4 py-3 border-b border-white/5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Bets</span>
            <span>Badges</span>
          </div>

          {/* Rows */}
          {rows.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = user && String(entry.id) === String(user.id);

            return (
              <div
                key={entry.id}
                className={`grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[3rem_1fr_5rem_5rem_auto] gap-4 px-4 py-3 items-center border-b border-white/5 last:border-b-0 transition-colors ${
                  isCurrentUser ? 'bg-accent-purple/5' : 'hover:bg-bg-hover/50'
                }`}
              >
                {/* Rank */}
                <span className={`text-sm font-bold ${
                  rank === 1 ? 'text-amber-400' :
                  rank === 2 ? 'text-gray-300' :
                  rank === 3 ? 'text-amber-600' :
                  'text-text-muted'
                }`}>
                  #{rank}
                </span>

                {/* Player */}
                <Link
                  to={`/profile/${entry.id}`}
                  className="flex items-center gap-2 min-w-0"
                >
                  <img
                    src={entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.discord_username)}&background=7c3aed&color=fff&size=32`}
                    alt=""
                    className="w-7 h-7 rounded-full ring-1 ring-white/10 shrink-0"
                  />
                  <span className={`text-sm font-medium truncate ${
                    isCurrentUser ? 'text-accent-purple' : 'text-text-primary'
                  }`}>
                    {entry.discord_username}
                  </span>
                </Link>

                {/* Score + Bets (mobile: inline, desktop: separate columns) */}
                <div className="flex items-center gap-3 sm:contents">
                  <span className="text-sm font-bold text-text-primary sm:text-right">
                    {entry.total_score ?? entry.score ?? 0}
                  </span>
                  <span className="text-xs text-text-muted sm:text-right hidden sm:block">
                    {entry.total_bets ?? entry.bet_count ?? 0}
                  </span>
                </div>

                {/* Badges (desktop only) */}
                <div className="hidden sm:block">
                  <BadgeDisplay badges={entry.badges || []} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
