'use client';

import type { RoundSummary } from '@/game/rules/types';

interface RoundHistoryProps {
  history: RoundSummary[];
}

const dieFaces: Record<number, string> = {
  1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

function DiceSmall({ dice }: { dice: [number, number, number] }) {
  return (
    <span className="inline-flex gap-0.5 text-sm text-gray-900">
      {dice.map((d, i) => (
        <span key={i} className="bg-white rounded px-0.5">{dieFaces[d]}</span>
      ))}
    </span>
  );
}

export function RoundHistory({ history }: RoundHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-gray-600 text-xs text-center pt-4">
        Noch keine Runden gespielt
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {history.map((entry, i) => (
        <div
          key={i}
          className={`rounded-lg px-2.5 py-2 text-xs space-y-0.5
            ${i === 0 ? 'bg-gray-700 border border-gray-600' : 'bg-gray-800/60'}`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-gray-400 font-mono">
              H{entry.half} R{entry.round}
            </span>
            {entry.schockAus && (
              <span className="text-purple-400 font-bold text-xs">SCHOCK AUS</span>
            )}
          </div>

          {/* Verlierer */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-red-400 font-medium">{entry.loserName}</span>
            <DiceSmall dice={entry.loserRoll.dice} />
            <span className="text-gray-500">{entry.loserRoll.label}</span>
          </div>

          {/* Deckelinfo */}
          <div className="text-gray-300">
            erhält{' '}
            <span className="text-amber-400 font-bold">{entry.coversLost}</span>
            {' '}Deckel{' '}
            {entry.fromPool ? (
              <span className="text-gray-500">aus Pool</span>
            ) : (
              <>
                <span className="text-gray-500">von</span>
                {' '}
                <span className="text-green-400 font-medium">{entry.winnerName}</span>
                {' '}
                <DiceSmall dice={entry.winnerRoll.dice} />
                {' '}
                <span className="text-gray-500">{entry.winnerRoll.label}</span>
              </>
            )}
          </div>

          {/* Tiebreak-Grund */}
          {entry.tiebreakReason && (
            <div className="text-amber-400/80 text-xs">
              Gleichstand → {entry.tiebreakReason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
