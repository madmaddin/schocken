'use client';

import { useEffect, useState } from 'react';
import { PlayerRow } from './PlayerRow';
import { DiceDisplay } from './DiceDisplay';
import { RoundHistory } from './RoundHistory';
import { RotateCcw } from 'lucide-react';
import { canHoldDie, canDrehSechsen } from '@/game/rules/combinations';
import type { DieValue, GameState } from '@/game/rules/types';

const HALF_LABELS: Record<number, string> = { 1: '1. Halbzeit', 2: '2. Halbzeit', 3: 'Finale' };

export interface GameBoardActions {
  roll: () => void;
  toggleHold: (i: 0 | 1 | 2) => void;
  finalizeTurn: () => void;
  applySechsenDrehen: () => void;
  proceedAfterRound: () => void;
  startSecondHalf: () => void;
  resetGame?: () => void;
  restartGame?: () => void;
  toggleFastMode?: () => void;
}

interface GameBoardProps {
  gameState: GameState;
  myPlayerId: string;
  isHost?: boolean;
  fastMode?: boolean;
  actions: GameBoardActions;
  roundAckedBy?: string[];
}

export function GameBoard({ gameState, myPlayerId, isHost = true, fastMode = false, actions, roundAckedBy }: GameBoardProps) {
  const { roll, toggleHold, finalizeTurn, applySechsenDrehen, proceedAfterRound, startSecondHalf, resetGame, restartGame, toggleFastMode } = actions;
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (gameState.phase === 'round_result' && fastMode) {
      const t = setTimeout(() => proceedAfterRound(), 400);
      return () => clearTimeout(t);
    }
  }, [gameState.phase, fastMode, proceedAfterRound]);

  const {
    players, currentPlayerId, roundFinalRolls, activeTurn, phase,
    coverPool, round, half, half1Loser, half2Loser,
    rules, maxRollsThisRound, roundHistory, roundPlayerOrder,
    roundRollCounts, roundMaxAtFinalization, lastRoundResult,
  } = gameState;

  const isMyTurn = currentPlayerId === myPlayerId && phase === 'playing';
  const myTurn = currentPlayerId === myPlayerId ? activeTurn : null;
  const hasRolled = !!myTurn;
  const canRollAgain = hasRolled && myTurn!.rollCount < maxRollsThisRound;

  const canHoldArr: [boolean, boolean, boolean] = myTurn
    ? myTurn.dice.map((d) => canHoldDie(d as DieValue, rules)) as [boolean, boolean, boolean]
    : [false, false, false];

  const showSechsenDrehen =
    hasRolled && myTurn && !myTurn.mustRoll &&
    rules.sechsenDrehenEnabled && canDrehSechsen(myTurn.dice, rules) &&
    myTurn.rollCount < maxRollsThisRound;

  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name;

  const rolledEntries = Object.entries(roundFinalRolls).filter(([, r]) => r !== null) as [string, import('@/game/rules/types').EvaluatedRoll][];
  const rolledValues = rolledEntries.map(([, r]) => r.value);
  const roundBestValue  = rolledValues.length > 0 ? Math.max(...rolledValues) : null;
  const roundWorstValue = rolledValues.length > 1 ? Math.min(...rolledValues) : null;

  const half1LoserName = players.find(p => p.id === half1Loser)?.name;
  const half2LoserName = players.find(p => p.id === half2Loser)?.name;
  const sameLoser = half1Loser && half2Loser && half1Loser === half2Loser;
  const isFinaleSetup = half === 2 && !!half2Loser && !sameLoser;

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const showFastForward = !!toggleFastMode && phase === 'playing' && currentPlayerId !== myPlayerId && currentPlayer?.type === 'ai';

  // Ack-Status ermitteln (Online-Modus wenn roundAckedBy übergeben)
  const myPlayer = players.find(p => p.id === myPlayerId);
  const iHaveAcked = roundAckedBy !== undefined && roundAckedBy.includes(myPlayerId);
  const activeHumans = players.filter(p => p.type === 'human' && !p.isEliminated && !p.isAbsent);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-2 sm:p-3">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-3 sm:gap-4 items-start">

        {/* ─── Linke Spalte: Spielfeld ─── */}
        <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0 w-full">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-amber-400">🎲 Schocken</h1>
              <p className="text-xs text-gray-400">
                {HALF_LABELS[half]} · Runde {round}
                {maxRollsThisRound < 3 && phase === 'playing' && (
                  <span className="ml-2 text-amber-400">max. {maxRollsThisRound}×</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* History-Toggle (nur mobile) */}
              <button
                onClick={() => setShowHistory(v => !v)}
                className="md:hidden text-xs px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                {showHistory ? 'Verlauf ×' : 'Verlauf'}
              </button>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-amber-400">{coverPool}</div>
                <div className="text-xs text-gray-400">Pool</div>
              </div>
              {resetGame && (
                <button onClick={resetGame} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Aktive Spieler */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {players.filter(p => !p.isOut).map((player) => {
              const orderIdx = roundPlayerOrder.indexOf(player.id);
              const rollCount = roundRollCounts[player.id];
              const maxAtFin = roundMaxAtFinalization[player.id];
              const stoodEarlyAt = (roundFinalRolls[player.id] && rollCount !== undefined && maxAtFin !== undefined && rollCount < maxAtFin)
                ? rollCount : null;

              const heldAtFin = gameState.roundHeldAtFinalization[player.id] ?? null;
              const playerActiveTurn = currentPlayerId === player.id ? activeTurn : null;
              let visibilityMask: [boolean, boolean, boolean] | null = null;
              if (rules.verdecktEnabled && player.id !== myPlayerId && phase !== 'round_result') {
                if (playerActiveTurn) {
                  visibilityMask = playerActiveTurn.committedHeld;
                } else if (roundFinalRolls[player.id] !== null) {
                  const pRollCount = roundRollCounts[player.id];
                  const pMaxAtFin = roundMaxAtFinalization[player.id];
                  const schockAusEarlyReveal =
                    roundFinalRolls[player.id]?.type === 'schock_aus' &&
                    pRollCount !== undefined && pMaxAtFin !== undefined && pRollCount < pMaxAtFin;
                  visibilityMask = schockAusEarlyReveal ? null : (heldAtFin ?? [false, false, false]);
                }
              }

              const rollInfo = (() => {
                if (playerActiveTurn) return { used: playerActiveTurn.rollCount, max: maxRollsThisRound };
                const used = roundRollCounts[player.id];
                const max = roundMaxAtFinalization[player.id];
                if (roundFinalRolls[player.id] !== null && used !== undefined && max !== undefined) return { used, max };
                return null;
              })();

              // Ack-Status für diesen Spieler
              const ackStatus: 'acked' | 'waiting' | null = (() => {
                if (phase !== 'round_result' || roundAckedBy === undefined) return null;
                if (player.type !== 'human' || player.isAbsent) return null;
                return roundAckedBy.includes(player.id) ? 'acked' : 'waiting';
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
                  ackStatus={ackStatus}
                />
              );
            })}
          </div>

          {/* Pausierte Spieler */}
          {players.filter(p => p.isOut).length > 0 && (
            <div className="border border-gray-700 rounded-xl p-2 sm:p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pausiert (0 Deckel)</p>
              {players.filter(p => p.isOut).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{p.avatar}</span>
                  <span>{p.name}</span>
                  {p.isAbsent && <span className="text-xs">📵</span>}
                </div>
              ))}
            </div>
          )}

          {/* ─── Aktionsbereich ─── */}
          <div className="space-y-2 sm:space-y-3">

            {/* Rundenauswertung — Training (kein roundAckedBy): nur Host sieht Weiter */}
            {phase === 'round_result' && roundAckedBy === undefined && isHost && !fastMode && (
              <button onClick={proceedAfterRound}
                className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all active:scale-95">
                Weiter →
              </button>
            )}
            {phase === 'round_result' && roundAckedBy === undefined && isHost && fastMode && (
              <div className="bg-gray-800/60 border border-gray-600 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
                Auswertung…
              </div>
            )}
            {phase === 'round_result' && roundAckedBy === undefined && !isHost && (
              <div className="bg-gray-800/60 border border-gray-600 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
                Warte auf Weiter…
              </div>
            )}

            {/* Rundenauswertung — Online (roundAckedBy vorhanden): alle Humans müssen bestätigen */}
            {phase === 'round_result' && roundAckedBy !== undefined && (
              <>
                {myPlayer?.type === 'human' && !myPlayer.isAbsent && (
                  <button
                    onClick={proceedAfterRound}
                    disabled={iHaveAcked}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95
                      ${iHaveAcked
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-gray-900'}`}
                  >
                    {iHaveAcked ? '✓ Warte auf andere…' : 'Weiter →'}
                  </button>
                )}
                {activeHumans.length > 1 && (
                  <div className="bg-gray-800/60 rounded-xl px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                    {activeHumans.map(p => (
                      <span key={p.id} className="text-xs flex items-center gap-1">
                        <span>{roundAckedBy.includes(p.id) ? '✓' : '⏳'}</span>
                        <span className={roundAckedBy.includes(p.id) ? 'text-green-400' : 'text-gray-400'}>{p.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Mein Zug */}
            {phase === 'playing' && isMyTurn && (
              <div className="bg-gray-800 rounded-2xl p-3 sm:p-4 space-y-3">
                {hasRolled && myTurn && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        Wurf {myTurn.rollCount}/{maxRollsThisRound}
                        {canRollAgain && ' · Tippe zum Halten'}
                      </span>
                      {myTurn.bestRoll && (
                        <span className="font-medium text-white">{myTurn.bestRoll.label}</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <DiceDisplay
                        dice={myTurn.dice}
                        held={myTurn.held}
                        canHold={canHoldArr}
                        onToggleHold={canRollAgain ? toggleHold : undefined}
                      />
                    </div>
                    {myTurn.held.some(Boolean) && (
                      <p className="text-xs text-center text-amber-400">Goldene Würfel bleiben liegen</p>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {showSechsenDrehen && (
                    <button onClick={applySechsenDrehen}
                      className="w-full py-3 rounded-xl font-bold text-base bg-orange-600 hover:bg-orange-500 text-white transition-all active:scale-95">
                      🔄 Sechsen drehen → Pflichtwurf
                    </button>
                  )}
                  <div className="flex gap-2">
                    {(!hasRolled || canRollAgain) && !myTurn?.mustRoll && (
                      <button onClick={roll}
                        className="flex-1 py-4 rounded-xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all active:scale-95">
                        🎲 {hasRolled ? 'Nochmal!' : 'Würfeln'}
                      </button>
                    )}
                    {myTurn?.mustRoll && (
                      <button onClick={roll}
                        className="flex-1 py-4 rounded-xl font-bold text-lg bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95">
                        🎲 Pflichtwurf!
                      </button>
                    )}
                    {hasRolled && !myTurn?.mustRoll && (
                      <button onClick={finalizeTurn}
                        className={`py-4 rounded-xl font-bold transition-all active:scale-95
                          ${canRollAgain ? 'px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm' : 'flex-1 bg-amber-500 hover:bg-amber-400 text-gray-900 text-lg'}`}>
                        {canRollAgain ? 'Stehen ✓' : '✓ Fertig'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Anderer Spieler / KI am Zug */}
            {phase === 'playing' && !isMyTurn && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-gray-400 text-sm">
                  {currentPlayerName} {activeTurn ? `würfelt (${activeTurn.rollCount}×)…` : 'ist dran…'}
                </span>
                {showFastForward && (
                  <button onClick={toggleFastMode}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      fastMode ? 'bg-amber-500 text-gray-900 hover:bg-amber-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}>
                    {fastMode ? '⏩ Schnell' : '⏩ Vorspulen'}
                  </button>
                )}
              </div>
            )}

            {/* Halbzeit-Screen */}
            {phase === 'half_time' && (
              <div className="space-y-3">
                <div className="bg-amber-900/30 border border-amber-600/40 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="text-center space-y-1">
                    <div className="text-3xl">{half === 1 ? '🍺' : half === 2 ? '🍻' : '🏆'}</div>
                    <h2 className="text-lg font-bold text-amber-400">
                      {half === 1 ? '1. Halbzeit beendet' : '2. Halbzeit beendet'}
                    </h2>
                  </div>
                  {half === 1 && half1LoserName && (
                    <p className="text-center text-gray-300 text-sm">
                      <span className="font-bold text-red-400">{half1LoserName}</span>{' '}hat die 1. Halbzeit verloren.
                    </p>
                  )}
                  {half === 2 && sameLoser && (
                    <div className="text-center space-y-1">
                      <p className="text-gray-300 text-sm">
                        <span className="font-bold text-red-400">{half2LoserName}</span>{' '}hat beide Hälften verloren.
                      </p>
                      <p className="text-amber-400 font-semibold">→ gibt eine Runde aus!</p>
                    </div>
                  )}
                  {half === 2 && !sameLoser && half1LoserName && half2LoserName && (
                    <div className="text-center space-y-1">
                      <p className="text-gray-300 text-sm">
                        <span className="font-bold text-orange-400">{half1LoserName}</span>{' '}(1. HZ) und{' '}
                        <span className="font-bold text-orange-400">{half2LoserName}</span>{' '}(2. HZ) spielen das Finale.
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
                {isHost && (
                  <button onClick={startSecondHalf}
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all">
                    {half === 1 ? '2. Halbzeit starten' : isFinaleSetup ? 'Finale starten' : 'Ergebnis anzeigen'}
                  </button>
                )}
                {!isHost && (
                  <div className="bg-gray-800/60 border border-gray-600 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
                    Warte auf Host…
                  </div>
                )}
              </div>
            )}

            {/* Spiel vorbei */}
            {phase === 'finished' && (
              <div className="space-y-3">
                <div className="bg-red-900/40 border border-red-500/50 rounded-2xl p-4 sm:p-5 text-center space-y-1">
                  <div className="text-3xl">🎉</div>
                  <h2 className="text-lg font-bold text-red-400">Spiel beendet!</h2>
                  <p className="text-gray-300 text-sm">
                    <span className="font-bold text-red-400">
                      {[...players].sort((a, b) => b.covers - a.covers)[0].name}
                    </span>{' '}gibt eine Runde aus!
                  </p>
                </div>
                <div className="flex gap-2">
                  {restartGame && isHost && (
                    <button onClick={restartGame}
                      className="flex-1 py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all">
                      Nochmal 🎲
                    </button>
                  )}
                  {!isHost && restartGame === undefined && (
                    <div className="flex-1 bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
                      Warte auf Host…
                    </div>
                  )}
                  {resetGame && (
                    <button onClick={resetGame}
                      className={`py-4 rounded-2xl font-bold text-lg bg-gray-700 hover:bg-gray-600 text-white transition-all ${restartGame && isHost ? 'px-5' : 'flex-1'}`}>
                      Beenden
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Rechte Spalte: Rundenhistorie ─── */}
        <div className={`w-full md:w-64 shrink-0 ${showHistory ? 'block' : 'hidden md:block'}`}>
          <div className="bg-gray-800/50 rounded-2xl p-3">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Rundenhistorie</h2>
            <div className="max-h-[50vh] md:max-h-[70vh] overflow-y-auto">
              <RoundHistory history={roundHistory} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
