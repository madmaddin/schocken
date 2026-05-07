'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { PlayerRow } from './PlayerRow';
import { DiceDisplay } from './DiceDisplay';
import { RoundHistory } from './RoundHistory';
import { RotateCcw } from 'lucide-react';
import { canHoldDie, canDrehSechsen } from '@/game/rules/combinations';
import type { DieValue } from '@/game/rules/types';

const HALF_LABELS: Record<number, string> = { 1: '1. Halbzeit', 2: '2. Halbzeit', 3: 'Finale' };

export function GameBoard() {
  const gameState = useGameStore((s) => s.gameState);
  const roll = useGameStore((s) => s.roll);
  const toggleHold = useGameStore((s) => s.toggleHold);
  const finalizeTurn = useGameStore((s) => s.finalizeTurn);
  const applySechsenDrehen = useGameStore((s) => s.applySechsenDrehen);
  const startSecondHalf = useGameStore((s) => s.startSecondHalf);
  const resetGame = useGameStore((s) => s.resetGame);
  const toggleFastMode = useGameStore((s) => s.toggleFastMode);
  const fastMode = useGameStore((s) => s.fastMode);
  const proceedAfterRound = useGameStore((s) => s.proceedAfterRound);

  // Fast-Mode: Rundenauswertung automatisch anstoßen
  useEffect(() => {
    if (gameState?.phase === 'round_result' && fastMode) {
      const t = setTimeout(() => proceedAfterRound(), 400);
      return () => clearTimeout(t);
    }
  }, [gameState?.phase, fastMode, proceedAfterRound]);

  if (!gameState) return null;

  const {
    players, currentPlayerId, roundFinalRolls, activeTurn, phase,
    coverPool, round, half, half1Loser, half2Loser,
    rules, maxRollsThisRound, roundHistory, roundPlayerOrder,
    roundRollCounts, roundMaxAtFinalization, lastRoundResult,
  } = gameState;

  const isHumanTurn = currentPlayerId === 'human' && phase === 'playing';
  const humanTurn = currentPlayerId === 'human' ? activeTurn : null;
  const hasRolled = !!humanTurn;
  const canRollAgain = hasRolled && humanTurn!.rollCount < maxRollsThisRound;

  const canHoldArr: [boolean, boolean, boolean] = humanTurn
    ? humanTurn.dice.map((d) => canHoldDie(d as DieValue, rules)) as [boolean, boolean, boolean]
    : [false, false, false];

  const showSechsenDrehen =
    hasRolled &&
    humanTurn &&
    !humanTurn.mustRoll &&
    rules.sechsenDrehenEnabled &&
    canDrehSechsen(humanTurn.dice, rules) &&
    humanTurn.rollCount < maxRollsThisRound;

  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name;

  // Grün/Rot-Highlight: basiert auf den Würfen der aktuellen Runde
  const rolledEntries = Object.entries(roundFinalRolls).filter(([, r]) => r !== null) as [string, import('@/game/rules/types').EvaluatedRoll][];
  const rolledValues = rolledEntries.map(([, r]) => r.value);
  const roundBestValue  = rolledValues.length > 0 ? Math.max(...rolledValues) : null;
  const roundWorstValue = rolledValues.length > 1 ? Math.min(...rolledValues) : null;

  // Halbzeit-Screen-Inhalt
  const half1LoserName = players.find(p => p.id === half1Loser)?.name;
  const half2LoserName = players.find(p => p.id === half2Loser)?.name;
  const sameLoser = half1Loser && half2Loser && half1Loser === half2Loser;
  const isFinaleSetup = half === 2 && !!half2Loser && !sameLoser;

  // Vorspulen: zeigen wenn KI am Zug ist
  const showFastForward = phase === 'playing' && currentPlayerId !== 'human';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-start">

        {/* ─── Linke Spalte: Spielfeld ─── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-amber-400">🎲 Schocken</h1>
              <p className="text-xs text-gray-400">
                {HALF_LABELS[half]} · Runde {round}
                {maxRollsThisRound < 3 && phase === 'playing' && (
                  <span className="ml-2 text-amber-400">max. {maxRollsThisRound}×</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{coverPool}</div>
                <div className="text-xs text-gray-400">im Pool</div>
              </div>
              <button onClick={resetGame} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Aktive Spieler */}
          <div className="flex flex-col gap-2">
            {players.filter(p => !p.isOut).map((player) => {
              const orderIdx = roundPlayerOrder.indexOf(player.id);
              const rollCount = roundRollCounts[player.id];
              const maxAtFin = roundMaxAtFinalization[player.id];
              const stoodEarlyAt = (roundFinalRolls[player.id] && rollCount !== undefined && maxAtFin !== undefined && rollCount < maxAtFin)
                ? rollCount : null;

              // Verdeckt: andere Spieler sehen nur die vor dem letzten Wurf rausgelegten Würfel.
              // Ausnahme: Schock Aus bei einem nicht-letzten Wurf wird sofort aufgedeckt.
              // In round_result (alle fertig → Becher heben) werden alle Würfel gezeigt.
              const heldAtFin = gameState.roundHeldAtFinalization[player.id] ?? null;
              const playerActiveTurn = currentPlayerId === player.id ? activeTurn : null;
              let visibilityMask: [boolean, boolean, boolean] | null = null;
              if (rules.verdecktEnabled && player.id !== 'human' && phase !== 'round_result') {
                if (playerActiveTurn) {
                  // Laufender Zug: nur committedHeld zeigen
                  visibilityMask = playerActiveTurn.committedHeld;
                } else if (roundFinalRolls[player.id] !== null) {
                  const pRollCount = roundRollCounts[player.id];
                  const pMaxAtFin = roundMaxAtFinalization[player.id];
                  const schockAusEarlyReveal =
                    roundFinalRolls[player.id]?.type === 'schock_aus' &&
                    pRollCount !== undefined &&
                    pMaxAtFin !== undefined &&
                    pRollCount < pMaxAtFin;
                  if (schockAusEarlyReveal) {
                    visibilityMask = null; // Schock Aus vor letztem Wurf → aufdecken
                  } else {
                    // heldAtFin enthält committedHeld zum Zeitpunkt des Abschlusses
                    // (kann [false,false,false] sein → alle verdeckt)
                    visibilityMask = heldAtFin ?? [false, false, false];
                  }
                }
              }

              // Wurf-Info: X/Y neben den Würfeln
              const rollInfo = (() => {
                if (playerActiveTurn) return { used: playerActiveTurn.rollCount, max: maxRollsThisRound };
                const used = roundRollCounts[player.id];
                const max = roundMaxAtFinalization[player.id];
                if (roundFinalRolls[player.id] !== null && used !== undefined && max !== undefined) return { used, max };
                return null;
              })();

              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  orderNumber={orderIdx >= 0 ? orderIdx + 1 : null}
                  finalRoll={roundFinalRolls[player.id] ?? null}
                  activeTurn={playerActiveTurn}
                  isCurrentPlayer={currentPlayerId === player.id && phase === 'playing'}
                  isLeading={roundBestValue !== null && (roundFinalRolls[player.id]?.value ?? -1) === roundBestValue && !visibilityMask}
                  isTrailing={roundWorstValue !== null && (roundFinalRolls[player.id]?.value ?? -1) === roundWorstValue && !visibilityMask}
                  totalCovers={rules.totalCovers}
                  isHalf1Loser={player.id === half1Loser}
                  stoodEarlyAt={stoodEarlyAt}
                  rollInfo={rollInfo}
                  visibilityMask={visibilityMask}
                />
              );
            })}
          </div>

          {/* Pausierte Spieler */}
          {players.filter(p => p.isOut).length > 0 && (
            <div className="border border-gray-700 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pausiert (0 Deckel)</p>
              {players.filter(p => p.isOut).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{p.type === 'ai' ? '🤖' : '🧑'}</span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* ─── Aktionsbereich ─── */}
          <div className="space-y-3">

            {/* Alle fertig – Weiter-Button */}
            {phase === 'round_result' && !fastMode && (
              <button
                onClick={proceedAfterRound}
                className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all active:scale-95"
              >
                Weiter →
              </button>
            )}
            {phase === 'round_result' && fastMode && (
              <div className="bg-gray-800/60 border border-gray-600 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
                Auswertung…
              </div>
            )}

            {/* Menschlicher Zug */}
            {phase === 'playing' && isHumanTurn && (
              <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
                {hasRolled && humanTurn && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        Wurf {humanTurn.rollCount}/{maxRollsThisRound}
                        {canRollAgain && ' · Tippe zum Halten'}
                      </span>
                      {humanTurn.bestRoll && (
                        <span className="font-medium text-white">{humanTurn.bestRoll.label}</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <DiceDisplay
                        dice={humanTurn.dice}
                        held={humanTurn.held}
                        canHold={canHoldArr}
                        onToggleHold={canRollAgain ? toggleHold : undefined}
                      />
                    </div>
                    {humanTurn.held.some(Boolean) && (
                      <p className="text-xs text-center text-amber-400">Goldene Würfel bleiben liegen</p>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {showSechsenDrehen && (
                    <button
                      onClick={applySechsenDrehen}
                      className="w-full py-3 rounded-xl font-bold text-base bg-orange-600 hover:bg-orange-500 text-white transition-all active:scale-95"
                    >
                      🔄 Sechsen drehen → Pflichtwurf
                    </button>
                  )}
                  <div className="flex gap-2">
                    {(!hasRolled || canRollAgain) && !humanTurn?.mustRoll && (
                      <button onClick={roll} className="flex-1 py-4 rounded-xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all active:scale-95">
                        🎲 {hasRolled ? 'Nochmal!' : 'Würfeln'}
                      </button>
                    )}
                    {humanTurn?.mustRoll && (
                      <button onClick={roll} className="flex-1 py-4 rounded-xl font-bold text-lg bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95">
                        🎲 Pflichtwurf!
                      </button>
                    )}
                    {hasRolled && !humanTurn?.mustRoll && (
                      <button
                        onClick={finalizeTurn}
                        className={`py-4 rounded-xl font-bold transition-all active:scale-95
                          ${canRollAgain ? 'px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm' : 'flex-1 bg-amber-500 hover:bg-amber-400 text-gray-900 text-lg'}`}
                      >
                        {canRollAgain ? 'Stehen ✓' : '✓ Fertig'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* KI würfelt */}
            {phase === 'playing' && !isHumanTurn && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-gray-400 text-sm">
                  {currentPlayerName} {activeTurn ? `würfelt (${activeTurn.rollCount}×)…` : 'ist dran…'}
                </span>
                {showFastForward && (
                  <button
                    onClick={toggleFastMode}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      fastMode
                        ? 'bg-amber-500 text-gray-900 hover:bg-amber-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {fastMode ? '⏩ Schnell' : '⏩ Vorspulen'}
                  </button>
                )}
              </div>
            )}

            {/* Halbzeit-Screen */}
            {phase === 'half_time' && (
              <div className="space-y-3">
                <div className="bg-amber-900/30 border border-amber-600/40 rounded-2xl p-5 space-y-3">
                  <div className="text-center space-y-1">
                    <div className="text-3xl">{half === 1 ? '🍺' : half === 2 ? '🍻' : '🏆'}</div>
                    <h2 className="text-lg font-bold text-amber-400">
                      {half === 1 ? '1. Halbzeit beendet' : '2. Halbzeit beendet'}
                    </h2>
                  </div>

                  {half === 1 && half1LoserName && (
                    <p className="text-center text-gray-300 text-sm">
                      <span className="font-bold text-red-400">{half1LoserName}</span>
                      {' '}hat die 1. Halbzeit verloren.
                    </p>
                  )}

                  {half === 2 && sameLoser && (
                    <div className="text-center space-y-1">
                      <p className="text-gray-300 text-sm">
                        <span className="font-bold text-red-400">{half2LoserName}</span>
                        {' '}hat beide Hälften verloren.
                      </p>
                      <p className="text-amber-400 font-semibold">→ gibt eine Runde aus!</p>
                    </div>
                  )}

                  {half === 2 && !sameLoser && half1LoserName && half2LoserName && (
                    <div className="text-center space-y-1">
                      <p className="text-gray-300 text-sm">
                        <span className="font-bold text-orange-400">{half1LoserName}</span>
                        {' '}(1. HZ) und{' '}
                        <span className="font-bold text-orange-400">{half2LoserName}</span>
                        {' '}(2. HZ) spielen das Finale.
                      </p>
                      <p className="text-amber-400 font-semibold text-sm">🎯 Heads-Up!</p>
                    </div>
                  )}

                  {lastRoundResult?.tiebreakReason && (
                    <p className="text-center text-xs text-amber-400/80">
                      Letzte Runde entschieden durch: {lastRoundResult.tiebreakReason}
                    </p>
                  )}
                </div>

                <button
                  onClick={startSecondHalf}
                  className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all"
                >
                  {half === 1 ? '2. Halbzeit starten' : isFinaleSetup ? 'Finale starten' : 'Ergebnis anzeigen'}
                </button>
              </div>
            )}

            {/* Spiel vorbei */}
            {phase === 'finished' && (
              <div className="space-y-3">
                <div className="bg-red-900/40 border border-red-500/50 rounded-2xl p-5 text-center space-y-1">
                  <div className="text-3xl">🎉</div>
                  <h2 className="text-lg font-bold text-red-400">Spiel beendet!</h2>
                  <p className="text-gray-300 text-sm">
                    <span className="font-bold text-red-400">
                      {[...players].sort((a, b) => b.covers - a.covers)[0].name}
                    </span>
                    {' '}gibt eine Runde aus!
                  </p>
                </div>
                <button onClick={resetGame} className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all">
                  Neues Spiel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Rechte Spalte: Rundenhistorie ─── */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-gray-800/50 rounded-2xl p-3">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Rundenhistorie</h2>
            <div className="max-h-[70vh] overflow-y-auto">
              <RoundHistory history={roundHistory} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
