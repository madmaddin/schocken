'use client';

import { useGameStore } from '@/store/gameStore';
import { GameSetup } from '@/components/game/GameSetup';
import { GameBoard } from '@/components/game/GameBoard';

export default function Home() {
  const gameState = useGameStore((s) => s.gameState);
  const fastMode = useGameStore((s) => s.fastMode);
  const roll = useGameStore((s) => s.roll);
  const toggleHold = useGameStore((s) => s.toggleHold);
  const finalizeTurn = useGameStore((s) => s.finalizeTurn);
  const applySechsenDrehen = useGameStore((s) => s.applySechsenDrehen);
  const proceedAfterRound = useGameStore((s) => s.proceedAfterRound);
  const startSecondHalf = useGameStore((s) => s.startSecondHalf);
  const resetGame = useGameStore((s) => s.resetGame);
  const toggleFastMode = useGameStore((s) => s.toggleFastMode);

  if (gameState) {
    return (
      <GameBoard
        gameState={gameState}
        myPlayerId="human"
        isHost={true}
        fastMode={fastMode}
        actions={{ roll, toggleHold, finalizeTurn, applySechsenDrehen, proceedAfterRound, startSecondHalf, resetGame, toggleFastMode }}
      />
    );
  }

  return <GameSetup />;
}
