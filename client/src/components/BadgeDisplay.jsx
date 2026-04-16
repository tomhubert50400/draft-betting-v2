const BADGE_INFO = {
  first_bet: { icon: '#', label: 'First Bet', color: 'text-accent-cyan' },
  perfect_score: { icon: '*', label: 'Perfect Score', color: 'text-amber-400' },
  dedicated_bettor: { icon: '+', label: 'Dedicated Bettor', color: 'text-accent-purple' },
  veteran: { icon: '^', label: 'Veteran', color: 'text-accent-pink' },
  top_scorer: { icon: '!', label: 'Top Scorer', color: 'text-green-400' },
};

export default function BadgeDisplay({ badges }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => {
        const info = BADGE_INFO[badge] || { icon: '?', label: badge, color: 'text-text-muted' };
        return (
          <span
            key={badge}
            title={info.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-bg-hover border border-white/5 ${info.color}`}
          >
            <span className="font-bold">{info.icon}</span>
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
