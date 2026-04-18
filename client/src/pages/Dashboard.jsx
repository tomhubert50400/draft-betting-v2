import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '../api/matches';
import { fetchMyBets } from '../api/bets';
import { useAuth } from '../contexts/AuthContext';
import MatchCard from '../components/MatchCard';
import SeriesCard from '../components/SeriesCard';

function groupBySeries(matches) {
  // Returns array of either { type: 'single', match } or { type: 'series', matches }
  const bySeries = new Map();
  const singles = [];
  for (const m of matches) {
    if (m.series_id && m.best_of && m.best_of !== 'bo1') {
      if (!bySeries.has(m.series_id)) bySeries.set(m.series_id, []);
      bySeries.get(m.series_id).push(m);
    } else {
      singles.push(m);
    }
  }
  const groups = [];
  for (const [, ms] of bySeries) {
    if (ms.length === 1) groups.push({ type: 'single', match: ms[0], sortKey: ms[0].scheduled_time });
    else groups.push({ type: 'series', matches: ms, sortKey: ms[0].scheduled_time });
  }
  for (const m of singles) groups.push({ type: 'single', match: m, sortKey: m.scheduled_time });
  return groups.sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));
}

function MatchSection({ title, matches, emptyText, betMatchIds }) {
  if (matches.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
        <p className="text-text-muted text-sm bg-bg-card rounded-xl p-6 text-center border border-white/5">
          {emptyText}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {groupBySeries(matches).map((g) =>
          g.type === 'series' ? (
            <SeriesCard
              key={g.matches[0].series_id}
              matches={g.matches}
              betMatchIds={betMatchIds}
            />
          ) : (
            <MatchCard
              key={g.match.id}
              match={g.match}
              hasBet={betMatchIds?.has(g.match.id)}
            />
          )
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: matches, isLoading, error } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
  });
  const { data: myBets } = useQuery({
    queryKey: ['myBets'],
    queryFn: fetchMyBets,
    enabled: !!user,
  });
  const betMatchIds = new Set((myBets || []).map((b) => b.match_id));
  const betsByMatch = new Map((myBets || []).map((b) => [b.match_id, b]));

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
        <p className="text-accent-pink text-sm">Failed to load matches</p>
        <p className="text-text-muted text-xs mt-1">{error.message}</p>
      </div>
    );
  }

  const allMatches = Array.isArray(matches) ? matches : [];
  const open = allMatches.filter((m) => m.status === 'open');
  const locked = allMatches.filter((m) => m.status === 'locked');
  const completed = allMatches
    .filter((m) => m.status === 'completed')
    .slice(0, 10); // Show last 10

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Matches</h1>
        <p className="text-text-secondary text-sm mt-1">
          Predict champion picks and earn points
        </p>
      </div>

      <MatchSection
        title="Upcoming"
        matches={open}
        emptyText="No upcoming matches right now"
        betMatchIds={betMatchIds}
      />
      <MatchSection
        title="In Progress"
        matches={locked}
        emptyText="No matches in progress"
        betMatchIds={betMatchIds}
      />
      <MatchSection
        title="Recent Results"
        matches={completed}
        emptyText="No completed matches yet"
        betMatchIds={betMatchIds}
      />
    </div>
  );
}
