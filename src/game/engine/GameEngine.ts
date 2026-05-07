import { evaluateRoll, rollDice, rollUnheld, compareRolls, canHoldDie, canDrehSechsen, drehSechsen } from '../rules/combinations';
import type { GameState, GameRules, Player, EvaluatedRoll, TurnState, RoundResult, RoundSummary } from '../rules/types';
import { STANDARD_RULES } from '../rules/presets';
import { getAIAction } from '../ai/AIPlayer';

function createInitialState(players: Player[], rules: GameRules): GameState {
  return {
    phase: 'loading',
    players,
    rules,
    currentPlayerId: players[0].id,
    round: 1,
    half: 1,
    half1Loser: null,
    half2Loser: null,
    coverPool: rules.totalCovers,
    roundFinalRolls: Object.fromEntries(players.map((p) => [p.id, null])),
    roundHeldAtFinalization: Object.fromEntries(players.map((p) => [p.id, null])),
    activeTurn: null,
    maxRollsThisRound: 3,
    roundPlayerOrder: players.map(p => p.id),
    roundRollCounts: {},
    roundMaxAtFinalization: {},
    lastRoundResult: null,
    roundHistory: [],
    winner: null,
    log: [],
  };
}

export class GameEngine {
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  fastMode = false;

  constructor(players: Player[], rules: GameRules = STANDARD_RULES, onStateChange: (state: GameState) => void) {
    this.state = createInitialState(players, rules);
    this.onStateChange = onStateChange;
  }

  getState(): GameState { return structuredClone(this.state); }

  private emit() { this.onStateChange(structuredClone(this.state)); }

  private addLog(msg: string) {
    this.state.log = [msg, ...this.state.log].slice(0, 20);
  }

  private activePlayers(): Player[] {
    return this.state.players.filter(p => !p.isEliminated && !p.isOut);
  }

  private computeRoundOrderFromList(players: Player[], starterId: string): string[] {
    const startIdx = players.findIndex(p => p.id === starterId);
    if (startIdx === -1) return players.map(p => p.id);
    return [...players.slice(startIdx), ...players.slice(0, startIdx)].map(p => p.id);
  }

  private nextActivePlayerId(afterId: string): string {
    const active = this.activePlayers();
    const idx = active.findIndex(p => p.id === afterId);
    return active[(idx + 1) % active.length].id;
  }

  private computeMaxRolls(half: 1 | 2 | 3, round: number): number {
    const { ersterHochEnabled, ersterHochHeadsUp } = this.state.rules;
    if (ersterHochEnabled && round === 1) {
      if (half < 3 || ersterHochHeadsUp) return 1;
    }
    return 3;
  }

  // ─── Startrunde ───────────────────────────────────────────────────────

  startLoadingRound(): void {
    const rolls: Record<string, EvaluatedRoll> = {};
    for (const p of this.activePlayers()) rolls[p.id] = evaluateRoll(rollDice(), this.state.rules);

    let starterId = this.activePlayers()[0].id;
    for (const p of this.activePlayers()) {
      if (compareRolls(rolls[p.id], rolls[starterId]) < 0) starterId = p.id;
    }

    const active = this.activePlayers();
    const order = this.computeRoundOrderFromList(active, starterId);
    this.addLog(`Laden: ${this.state.players.find(p => p.id === starterId)?.name} beginnt.`);

    this.state = {
      ...this.state,
      phase: 'playing',
      currentPlayerId: starterId,
      roundFinalRolls: Object.fromEntries(active.map(p => [p.id, null])),
      roundHeldAtFinalization: Object.fromEntries(active.map(p => [p.id, null])),
      activeTurn: null,
      maxRollsThisRound: this.computeMaxRolls(1, 1),
      roundPlayerOrder: order,
      roundRollCounts: {},
      roundMaxAtFinalization: {},
    };
    this.emit();
  }

  // ─── Würfelzug ────────────────────────────────────────────────────────

