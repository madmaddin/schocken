'use client';

import { DiceDisplay } from './DiceDisplay';
import type { Player, EvaluatedRoll, TurnState, DieValue } from '@/game/rules/types';

interface PlayerRowProps {
  player: Player;
  orderNumber: number | null;
  finalRoll: EvaluatedRoll | null;
  activeTurn: TurnState | null;
  isCurrentPlayer: boolean;
  isLeading: boolean;
  isTrailing: boolean;
  totalCovers: number;
  isHalf1Loser: boolean;
  stoodEarlyAt: number | null;
  rollInfo: { used: number; max: number } | null;
  // Verdeckt: welche Würfel sichtbar sind (null = alle sichtbar)
  visibilityMask: [boolean, boolean, boolean] | null;
}

const combinationColors: Record<string, string> = {
  schock_aus: 'bg-purple-600 text-white',
  schock: 'bg-red-600 text-white',
  schock_doof: 'bg-orange-600 text-white',
  general: 'bg-blue-600 text-white',
  strasse: 'bg-green-700 text-white',
  jule: 'bg-yellow-500 text-black',
  simple: 'bg-gray-700 text-gray-200',
};

export function PlayerRow({
  player, orderNumber, finalRoll, activeTurn,
  isCurrentPlayer, isLeading, isTrailing, totalCovers,
  isHalf1Loser, stoodEarlyAt, rollInfo, visibilityMask,
}: PlayerRowProps) {
  const coverDots = Array.from({ length: totalCovers }, (_, i) => i < player.covers);

  let rowBg = 'bg-gray-800/50 border border-gray-700/50';
  if (isCurrentPlayer) rowBg = 'bg-amber-900/40 border border-amber-500/60';
  else if (isLeading) rowBg = 'bg-green-900/25 border border-green-700/40';
  else if (isTrailing) rowBg = 'bg-red-900/25 border border-red-700/40';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${rowBg}`}>

      {/* Reihenfolge-Nummer */}
      <div className="w-6 shrink-0 text-center">
        {orderNumber !== null ? (
          <span className={`text-sm font-bold ${isCurrentPlayer ? 'text-amber-400' : 'text-gray-500'}`}>
            {orderNumber}
          </span>
        ) : (
          <span className="text-gray-600 text-sm">—</span>
        )}
      </div>

      {/* Name + Typ */}
      <div className="w-28 min-w-28 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{player.avatar}</span>
          <span className={`text-sm font-medium truncate ${isCurrentPlayer ? 'text-amber-300' : 'text-gray-200'}`}>
            {player.name}
          </span>
        </div>
        {isCurrentPlayer && activeTurn && (
          <span className="text-xs text-amber-400 ml-6">
            {player.type === 'ai' ? 'grübelt...' : 'Wurf ' + activeTurn.rollCount}
          </span>
        )}
        {isCurrentPlayer && !activeTurn && !finalRoll && (
          <span className="text-xs text-amber-400 ml-6">
            {player.type === 'ai' ? 'ist dran' : '← du bist dran'}
          </span>
        )}
      </div>

      {/* Würfelanzeige */}
      <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
        {finalRoll || activeTurn ? (
          <>
            {(() => {
              const rawDice = activeTurn ? activeTurn.dice : finalRoll!.dice;
              // Verdeckt: nicht-gehaltene Würfel als null (= "?") maskieren
              const displayDice: (DieValue | null)[] =
                visibilityMask
                  ? rawDice.map((d, i) => (visibilityMask[i] ? d : null))
                  : [...rawDice];
              return (
                <DiceDisplay
                  dice={displayDice}
                  held={activeTurn?.held}
                  small
                />
              );
            })()}
            {rollInfo && (
              <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                {rollInfo.used}/{rollInfo.max}
              </span>
            )}
            {finalRoll && !visibilityMask && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${combinationColors[finalRoll.type] ?? combinationColors.simple}`}>
                {finalRoll.label}
              </span>
            )}
          </>
        ) : (
          <DiceDisplay dice={null} small />
        )}
      </div>

      {/* Deckel-Dots + Halbzeit-Marker */}
      <div className="flex flex-wrap gap-0.5 w-24 justify-end shrink-0 items-end">
        {coverDots.map((filled, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border transition-colors
              ${filled
                ? isTrailing ? 'bg-red-500 border-red-400' : 'bg-amber-500 border-amber-400'
                : 'bg-gray-700 border-gray-600'}`}
          />
        ))}
        <div className="w-full flex items-center justify-end gap-1 mt-0.5">
          {isHalf1Loser && (
            <div
              className="w-2.5 h-4 bg-amber-500 opacity-80 shrink-0"
              style={{ borderRadius: '50% 0 0 50% / 50% 0 0 50%' }}
              title="1. Halbzeit verloren"
            />
          )}
          <span className="text-xs text-gray-500">{player.covers}/{totalCovers}</span>
        </div>
      </div>
    </div>
  );
}
