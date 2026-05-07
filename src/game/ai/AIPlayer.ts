import type { AISkillLevel, AIRiskProfile, AIPlayerConfig, TurnState, GameState, DieValue, EvaluatedRoll } from '../rules/types';
import { evaluateRoll } from '../rules/combinations';

export interface AITurnAction {
  held: [boolean, boolean, boolean];
  rollAgain: boolean;
}

type InternalStrategy = 'safe' | 'balanced' | 'aggressive';

function riskToStrategy(riskProfile: AIRiskProfile): InternalStrategy {
  if (riskProfile === 'defensiv') return 'safe';
  if (riskProfile === 'ausgewogen') return 'balanced';
  return 'aggressive';
}

export function getAIAction(
  config: AIPlayerConfig,
  turn: TurnState,
  state: GameState
): AITurnAction {
  const { dice, rollCount, held: currentHeld } = turn;
  const rules = state.rules;
  const maxRolls = state.maxRollsThisRound;
  const { skillLevel, riskProfile } = config;
  const strategy = riskToStrategy(riskProfile);

  if (rollCount >= maxRolls) return { held: currentHeld, rollAgain: false };

  const current = evaluateRoll(dice, rules);
  const onesHeld: [boolean, boolean, boolean] = dice.map(d => d === 1) as [boolean, boolean, boolean];

  // Anfänger macht zufällige Fehler: versteht die optimale Strategie nicht immer
  if (skillLevel === 'anfaenger' && Math.random() < 0.28) {
    if (rollCount >= 2) return { held: currentHeld, rollAgain: false };
    return { held: [false, false, false], rollAgain: true };
  }

  // Schock Aus → immer stehen
  if (current.type === 'schock_aus') return { held: currentHeld, rollAgain: false };

  // Schock 5/6 → safe/balanced stehen; aggressive spekuliert auf Schock Aus
  if (current.type === 'schock' && current.covers >= 5) {
    if (strategy !== 'aggressive') return { held: currentHeld, rollAgain: false };
    return { held: onesHeld, rollAgain: true };
  }

  // General: hohe Generals stehen lassen, schlechte neu würfeln
  if (current.type === 'general') {
    const val = dice[0];
    if (val >= 5 && strategy !== 'aggressive') return { held: currentHeld, rollAgain: false };
    if (val >= 4 && strategy === 'safe') return { held: currentHeld, rollAgain: false };
    return { held: [false, false, false], rollAgain: true };
  }

  // Jule → immer stehen
  if (current.type === 'jule') return { held: currentHeld, rollAgain: false };

  // Schock 3/4 oder Schock Doof: 1er halten und auf Schock Aus spekulieren
  if (current.type === 'schock' || current.type === 'schock_doof') {
    if (strategy === 'safe') return { held: currentHeld, rollAgain: false };
    return { held: onesHeld, rollAgain: true };
  }

  // Straße: safe bleibt ab Wurf 2, andere würfeln neu
  if (current.type === 'strasse') {
    if (strategy === 'safe' && rollCount >= 2) return { held: currentHeld, rollAgain: false };
    return { held: [false, false, false], rollAgain: true };
  }

  // Einfacher Wurf: 1er halten (Schock-Aus-Chance)
  const onesCount = dice.filter(d => d === 1).length;

  if (onesCount === 2) return { held: onesHeld, rollAgain: true };

  if (onesCount === 1) {
    if (strategy === 'safe' && rollCount >= 2) return { held: currentHeld, rollAgain: false };
    return { held: onesHeld, rollAgain: true };
  }

  // Keine 1er — Mauern-Strategie (Anfänger kennt diese Taktik nicht)
  if (rules.mauernEnabled && skillLevel !== 'anfaenger') {
    const mauernAction = computeMauernAction(strategy, skillLevel, dice, current, turn, state);
    if (mauernAction) return mauernAction;
  }

  // Keine 1er, keine Mauern-Möglichkeit — reine Wertentscheidung
  // Profi hat schärfere Schwellenwerte (nimmt weniger schlechte Würfe hin)
  const simpleVal = current.value;
  const t = skillLevel === 'profi'
    ? { aggStop: 620, balStop: 421, safeStop: 311 }
    : { aggStop: 640, balStop: 432, safeStop: 321 };

  if (strategy === 'aggressive') {
    if (simpleVal >= t.aggStop) return { held: currentHeld, rollAgain: false };
    return { held: [false, false, false], rollAgain: true };
  }
  if (strategy === 'balanced') {
    if (rollCount === 1) return { held: [false, false, false], rollAgain: true };
    if (simpleVal < t.balStop) return { held: [false, false, false], rollAgain: true };
    return { held: currentHeld, rollAgain: false };
  }
  // safe
  if (simpleVal < t.safeStop) return { held: [false, false, false], rollAgain: true };
  return { held: currentHeld, rollAgain: false };
}

// ─── Mauern-Strategie ─────────────────────────────────────────────────────────

