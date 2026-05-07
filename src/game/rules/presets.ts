import type { GameRules } from './types';

export const STANDARD_RULES: GameRules = {
  minPlayers: 2,
  maxPlayers: 8,
  generalEnabled: true,
  juleEnabled: false,
  strasseAusHand: false,
  juleAusHand: false,
  generalAusHand: false,
  sechsenDrehenEnabled: true,
  mauernEnabled: false,
  heldDiceReturnEnabled: false,
  einwuerfelnEnabled: false,
  schockAusSchlagtNachgelegt: true,
  ersterHochEnabled: false,
  ersterHochHeadsUp: false,
  verdecktEnabled: true,
  totalCovers: 13,
};

export const RULE_DESCRIPTIONS: Record<
  keyof Omit<GameRules, 'minPlayers' | 'maxPlayers' | 'totalCovers'>,
  { label: string; description: string }
> = {
  generalEnabled: {
    label: 'mit General',
    description: 'Drei gleiche Augen (Pasch) gelten als General — eine Sonderkombination über der Straße.',
  },
  juleEnabled: {
    label: 'mit Jule',
    description: '1-2-4 ist die zweithöchste Kombination nach Schock Aus (7 Deckel).',
  },
  strasseAusHand: {
    label: 'Straße aus der Hand',
    description: 'Straßen gelten nur beim ersten Wurf (aus der Hand).',
  },
  juleAusHand: {
    label: 'Jule aus der Hand',
    description: 'Jule (1-2-4) gilt nur beim ersten Wurf (aus der Hand).',
  },
  generalAusHand: {
    label: 'General aus der Hand',
    description: 'General (Pasch) gilt nur beim ersten Wurf (aus der Hand).',
  },
  sechsenDrehenEnabled: {
    label: 'Sechsen drehen',
    description: 'Zwei 6er → eine 1 drehen. Drei 6er → zwei 1er drehen. Danach ist ein Wurf Pflicht.',
  },
  mauernEnabled: {
    label: 'Mauern (Bauen)',
    description: 'Beliebige Würfel können gehalten werden, nicht nur 1er.',
  },
  heldDiceReturnEnabled: {
    label: 'Gehaltene Würfel zurück',
    description: 'Rausgelegte Würfel dürfen wieder zurückgelegt und neu gewürfelt werden.',
  },
  einwuerfelnEnabled: {
    label: 'Einwürfeln',
    description: 'Ausgeschiedene Spieler dürfen erneut ins Spiel einsteigen.',
  },
  schockAusSchlagtNachgelegt: {
    label: 'Schock Aus schlägt Vorwurf',
    description: 'Schock Aus (1-1-1) schlägt immer, auch wenn der Vorwurf bereits besser war.',
  },
  ersterHochEnabled: {
    label: 'Erster Hoch',
    description: 'In der ersten Runde jeder Halbzeit darf jeder Spieler nur einmal würfeln.',
  },
  ersterHochHeadsUp: {
    label: 'Erster Hoch im Finale',
    description: 'Erster Hoch gilt auch im Finale (Heads-Up).',
  },
  verdecktEnabled: {
    label: 'Verdeckt',
    description: 'Der letzte Wurf bleibt umgedreht; nur gehaltene Würfel sind für andere sichtbar.',
  },
};
