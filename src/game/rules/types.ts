export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export type CombinationType =
  | 'simple' | 'strasse' | 'general' | 'jule'
  | 'schock_doof' | 'schock' | 'schock_aus';

export interface EvaluatedRoll {
  dice: [DieValue, DieValue, DieValue];
  type: CombinationType;
  value: number;
  covers: number;
  label: string;
}

export interface GameRules {
  minPlayers: number;
  maxPlayers: number;

  // Basis-Kombinationen (Sonderregeln)
  generalEnabled: boolean;     // General (Pasch / drei gleiche)
  juleEnabled: boolean;        // Jule (1-2-4) — zweithöchstes Ergebnis nach Schock Aus

  // Aus-der-Hand Sub-Regeln (Kombination nur gültig ohne vorher gehaltene Würfel)
  strasseAusHand: boolean;
  juleAusHand: boolean;
  generalAusHand: boolean;

  // Würfel-Sonderregeln
  sechsenDrehenEnabled: boolean;
  mauernEnabled: boolean;
  heldDiceReturnEnabled: boolean;
  einwuerfelnEnabled: boolean;
  schockAusSchlagtNachgelegt: boolean;

  // Spielstruktur
  ersterHochEnabled: boolean;   // Runde 1 jeder Halbzeit: max 1 Wurf
  ersterHochHeadsUp: boolean;   // Erster Hoch auch im Finale

  // Anzeige
  verdecktEnabled: boolean;     // Letzter Wurf bleibt verdeckt; nur gehaltene Würfel sichtbar

  totalCovers: number;
}

export type PlayerType = 'human' | 'ai';

export type AISkillLevel = 'anfaenger' | 'fortgeschritten' | 'profi';
export type AIRiskProfile = 'defensiv' | 'ausgewogen' | 'offensiv';

export interface AIPlayerConfig {
  skillLevel: AISkillLevel;
  riskProfile: AIRiskProfile;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  type: PlayerType;
  aiConfig?: AIPlayerConfig;
  covers: number;
  isEliminated: boolean;
  isOut: boolean;
}

export interface TurnState {
  playerId: string;
  dice: [DieValue, DieValue, DieValue];
  held: [boolean, boolean, boolean];
  // Würfel die bereits durch einen Wurf "committed" wurden (können nicht mehr zurück)
  committedHeld: [boolean, boolean, boolean];
  rollCount: number;
  mustRoll: boolean;
  bestRoll: EvaluatedRoll | null;
  finalRoll: EvaluatedRoll | null;
}

export type GamePhase = 'loading' | 'playing' | 'round_result' | 'half_time' | 'finished';

export interface RoundResult {
  loserId: string;
  winnerId: string;
  coversLost: number;
  fromPool: boolean;
  schockAus: boolean;
  tiebreakReason: string | null;  // z.B. "Vorhand" oder "aus der Hand"
  finalRolls: Record<string, EvaluatedRoll>;
  highestRoll: EvaluatedRoll;
}

export interface RoundSummary {
  round: number;
  half: 1 | 2 | 3;
  loserName: string;
  loserRoll: EvaluatedRoll;
  winnerName: string;
  winnerRoll: EvaluatedRoll;
  coversLost: number;
  fromPool: boolean;
  schockAus: boolean;
  tiebreakReason: string | null;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  rules: GameRules;
  currentPlayerId: string;
  round: number;
  half: 1 | 2 | 3;
  half1Loser: string | null;
  half2Loser: string | null;
  coverPool: number;
  roundFinalRolls: Record<string, EvaluatedRoll | null>;
  roundHeldAtFinalization: Record<string, [boolean, boolean, boolean] | null>;
  roundRollCounts: Record<string, number>;
  roundMaxAtFinalization: Record<string, number>; // maxRolls zum Zeitpunkt des Abschließens
  activeTurn: TurnState | null;
  maxRollsThisRound: number;
  roundPlayerOrder: string[];
  lastRoundResult: RoundResult | null;
  roundHistory: RoundSummary[];
  winner: string | null;
  log: string[];
}
