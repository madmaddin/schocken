import type { DieValue, CombinationType, EvaluatedRoll, GameRules } from './types';

// Wertebereiche für Kombinationsvergleiche (höher = besser)
// simple:      1–654    (c*100 + b*10 + a, sortiert aufsteigend)
// strasse:     700–900
// general:     1100–1600
// jule:        50000    (zweithöchstes Ergebnis, 7 Deckel)
// schock_doof: 2000
// schock 3-6:  3000–6000
// schock_aus:  99999

function sorted(dice: [DieValue, DieValue, DieValue]): [DieValue, DieValue, DieValue] {
  return [...dice].sort((a, b) => a - b) as [DieValue, DieValue, DieValue];
}

export function evaluateRoll(
  dice: [DieValue, DieValue, DieValue],
  rules: GameRules,
  rollCount = 1
): EvaluatedRoll {
  const s = sorted(dice);
  const [a, b, c] = s;

  // Schock Aus: 1-1-1
  if (a === 1 && b === 1 && c === 1) {
    return { dice, type: 'schock_aus', value: 99999, covers: 0, label: 'Schock Aus!' };
  }

  // Schock X: 1-1-X (X ≠ 1)
  if (a === 1 && b === 1) {
    if (c === 2) {
      return { dice, type: 'schock_doof', value: 2000, covers: 2, label: 'Schock Doof' };
    }
    return {
      dice, type: 'schock',
      value: 3000 + (c - 3) * 1000,
      covers: c,
      label: `Schock ${c}`,
    };
  }

  // Jule: 1-2-4 (optional; zweithöchstes Ergebnis nach Schock Aus)
  if (rules.juleEnabled && a === 1 && b === 2 && c === 4) {
    if (!rules.juleAusHand || rollCount === 1) {
      return { dice, type: 'jule', value: 50000, covers: 7, label: 'Jule! (1-2-4)' };
    }
  }

  // General (Pasch): alle drei gleich — nur wenn Regel aktiv
  if (a === b && b === c && rules.generalEnabled) {
    if (!rules.generalAusHand || rollCount === 1) {
      return {
        dice, type: 'general',
        value: 1100 + (a - 1) * 100,
        covers: 3,
        label: `General ${a}er`,
      };
    }
  }

  // Straße: drei aufeinanderfolgende Zahlen
  if (c - b === 1 && b - a === 1) {
    if (!rules.strasseAusHand || rollCount === 1) {
      const strasseValue = 700 + (a - 2) * 100;
      return { dice, type: 'strasse', value: strasseValue, covers: 2, label: `Straße ${a}-${b}-${c}` };
    }
  }

  // Einfacher Wurf
  const simpleValue = c * 100 + b * 10 + a;
  return { dice, type: 'simple', value: simpleValue, covers: 1, label: `${c}-${b}-${a}` };
}

// Positiv wenn a besser als b
export function compareRolls(a: EvaluatedRoll, b: EvaluatedRoll): number {
  return a.value - b.value;
}

// Kann ein Würfel gehalten werden? (Standard: nur 1er; Mauern: alles)
export function canHoldDie(die: DieValue, rules: GameRules): boolean {
  if (rules.mauernEnabled) return true;
  return die === 1;
}

// Sechsen-Drehen möglich?
export function canDrehSechsen(
  dice: [DieValue, DieValue, DieValue],
  rules: GameRules
): boolean {
  if (!rules.sechsenDrehenEnabled) return false;
  return dice.filter((d) => d === 6).length >= 2;
}

// Sechsen drehen: (Anzahl_6er − 1) Sechsen → 1er, eine 6 bleibt immer übrig.
// 2 Sechsen → 1 wird gedreht → eine 1, eine 6 bleiben
// 3 Sechsen → 2 werden gedreht → zwei 1en, eine 6 bleibt
export function drehSechsen(
  dice: [DieValue, DieValue, DieValue]
): [DieValue, DieValue, DieValue] {
  const sixCount = dice.filter(d => d === 6).length;
  const toFlip = sixCount - 1; // immer eine 6 behalten
  const result: DieValue[] = [...dice];
  let flipped = 0;
  for (let i = 0; i < result.length && flipped < toFlip; i++) {
    if (result[i] === 6) { result[i] = 1; flipped++; }
  }
  return result as [DieValue, DieValue, DieValue];
}

export function rollDice(): [DieValue, DieValue, DieValue] {
  return [
    (Math.floor(Math.random() * 6) + 1) as DieValue,
    (Math.floor(Math.random() * 6) + 1) as DieValue,
    (Math.floor(Math.random() * 6) + 1) as DieValue,
  ];
}

// Würfelt nur die nicht-gehaltenen Würfel neu
export function rollUnheld(
  current: [DieValue, DieValue, DieValue],
  held: [boolean, boolean, boolean]
): [DieValue, DieValue, DieValue] {
  return current.map((die, i) =>
    held[i] ? die : (Math.floor(Math.random() * 6) + 1) as DieValue
  ) as [DieValue, DieValue, DieValue];
}
