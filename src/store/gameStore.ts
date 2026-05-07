'use client';

import { create } from 'zustand';
import { GameEngine } from '@/game/engine/GameEngine';
import { STANDARD_RULES } from '@/game/rules/presets';
import { getAIPlayerName } from '@/game/ai/AIPlayer';
import type { GameState, GameRules, Player, AIPlayerConfig } from '@/game/rules/types';

interface GameStore {
  engine: GameEngine | null;
  gameState: GameState | null;
  isAIThinking: boolean;
  fastMode: boolean;

  startTrainingGame: (humanName: string, aiCount: number, rules: GameRules, aiConfigs: AIPlayerConfig[]) => void;
  // Menschlicher Spieler würfelt (oder würfelt nochmal)
  roll: () => void;
  toggleHold: (dieIndex: 0 | 1 | 2) => void;
  applySechsenDrehen: () => void;
  // Zug beenden ("Stehe auf meinem Ergebnis")
  finalizeTurn: () => void;
  startSecondHalf: () => void;
  proceedAfterRound: () => void;
  resetGame: () => void;
  toggleFastMode: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameState: null,
  isAIThinking: false,
  fastMode: false,

  startTrainingGame: (humanName, aiCount, rules, aiConfigs) => {
    const defaultConfig: AIPlayerConfig = { skillLevel: 'fortgeschritten', riskProfile: 'ausgewogen' };
    const players: Player[] = [
      {
        id: 'human',
        name: humanName,
        type: 'human',
        covers: 0,
        isEliminated: false,
        isOut: false,
      },
      ...Array.from({ length: aiCount }, (_, i) => ({
        id: `ai-${i}`,
        name: getAIPlayerName(i),
        type: 'ai' as const,
        aiConfig: aiConfigs[i] ?? defaultConfig,
        covers: 0,
        isEliminated: false,
        isOut: false,
      })),
    ];

    const engine = new GameEngine(players, rules, (newState) => {
      set({ gameState: newState });
      triggerAIIfNeeded(engine, newState, set);
    });

    engine.startLoadingRound();
    set({ engine, gameState: engine.getState() });
  },

  roll: () => {
    const { engine, gameState } = get();
    if (!engine || !gameState) return;
    if (gameState.currentPlayerId !== 'human') return;
    engine.rollActive();
  },

  toggleHold: (dieIndex) => {
    const { engine, gameState } = get();
    if (!engine || !gameState) return;
    if (gameState.currentPlayerId !== 'human') return;
    engine.toggleHold(dieIndex);
  },

  applySechsenDrehen: () => {
    const { engine, gameState } = get();
    if (!engine || !gameState) return;
    if (gameState.currentPlayerId !== 'human') return;
    engine.applySechsenDrehen();
  },

  finalizeTurn: () => {
    const { engine, gameState } = get();
    if (!engine || !gameState) return;
    if (gameState.currentPlayerId !== 'human') return;
    engine.finalizeTurn();
  },

  startSecondHalf: () => get().engine?.proceedAfterHalfTime(),
  proceedAfterRound: () => get().engine?.proceedAfterRound(),
  resetGame: () => set({ engine: null, gameState: null, isAIThinking: false, fastMode: false }),
  toggleFastMode: () => {
    const { engine, fastMode } = get();
    const newMode = !fastMode;
    if (engine) engine.fastMode = newMode;
    set({ fastMode: newMode });
  },
}));

function triggerAIIfNeeded(
  engine: GameEngine,
  state: GameState,
  set: (s: Partial<{ isAIThinking: boolean }>) => void
) {
  const current = state.players.find((p) => p.id === state.currentPlayerId);
  const isAITurn =
    state.phase === 'playing' &&
    current?.type === 'ai' &&
    !state.activeTurn &&
    !state.roundFinalRolls[state.currentPlayerId];

  if (isAITurn) {
    set({ isAIThinking: true });
    engine.performAITurn(state.currentPlayerId).finally(() => {
      set({ isAIThinking: false });
    });
  }
}
