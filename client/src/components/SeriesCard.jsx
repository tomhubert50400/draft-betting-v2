import { useState } from 'react';
import { Link } from 'react-router-dom';
import MatchCard from './MatchCard';

const STATUS_STYLES = {
  open: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30',
  locked: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-text-muted/20 text-text-muted border-text-muted/30',
};

export default function SeriesCard({ matches, betMatchIds }) {
  const [expanded, setExpanded] = useState(false);

  // Sort by game number
  const sorted = [...matches].sort((a, b) => (a.game_number || 1) - (b.game_number || 1));
  const first = sorted[0];

  // Compute series score from completed games
  let t1 = 0, t2 = 0;
  for (const m of sorted) {
    if (m.status === 'completed' && m.winner === 'team1') t1++;
    else if (m.status === 'completed' && m.winner === 'team2') t2++;
  }

  // Overall status: open if any open, else locked if any locked, else completed
  const hasOpen = sorted.some((m) => m.status === 'open');
  const hasLocked = sorted.some((m) => m.status === 'locked');
  const overallStatus = hasOpen ? 'open' : hasLocked ? 'locked' : 'completed';
  const statusLabel = overallStatus === 'open' ? 'Open' : overallStatus === 'locked' ? 'In progress' : 'Completed';

  const formatLabel = first.best_of?.toUpperCase() || '';
  const totalGames = sorted.length;

  return (
    <div className="bg-bg-card rounded-xl border border-white/5 hover:border-accent-purple/30 transition-all overflow-hidden">
      {/* Summary header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 text-left hover:bg-bg-hover/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[overallStatus]}`}>
              {statusLabel}
            </span>
            {formatLabel && (
              <span className="text-xs text-text-muted font-medium">{formatLabel}</span>
            )}
            <span className="text-xs text-text-secondary font-medium bg-bg-hover px-2 py-0.5 rounded">
              {totalGames} {totalGames > 1 ? 'games' : 'game'}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <span className="text-lg font-bold text-text-primary">{first.team1}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <span className={`text-lg font-bold ${t1 > t2 ? 'text-accent-cyan' : 'text-text-muted'}`}>{t1}</span>
            <span className="text-text-muted text-xs">-</span>
            <span className={`text-lg font-bold ${t2 > t1 ? 'text-accent-cyan' : 'text-text-muted'}`}>{t2}</span>
          </div>
          <div className="flex-1 text-left">
            <span className="text-lg font-bold text-text-primary">{first.team2}</span>
          </div>
        </div>
      </button>

      {/* Expanded games list */}
      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-2 bg-bg-primary/30">
          {(() => {
            // Pre-compute running score per game
            let r1 = 0, r2 = 0;
            return sorted.map((m) => {
              if (m.status === 'completed') {
                if (m.winner === 'team1') r1++;
                else if (m.winner === 'team2') r2++;
              }
              return { match: m, score1: r1, score2: r2 };
            });
          })().map(({ match: m, score1, score2 }) => (
            <Link
              key={m.id}
              to={`/match/${m.id}`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-bg-card hover:bg-bg-hover transition-colors border border-white/5"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-bold text-accent-purple bg-accent-purple/10 px-2 py-1 rounded whitespace-nowrap">
                  Game {m.game_number || 1}
                </span>
                {m.status === 'completed' ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className={`font-semibold ${m.winner === 'team1' ? 'text-green-400' : 'text-accent-pink'}`}>{m.team1}</span>
                    <span className={`font-bold ${score1 > score2 ? 'text-green-400' : 'text-text-muted'}`}>{score1}</span>
                    <span className="text-text-muted text-xs">-</span>
                    <span className={`font-bold ${score2 > score1 ? 'text-green-400' : 'text-text-muted'}`}>{score2}</span>
                    <span className={`font-semibold ${m.winner === 'team2' ? 'text-green-400' : 'text-accent-pink'}`}>{m.team2}</span>
                  </div>
                ) : m.status === 'locked' ? (
                  <span className="text-xs text-amber-400 font-semibold">In progress</span>
                ) : (
                  <span className="text-xs text-accent-cyan font-semibold">Open</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {betMatchIds?.has(m.id) && (
                  <span className="text-[10px] font-semibold text-green-400">✓ Bet</span>
                )}
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