function computeMauernAction(
  strategy: InternalStrategy,
  skillLevel: AISkillLevel,
  dice: [DieValue, DieValue, DieValue],
  current: EvaluatedRoll,
  turn: TurnState,
  state: GameState,
): AITurnAction | null {
  const rules = state.rules;
  const rollsLeft = state.maxRollsThisRound - turn.rollCount;
  if (rollsLeft <= 0) return null;

  // Profi baut auch mit 1 verbleibendem Wurf; Fortgeschritten braucht 2
  const minRolls = skillLevel === 'profi' ? 1 : 2;

  // 1. Jule bauen: zwei der drei Komponenten {1,2,4} halten
  if (rules.juleEnabled && !rules.juleAusHand) {
    const juleHeld = findJuleComponents(dice);
    if (juleHeld) {
      const worthIt = strategy === 'aggressive' || strategy === 'balanced' || rollsLeft >= minRolls;
      if (worthIt) return { held: juleHeld, rollAgain: true };
    }
  }

  // 2. General bauen: Paar halten, auf dritten gleichen Würfel hoffen
  if (rules.generalEnabled && !rules.generalAusHand) {
    const pairHeld = findPairToHold(dice);
    if (pairHeld) {
      const worthIt = strategy === 'aggressive' || strategy === 'balanced' || rollsLeft >= minRolls;
      if (worthIt) return { held: pairHeld, rollAgain: true };
    }
  }

  // 3. Straße bauen: zwei aufeinanderfolgende Würfel halten
  if (!rules.strasseAusHand) {
    const strasseHeld = findStrasseComponents(dice);
    if (strasseHeld) {
      const worthIt = strategy === 'aggressive' ||
        (strategy === 'balanced' && rollsLeft >= 2) ||
        (skillLevel === 'profi' && rollsLeft >= 1);
      if (worthIt) return { held: strasseHeld, rollAgain: true };
    }
  }

  // 4. Defensiv: hohe Würfel halten wenn Gegner bereits fertig und man hinten liegt
  const defensiveHeld = computeDefensiveHold(dice, current, turn, state, strategy);
  if (defensiveHeld) return { held: defensiveHeld, rollAgain: true };

  return null;
}

// Findet genau zwei der drei Jule-Komponenten {1, 2, 4}
function findJuleComponents(dice: [DieValue, DieValue, DieValue]): [boolean, boolean, boolean] | null {
  const juleVals = new Set<DieValue>([1, 2, 4]);
  const held: [boolean, boolean, boolean] = [false, false, false];
  const used = new Set<DieValue>();
  let count = 0;

  for (let i = 0; i < 3; i++) {
    const d = dice[i] as DieValue;
    if (juleVals.has(d) && !used.has(d)) {
      held[i] = true;
      used.add(d);
      count++;
    }
  }
  return count === 2 ? held : null;
}

// Findet das höchstwertige Paar für einen General-Versuch
function findPairToHold(dice: [DieValue, DieValue, DieValue]): [boolean, boolean, boolean] | null {
  const seen: Partial<Record<number, number>> = {};
  let bestPair: [number, number] | null = null;
  let bestVal = 0;

  for (let i = 0; i < 3; i++) {
    const d = dice[i];
    if (seen[d] !== undefined && d > bestVal) {
      bestPair = [seen[d]!, i];
      bestVal = d;
    }
    if (seen[d] === undefined) seen[d] = i;
  }

  if (!bestPair) return null;
  const held: [boolean, boolean, boolean] = [false, false, false];
  held[bestPair[0]] = true;
  held[bestPair[1]] = true;
  return held;
}

// Findet das höchste Paar aufeinanderfolgender Würfel für einen Straßen-Versuch
function findStrasseComponents(dice: [DieValue, DieValue, DieValue]): [boolean, boolean, boolean] | null {
  const indexed = dice.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  for (let k = 0; k < indexed.length - 1; k++) {
    if (indexed[k].d - indexed[k + 1].d === 1) {
      const held: [boolean, boolean, boolean] = [false, false, false];
      held[indexed[k].i] = true;
      held[indexed[k + 1].i] = true;
      return held;
    }
  }
  return null;
}

// Defensives Halten: hohe Würfel bewahren wenn man aktuell hinter Gegnern liegt
function computeDefensiveHold(
  dice: [DieValue, DieValue, DieValue],
  current: EvaluatedRoll,
  turn: TurnState,
  state: GameState,
  strategy: InternalStrategy,
): [boolean, boolean, boolean] | null {
  const finishedRolls = Object.entries(state.roundFinalRolls)
    .filter(([id, r]) => r !== null && id !== turn.playerId);

  if (finishedRolls.length === 0) return null;

  const maxOpponentValue = Math.max(...finishedRolls.map(([, r]) => r!.value));
  if (current.value >= maxOpponentValue) return null;

  const minDie: Record<InternalStrategy, number> = { safe: 6, balanced: 5, aggressive: 4 };
  const maxDie = Math.max(...dice);
  if (maxDie < minDie[strategy]) return null;

  const held: [boolean, boolean, boolean] = dice.map(d => d === maxDie) as [boolean, boolean, boolean];
  if (held.every(Boolean)) return null;

  return held;
}

export function getAIPlayerName(index: number): string {
  const names = [
    'Bärtiger Bruno',
    'Kneipenwirt Klaus',
    'Stammtisch-Sepp',
    'Würfel-Walter',
    'Prost-Peter',
    'Hopfen-Helga',
    'Schock-Siegfried',
  ];
  return names[index % names.length];
}
