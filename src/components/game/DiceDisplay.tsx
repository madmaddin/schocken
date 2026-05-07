'use client';

import type { DieValue } from '@/game/rules/types';

const dieFaces: Record<DieValue, string> = {
  1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

interface DiceDisplayProps {
  // null = alle Würfel verdeckt; null-Element = einzelner Würfel verdeckt
  dice: (DieValue | null)[] | null;
  held?: [boolean, boolean, boolean];
  onToggleHold?: (index: 0 | 1 | 2) => void;
  canHold?: [boolean, boolean, boolean];
  small?: boolean;
}

export function DiceDisplay({ dice, held, onToggleHold, canHold, small }: DiceDisplayProps) {
  const size = small ? 'w-9 h-9 text-2xl' : 'w-12 h-12 text-3xl';

  if (!dice) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${size} rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-500`}>
            ?
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {dice.map((die, i) => {
        const isHeld = held?.[i] ?? false;
        const holdable = canHold?.[i] ?? false;
        const clickable = !!onToggleHold && holdable;
        const hidden = die === null;

        return (
          <div
            key={i}
            onClick={() => clickable && onToggleHold?.(i as 0 | 1 | 2)}
            className={`${size} rounded-lg flex items-center justify-center shadow-md transition-all select-none
              ${hidden
                ? 'bg-gray-700 border-2 border-gray-600 text-gray-500'
                : isHeld
                  ? 'bg-amber-400 border-2 border-amber-300 scale-105 text-gray-900'
                  : 'bg-white border-2 border-gray-300 text-gray-900'}
              ${clickable ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
              ${holdable && !isHeld && !hidden && onToggleHold ? 'ring-2 ring-amber-400/50' : ''}
            `}
          >
            {hidden ? '?' : dieFaces[die as DieValue]}
          </div>
        );
      })}
    </div>
  );
}
