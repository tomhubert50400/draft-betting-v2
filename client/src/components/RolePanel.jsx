import { useQuery } from '@tanstack/react-query';
import { useChampions } from '../contexts/ChampionsContext';
import { apiFetch } from '../api/client';

export default function RolePanel({ teamName, role, matchId }) {
  const { getChampionImageUrl } = useChampions();

  const { data: recentPicks, isLoading } = useQuery({
    queryKey: ['recentPicks', teamName, role],
    queryFn: () =>
      apiFetch(`/api/matches?team=${encodeURIComponent(teamName)}&status=completed&limit=5`),
    staleTime: 60 * 1000,
    enabled: !!teamName && !!role,
    select: (matches) => {
      if (!Array.isArray(matches)) return [];
      const picks = [];
      for (const m of matches) {
        if (m.id === matchId) continue;
        const roleKey = role.toLowerCase();
        const results = m.results || m.draft_results || {};
        // Try to find the pick for this team at this role
        const teamKey = m.team1 === teamName ? 'team1' : 'team2';
        const pickKey = `${teamKey}_${roleKey}`;
        if (results[pickKey]) {
          picks.push(results[pickKey]);
        }
        if (picks.length >= 5) break;
      }
      return picks;
    },
  });

  if (isLoading) {
    return (
      <div className="text-xs text-text-muted p-2">Loading...</div>
    );
  }

  if (!recentPicks || recentPicks.length === 0) {
    return (
      <div className="text-xs text-text-muted p-2">No recent data</div>
    );
  }

  return (
    <div className="p-2">
      <p className="text-[10px] text-text-muted mb-1.5 font-medium">
        Recent {role} picks for {teamName}
      </p>
      <div className="flex gap-1.5">
        {recentPicks.map((pick, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <img
              src={getChampionImageUrl(pick.id || pick)}
              alt={pick.name || pick}
              className="w-8 h-8 rounded ring-1 ring-white/10"
            />
            <span className="text-[9px] text-text-muted truncate max-w-[40px]">
              {pick.name || pick}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