  rollActive(): TurnState {
    const { currentPlayerId, activeTurn, rules } = this.state;
    let newDice: [1|2|3|4|5|6, 1|2|3|4|5|6, 1|2|3|4|5|6];
    let rollCount: number;
    let held: [boolean, boolean, boolean];
    let committedHeld: [boolean, boolean, boolean];

    if (!activeTurn) {
      newDice = rollDice();
      rollCount = 1;
      held = [false, false, false];
      committedHeld = [false, false, false];
    } else {
      newDice = rollUnheld(activeTurn.dice, activeTurn.held);
      rollCount = activeTurn.rollCount + 1;
      held = activeTurn.held;
      committedHeld = activeTurn.held; // held-through-a-roll → committed
    }

    const evaluated = evaluateRoll(newDice, rules, rollCount);
    const turn: TurnState = {
      playerId: currentPlayerId,
      dice: newDice,
      held,
      committedHeld,
      rollCount,
      mustRoll: false,
      bestRoll: evaluated,
      finalRoll: null,
    };

    this.state = { ...this.state, activeTurn: turn };
    this.emit();
    return turn;
  }

  // Sechsen drehen: dreht (n-1) Sechsen zu 1ern und löst Pflichtwurf aus
  applySechsenDrehen(): void {
    const { activeTurn, rules } = this.state;
    if (!activeTurn) return;
    if (!canDrehSechsen(activeTurn.dice, rules)) return;
    if (activeTurn.rollCount >= this.state.maxRollsThisRound) return;

    const newDice = drehSechsen(activeTurn.dice);
    const newHeld: [boolean, boolean, boolean] = newDice.map(d => d === 1) as [boolean, boolean, boolean];

    this.state = {
      ...this.state,
      activeTurn: { ...activeTurn, dice: newDice, held: newHeld, mustRoll: true },
    };
    this.rollActive();
  }

  toggleHold(dieIndex: 0 | 1 | 2): void {
    const { activeTurn, rules } = this.state;
    if (!activeTurn) return;
    if (activeTurn.mustRoll) return;
    const die = activeTurn.dice[dieIndex];
    if (!canHoldDie(die, rules)) return;

    // Nur committed-gehaltene Würfel (= bereits durch einen Wurf gelaufen) sperren
    const isCommitted = activeTurn.committedHeld[dieIndex];
    if (isCommitted && !rules.heldDiceReturnEnabled) return;

    const newHeld: [boolean, boolean, boolean] = [...activeTurn.held] as [boolean, boolean, boolean];
    newHeld[dieIndex] = !newHeld[dieIndex];
    this.state = { ...this.state, activeTurn: { ...activeTurn, held: newHeld } };
    this.emit();
  }

  finalizeTurn(): void {
    const { activeTurn, currentPlayerId, rules, maxRollsThisRound } = this.state;
    if (!activeTurn) return;
    if (activeTurn.mustRoll) return;

    const finalRoll = evaluateRoll(activeTurn.dice, rules, activeTurn.rollCount);
    const isFirstPlayer = Object.values(this.state.roundFinalRolls).every(r => r === null);
    // Capture maxRolls before potential update (for stoodEarlyAt display)
    const maxAtFinalization = maxRollsThisRound;
    const newMax = isFirstPlayer ? activeTurn.rollCount : maxRollsThisRound;

    this.addLog(`${this.state.players.find(p => p.id === currentPlayerId)?.name}: ${finalRoll.label} (${activeTurn.rollCount}×)`);

    const newFinalRolls = { ...this.state.roundFinalRolls, [currentPlayerId]: finalRoll };
    const newRollCounts = { ...this.state.roundRollCounts, [currentPlayerId]: activeTurn.rollCount };
    // committedHeld = vor dem letzten Wurf rausgelegte Würfel (sichtbar); held kann noch mehr enthalten
    const newHeldAtFinalization = { ...this.state.roundHeldAtFinalization, [currentPlayerId]: activeTurn.committedHeld };
    const newMaxAtFinalization = { ...this.state.roundMaxAtFinalization, [currentPlayerId]: maxAtFinalization };
    const allDone = this.activePlayers().every(p => newFinalRolls[p.id] !== null);

    if (allDone) {
      this.state = {
        ...this.state,
        roundFinalRolls: newFinalRolls,
        roundRollCounts: newRollCounts,
        roundHeldAtFinalization: newHeldAtFinalization,
        roundMaxAtFinalization: newMaxAtFinalization,
        phase: 'round_result',
        activeTurn: null,
        maxRollsThisRound: newMax,
      };
      this.emit();
    } else {
      this.state = {
        ...this.state,
        roundFinalRolls: newFinalRolls,
        roundRollCounts: newRollCounts,
        roundHeldAtFinalization: newHeldAtFinalization,
        roundMaxAtFinalization: newMaxAtFinalization,
        activeTurn: null,
        currentPlayerId: this.nextActivePlayerId(currentPlayerId),
        maxRollsThisRound: newMax,
      };
      this.emit();
    }
  }

