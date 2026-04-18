import { useState, useCallback } from 'react';
import { useChampions } from '../contexts/ChampionsContext';
import ChampionSearch from './ChampionSearch';

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

const ROLE_ICONS = {
  Top: 'T',
  Jungle: 'J',
  Mid: 'M',
  Bot: 'B',
  Support: 'S',
};

export default function DraftSelector({ match, onSubmit, existingBet, canBrowse = true, canSubmit = false }) {
  const { getChampionImageUrl } = useChampions();

  // Initialize picks from existing bet or empty
  const buildInitialPicks = () => {
    const picks = {};
    ROLES.forEach((role) => {
      picks[`team1_${role}`] = null;
      picks[`team2_${role}`] = null;
    });
    if (existingBet?.predictions) {
      const preds = existingBet.predictions;
      ROLES.forEach((role) => {
        const key1 = `team1_${role.toLowerCase()}`;
        const key2 = `team2_${role.toLowerCase()}`;
        if (preds[key1]) picks[`team1_${role}`] = preds[key1];
        if (preds[key2]) picks[`team2_${role}`] = preds[key2];
      });
    }
    return picks;
  };

  const [picks, setPicks] = useState(buildInitialPicks);
  const [activeSlot, setActiveSlot] = useState(null); // { team: 'team1'|'team2', role: 'Top'|... }
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = useCallback((champ) => {
    if (!activeSlot) return;
    const key = `${activeSlot.team}_${activeSlot.role}`;
    setPicks((prev) => ({
      ...prev,
      [key]: champ ? { id: champ.id, name: champ.name } : null,
    }));
    setActiveSlot(null);
  }, [activeSlot]);

  const handleSubmit = async () => {
    const predictions = {};
    ROLES.forEach((role) => {
      const key1 = `team1_${role}`;
      const key2 = `team2_${role}`;
      if (picks[key1]) predictions[`team1_${role.toLowerCase()}`] = picks[key1];
      if (picks[key2]) predictions[`team2_${role.toLowerCase()}`] = picks[key2];
    });

    setSubmitting(true);
    try {
      await onSubmit(predictions);
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyPick = Object.values(picks).some(Boolean);

  const ROLE_TO_KEY = { Top: 'Top', Jungle: 'Jungle', Mid: 'Mid', Bot: 'Bot', Support: 'Support' };
  const getPlayerName = (team, role) => {
    const teamRoster = match?.rosters?.[team];
    return teamRoster?.[ROLE_TO_KEY[role]] || null;
  };

  const renderSlot = (team, role) => {
    const key = `${team}_${role}`;
    const pick = picks[key];
    const playerName = getPlayerName(team, role);

    return (
      <div key={key} className="flex flex-col gap-1 min-w-0">
        {/* Player name */}
        <span className="text-[10px] text-text-secondary text-center truncate font-medium">
          {playerName || '\u00A0'}
        </span>
        <button
          onClick={() => canBrowse && setActiveSlot({ team, role, playerName })}
          disabled={!canBrowse}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-0 ${
            !canBrowse
              ? 'border-white/5 cursor-default'
              : 'border-white/10 hover:border-accent-purple/40 hover:bg-bg-hover cursor-pointer'
          } ${pick ? 'bg-bg-hover/50' : 'bg-bg-primary/50'}`}
        >
        {pick ? (
          <img
            src={getChampionImageUrl(pick.id)}
            alt={pick.name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg ring-1 ring-accent-purple/30"
          />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-bg-primary border border-dashed border-white/10 flex items-center justify-center">
            <span className="text-text-muted text-xs">?</span>
          </div>
        )}
        <span className="text-[10px] text-text-muted truncate w-full text-center">
          {pick ? pick.name : '--'}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header row with team names */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center">
        <div />
        <div className="text-center">
          <h3 className="text-sm font-bold text-text-primary">{match.team1}</h3>
        </div>
        <div />
        <div className="text-center">
          <h3 className="text-sm font-bold text-text-primary">{match.team2}</h3>
        </div>
      </div>

      {/* Role rows */}
      {ROLES.map((role) => (
        <div key={role} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center">
          {/* Role label */}
          <div className="w-8 flex items-center justify-center">
            <span className="text-xs font-bold text-accent-purple bg-accent-purple/10 w-6 h-6 flex items-center justify-center rounded">
              {ROLE_ICONS[role]}
            </span>
          </div>
          {/* Team 1 slot */}
          {renderSlot('team1', role)}
          {/* Role label (center) */}
          <div className="flex items-center justify-center">
            <span className="text-[10px] text-text-muted font-medium">{role}</span>
          </div>
          {/* Team 2 slot */}
          {renderSlot('team2', role)}
        </div>
      ))}

      {/* Submit button */}
      {canSubmit && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasAnyPick}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            submitting || !hasAnyPick
              ? 'bg-bg-hover text-text-muted cursor-not-allowed'
              : 'bg-gradient-accent text-white hover:opacity-90 hover:shadow-lg hover:shadow-accent-purple/20'
          }`}
        >
          {submitting
            ? 'Submitting...'
            : existingBet
              ? 'Update Bet'
              : 'Place Bet'}
        </button>
      )}

      {/* Champion search modal */}
      {activeSlot && (
        <ChampionSearch
          role={activeSlot.role}
          onSelect={handleSelect}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
