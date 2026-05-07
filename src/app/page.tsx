'use client';

import { useGameStore } from '@/store/gameStore';
import { GameSetup } from '@/components/game/GameSetup';
import { GameBoard } from '@/components/game/GameBoard';

export default function Home() {
  const gameState = useGameStore((s) => s.gameState);

  return gameState ? <GameBoard /> : <GameSetup />;
}