  // ─── KI-Zug ───────────────────────────────────────────────────────────

  async performAITurn(playerId: string): Promise<void> {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.type !== 'ai') return;

    await delay(this.fastMode ? 50 : 400 + Math.random() * 500);
    this.rollActive();

    while (true) {
      const turn = this.state.activeTurn;
      if (!turn) break;

      if (
        this.state.rules.sechsenDrehenEnabled &&
        canDrehSechsen(turn.dice, this.state.rules) &&
        turn.rollCount < this.state.maxRollsThisRound
      ) {
        await delay(this.fastMode ? 30 : 300);
        this.applySechsenDrehen();
        continue;
      }

      const action = getAIAction(
        player.aiConfig ?? { skillLevel: 'fortgeschritten', riskProfile: 'ausgewogen' },
        turn,
        this.state,
      );
      if (!action.rollAgain || turn.rollCount >= this.state.maxRollsThisRound) break;

      this.state = { ...this.state, activeTurn: { ...turn, held: action.held } };
      this.emit();
      await delay(this.fastMode ? 30 : 350 + Math.random() * 350);
      this.rollActive();
    }

    await delay(this.fastMode ? 30 : 250);
    this.finalizeTurn();
  }

  // ─── Rundenauswertung ─────────────────────────────────────────────────

  private evaluateRound(): void {
    const active = this.activePlayers();
    const rolls = this.state.roundFinalRolls;
    const rollCounts = this.state.roundRollCounts;
    const playerOrder = this.state.roundPlayerOrder;

    // Spieler nach Wurf sortieren (aufsteigend = schlechtester zuerst)
    // Tiebreak: gleicher Wert → Nachhand verliert; außer Nachhand hat "aus der Hand" gewürfelt
    const sorted = [...active].sort((a, b) => {
      const diff = (rolls[a.id]?.value ?? 0) - (rolls[b.id]?.value ?? 0);
      if (diff !== 0) return diff;

      const aIdx = playerOrder.indexOf(a.id);
      const bIdx = playerOrder.indexOf(b.id);
      const aNachhand = aIdx > bIdx;
      if (aNachhand) {
        return (rollCounts[a.id] === 1) ? 1 : -1;
      } else {
        return (rollCounts[b.id] === 1) ? -1 : 1;
      }
    });

    const loserId = sorted[0].id;
    const winnerId = sorted[sorted.length - 1].id;
    const loserRoll = rolls[loserId]!;
    const winnerRoll = rolls[winnerId]!;
    const isSchockAus = winnerRoll.type === 'schock_aus';

    // Tiebreak-Grund ermitteln
    let tiebreakReason: string | null = null;
    if (sorted.length >= 2) {
      const loserVal = rolls[sorted[0].id]?.value ?? 0;
      const tiedPartner = sorted.slice(1).find(p => (rolls[p.id]?.value ?? 0) === loserVal);
      if (tiedPartner) {
        const loserOrder = playerOrder.indexOf(sorted[0].id);
        const partnerOrder = playerOrder.indexOf(tiedPartner.id);
        if (loserOrder > partnerOrder) {
          // Verlierer ist Nachhand
          tiebreakReason = 'Vorhand';
        } else {
          // Verlierer ist Vorhand, Partner (Nachhand) gewinnt → nur durch aus der Hand
          if (rollCounts[tiedPartner.id] === 1) {
            tiebreakReason = 'aus der Hand';
          }
        }
      }
    }

    let newCoverPool = this.state.coverPool;
    let updatedPlayers = [...this.state.players];
    let actualCoversLost = 0;
    let fromPool = false;

    if (isSchockAus) {
      const othersCovers = updatedPlayers.filter(p => p.id !== loserId).reduce((s, p) => s + p.covers, 0);
      actualCoversLost = newCoverPool + othersCovers;
      newCoverPool = 0;
      updatedPlayers = updatedPlayers.map(p => p.id !== loserId ? { ...p, covers: 0 } : p);
    } else if (newCoverPool > 0) {
      actualCoversLost = Math.min(winnerRoll.covers, newCoverPool);
      newCoverPool -= actualCoversLost;
      fromPool = true;
    } else {
      const winner = updatedPlayers.find(p => p.id === winnerId)!;
      actualCoversLost = Math.min(winnerRoll.covers, winner.covers);
      updatedPlayers = updatedPlayers.map(p =>
        p.id === winnerId ? { ...p, covers: p.covers - actualCoversLost } : p
      );
    }

    updatedPlayers = updatedPlayers.map(p =>
      p.id === loserId ? { ...p, covers: p.covers + actualCoversLost } : p
    );

    if (newCoverPool === 0) {
      updatedPlayers = updatedPlayers.map(p => ({ ...p, isOut: !p.isEliminated && p.covers === 0 }));
    } else {
      updatedPlayers = updatedPlayers.map(p => ({ ...p, isOut: false }));
    }

    const loserName = updatedPlayers.find(p => p.id === loserId)?.name ?? '';
    const winnerName = updatedPlayers.find(p => p.id === winnerId)?.name ?? '';
    const tieTag = tiebreakReason ? ` [${tiebreakReason}]` : '';
    this.addLog(`R${this.state.round}: ${loserName} (${loserRoll.label}) −${actualCoversLost}${tieTag} ← ${winnerName} (${winnerRoll.label})`);

    const summary: RoundSummary = {
      round: this.state.round, half: this.state.half,
      loserName, loserRoll, winnerName, winnerRoll,
      coversLost: actualCoversLost, fromPool, schockAus: isSchockAus,
      tiebreakReason,
    };

    const roundResult: RoundResult = {
      loserId, winnerId, coversLost: actualCoversLost, fromPool,
      schockAus: isSchockAus,
      tiebreakReason,
      finalRolls: rolls as Record<string, EvaluatedRoll>,
      highestRoll: winnerRoll,
    };

    const newHistory = [summary, ...this.state.roundHistory];
    const halfLoser = updatedPlayers.find(p => p.covers >= this.state.rules.totalCovers);

    if (halfLoser) {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        coverPool: newCoverPool,
        phase: 'half_time',
        half1Loser: this.state.half === 1 ? halfLoser.id : this.state.half1Loser,
        half2Loser: this.state.half === 2 ? halfLoser.id : this.state.half2Loser,
        lastRoundResult: roundResult,
        roundHistory: newHistory,
      };
      this.emit();
    } else {
      const nextActive = updatedPlayers.filter(p => !p.isEliminated && !p.isOut);
      const nextStarter = nextActive.find(p => p.id === loserId) ?? nextActive[0];
      const nextOrder = this.computeRoundOrderFromList(nextActive, nextStarter.id);
      const nextRound = this.state.round + 1;
      const nextHalf = this.state.half;

      this.state = {
        ...this.state,
        players: updatedPlayers,
        coverPool: newCoverPool,
        phase: 'playing',
        round: nextRound,
        currentPlayerId: nextStarter.id,
        roundFinalRolls: Object.fromEntries(nextActive.map(p => [p.id, null])),
        roundHeldAtFinalization: Object.fromEntries(nextActive.map(p => [p.id, null])),
        roundRollCounts: {},
        roundMaxAtFinalization: {},
        activeTurn: null,
        maxRollsThisRound: this.computeMaxRolls(nextHalf, nextRound),
        roundPlayerOrder: nextOrder,
        lastRoundResult: roundResult,
        roundHistory: newHistory,
      };
      this.emit();
    }
  }

  // ─── Rundenauswertung anstoßen (nach "Weiter"-Klick) ─────────────────

  proceedAfterRound(): void {
    if (this.state.phase !== 'round_result') return;
    this.evaluateRound();
  }

  // ─── Halbzeit / Finale ────────────────────────────────────────────────

  proceedAfterHalfTime(): void {
    const { half, half1Loser, half2Loser } = this.state;
    if (half === 1) {
      this.startHalf(2, half1Loser!);
    } else if (half === 2) {
      if (half1Loser === half2Loser) {
        this.state = { ...this.state, phase: 'finished', winner: null };
        this.emit();
      } else {
        this.startFinale(half1Loser!, half2Loser!);
      }
    } else {
      this.state = { ...this.state, phase: 'finished', winner: null };
      this.emit();
    }
  }

  private startHalf(half: 2 | 3, starterId: string): void {
    const resetPlayers = this.state.players.map(p => ({ ...p, covers: 0, isOut: false }));
    const active = resetPlayers.filter(p => !p.isEliminated);
    const order = this.computeRoundOrderFromList(active, starterId);
    this.addLog(`--- ${half === 2 ? '2. Halbzeit' : 'Finale'} ---`);
    this.state = {
      ...this.state,
      phase: 'playing',
      half: half as 1 | 2 | 3,
      players: resetPlayers,
      coverPool: this.state.rules.totalCovers,
      currentPlayerId: starterId,
      round: 1,
      roundFinalRolls: Object.fromEntries(active.map(p => [p.id, null])),
      roundHeldAtFinalization: Object.fromEntries(active.map(p => [p.id, null])),
      roundRollCounts: {},
      roundMaxAtFinalization: {},
      activeTurn: null,
      maxRollsThisRound: this.computeMaxRolls(half as 1 | 2 | 3, 1),
      roundPlayerOrder: order,
      lastRoundResult: null,
    };
    this.emit();
  }

  private startFinale(p1Id: string, p2Id: string): void {
    const resetPlayers = this.state.players.map(p => ({
      ...p, covers: 0, isOut: p.id !== p1Id && p.id !== p2Id,
    }));
    const finalists = resetPlayers.filter(p => p.id === p1Id || p.id === p2Id);
    this.addLog(`--- Finale: ${finalists[0]?.name} vs ${finalists[1]?.name} ---`);
    this.state = {
      ...this.state,
      phase: 'playing',
      half: 3,
      players: resetPlayers,
      coverPool: this.state.rules.totalCovers,
      currentPlayerId: p1Id,
      round: 1,
      roundFinalRolls: Object.fromEntries(finalists.map(p => [p.id, null])),
      roundHeldAtFinalization: Object.fromEntries(finalists.map(p => [p.id, null])),
      roundRollCounts: {},
      roundMaxAtFinalization: {},
      activeTurn: null,
      maxRollsThisRound: this.computeMaxRolls(3, 1),
      roundPlayerOrder: [p1Id, p2Id],
      lastRoundResult: null,
    };
    this.emit();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
