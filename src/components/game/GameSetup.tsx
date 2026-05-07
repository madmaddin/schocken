'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { STANDARD_RULES } from '@/game/rules/presets';
import { getAIPlayerName } from '@/game/ai/AIPlayer';
import type { GameRules } from '@/game/rules/types';
import type { AIPlayerConfig, AISkillLevel, AIRiskProfile } from '@/game/rules/types';

const DEFAULT_AI_CONFIG: AIPlayerConfig = { skillLevel: 'fortgeschritten', riskProfile: 'ausgewogen' };

const SKILL_LABELS: Record<AISkillLevel, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschr.',
  profi: 'Profi',
};

const RISK_LABELS: Record<AIRiskProfile, string> = {
  defensiv: 'Defensiv',
  ausgewogen: 'Ausgewogen',
  offensiv: 'Offensiv',
};

export function GameSetup() {
  const [nickname, setNickname] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [rules, setRules] = useState<GameRules>(STANDARD_RULES);
  const [aiConfigs, setAiConfigs] = useState<AIPlayerConfig[]>(
    Array.from({ length: 3 }, () => ({ ...DEFAULT_AI_CONFIG }))
  );
  const [showAIConfig, setShowAIConfig] = useState(false);

  const startTrainingGame = useGameStore((s) => s.startTrainingGame);

  const set = (patch: Partial<GameRules>) => setRules(prev => ({ ...prev, ...patch }));

  const handleAiCountChange = (count: number) => {
    setAiCount(count);
    setAiConfigs(prev => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ ...DEFAULT_AI_CONFIG }))];
      }
      return prev.slice(0, count);
    });
  };

  const updateAIConfig = (index: number, patch: Partial<AIPlayerConfig>) => {
    setAiConfigs(prev => prev.map((cfg, i) => i === index ? { ...cfg, ...patch } : cfg));
  };

  // Master-Toggle "Alles aus der Hand"
  const allAusHand =
    rules.strasseAusHand &&
    (!rules.juleEnabled || rules.juleAusHand) &&
    (!rules.generalEnabled || rules.generalAusHand);

  const toggleAllAusHand = () => {
    const next = !allAusHand;
    set({ strasseAusHand: next, juleAusHand: next, generalAusHand: next });
  };

  const canStart = nickname.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-amber-400">🎲 Schocken</h1>
          <p className="text-gray-400">Trainingsspiel — Du gegen die KI</p>
        </div>

        {/* Nickname */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-3">
          <label className="block text-sm font-medium text-gray-300">Dein Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="z. B. Stammtisch-Max"
            maxLength={20}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
          />
        </div>

        {/* KI-Gegner + Konfiguration */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              KI-Gegner: <span className="text-amber-400 font-bold">{aiCount}</span>
            </label>
            <input
              type="range" min={1} max={7} value={aiCount}
              onChange={(e) => handleAiCountChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1 Gegner</span><span>7 Gegner</span>
            </div>
          </div>

          {/* Aufklappbare KI-Konfiguration */}
          <div className="border-t border-gray-700 pt-3">
            <button
              onClick={() => setShowAIConfig(!showAIConfig)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              <span>KI-Spieler konfigurieren</span>
              <span className="text-gray-500 text-xs">{showAIConfig ? '▲' : '▼'}</span>
            </button>

            {showAIConfig && (
              <div className="mt-3 space-y-4">
                {Array.from({ length: aiCount }, (_, i) => (
                  <AIPlayerConfigRow
                    key={i}
                    name={getAIPlayerName(i)}
                    config={aiConfigs[i] ?? DEFAULT_AI_CONFIG}
                    onSkillChange={(skillLevel) => updateAIConfig(i, { skillLevel })}
                    onRiskChange={(riskProfile) => updateAIConfig(i, { riskProfile })}
                    isLast={i === aiCount - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Regelwerk ─── */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-5">
          <h2 className="text-sm font-medium text-gray-300">Regelwerk</h2>

          {/* Kombinationen */}
          <RuleGroup label="Kombinationen">
            <RuleToggle
              checked={rules.generalEnabled}
              onToggle={() => set({ generalEnabled: !rules.generalEnabled })}
              label="mit General"
              description="Drei gleiche Augen (Pasch) gelten als General — eine Sonderkombination über der Straße."
            />
            <RuleToggle
              checked={rules.juleEnabled}
              onToggle={() => set({ juleEnabled: !rules.juleEnabled })}
              label="mit Jule"
              description="1-2-4 ist die zweithöchste Kombination nach Schock Aus (7 Deckel)."
            />
          </RuleGroup>

          {/* Aus der Hand */}
          <RuleGroup label="Aus der Hand">
            <RuleToggle
              checked={allAusHand}
              onToggle={toggleAllAusHand}
              label="Alles aus der Hand"
              description="Straße, Jule und General gelten nur beim ersten Wurf."
            />
            <div className="pl-5 border-l border-gray-700 space-y-3 mt-1">
              <RuleToggle
                checked={rules.strasseAusHand}
                onToggle={() => set({ strasseAusHand: !rules.strasseAusHand })}
                label="Straße aus der Hand"
                description="Straßen gelten nur beim ersten Wurf."
                small
              />
              {rules.juleEnabled && (
                <RuleToggle
                  checked={rules.juleAusHand}
                  onToggle={() => set({ juleAusHand: !rules.juleAusHand })}
                  label="Jule aus der Hand"
                  description="Jule (1-2-4) gilt nur beim ersten Wurf."
                  small
                />
              )}
              {rules.generalEnabled && (
                <RuleToggle
                  checked={rules.generalAusHand}
                  onToggle={() => set({ generalAusHand: !rules.generalAusHand })}
                  label="General aus der Hand"
                  description="General (Pasch) gilt nur beim ersten Wurf."
                  small
                />
              )}
            </div>
            <RuleToggle
              checked={rules.sechsenDrehenEnabled}
              onToggle={() => set({ sechsenDrehenEnabled: !rules.sechsenDrehenEnabled })}
              label="Sechsen drehen"
              description="Zwei 6er → eine 1 drehen. Drei 6er → zwei 1er drehen. Danach ist ein Wurf Pflicht."
            />
          </RuleGroup>

          {/* Weitere Sonderregeln */}
          <RuleGroup label="Weitere Sonderregeln">
            <RuleToggle
              checked={rules.mauernEnabled}
              onToggle={() => set({ mauernEnabled: !rules.mauernEnabled })}
              label="Mauern (Bauen)"
              description="Beliebige Würfel können gehalten werden, nicht nur 1er."
            />
            <RuleToggle
              checked={rules.heldDiceReturnEnabled}
              onToggle={() => set({ heldDiceReturnEnabled: !rules.heldDiceReturnEnabled })}
              label="Gehaltene Würfel zurück"
              description="Rausgelegte Würfel dürfen wieder zurückgelegt und neu gewürfelt werden."
            />
            <RuleToggle
              checked={rules.einwuerfelnEnabled}
              onToggle={() => set({ einwuerfelnEnabled: !rules.einwuerfelnEnabled })}
              label="Einwürfeln"
              description="Ausgeschiedene Spieler dürfen erneut ins Spiel einsteigen."
            />
            <RuleToggle
              checked={rules.ersterHochEnabled}
              onToggle={() => set({ ersterHochEnabled: !rules.ersterHochEnabled })}
              label="Erster Hoch"
              description="In der ersten Runde jeder Halbzeit darf jeder Spieler nur einmal würfeln."
            />
            {rules.ersterHochEnabled && (
              <div className="pl-5 border-l border-gray-700">
                <RuleToggle
                  checked={rules.ersterHochHeadsUp}
                  onToggle={() => set({ ersterHochHeadsUp: !rules.ersterHochHeadsUp })}
                  label="Erster Hoch im Finale"
                  description="Gilt auch im Heads-Up-Finale."
                  small
                />
              </div>
            )}
            <RuleToggle
              checked={rules.verdecktEnabled}
              onToggle={() => set({ verdecktEnabled: !rules.verdecktEnabled })}
              label="Verdeckt"
              description="Der letzte Wurf bleibt umgedreht; nur gehaltene Würfel sind für andere sichtbar."
            />
          </RuleGroup>
        </div>

        {/* Start */}
        <button
          onClick={() => startTrainingGame(nickname.trim(), aiCount, rules, aiConfigs)}
          disabled={!canStart}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all
            bg-amber-500 hover:bg-amber-400 text-gray-900
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Spiel starten 🎲
        </button>

        {!canStart && (
          <p className="text-center text-sm text-gray-500">Bitte gib einen Nickname ein (min. 2 Zeichen)</p>
        )}
      </div>
    </div>
  );
}

// ─── KI-Spieler Konfigurationszeile ──────────────────────────────────────────

function AIPlayerConfigRow({
  name, config, onSkillChange, onRiskChange, isLast,
}: {
  name: string;
  config: AIPlayerConfig;
  onSkillChange: (s: AISkillLevel) => void;
  onRiskChange: (r: AIRiskProfile) => void;
  isLast: boolean;
}) {
  return (
    <div className={`space-y-2 ${!isLast ? 'border-b border-gray-700 pb-4' : ''}`}>
      <p className="text-xs font-semibold text-amber-400">{name}</p>

      <div className="space-y-1">
        <p className="text-xs text-gray-500">Spielstärke</p>
        <div className="flex gap-2">
          {(Object.keys(SKILL_LABELS) as AISkillLevel[]).map(level => (
            <button
              key={level}
              onClick={() => onSkillChange(level)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${config.skillLevel === level
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {SKILL_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-gray-500">Risikofreude</p>
        <div className="flex gap-2">
          {(Object.keys(RISK_LABELS) as AIRiskProfile[]).map(risk => (
            <button
              key={risk}
              onClick={() => onRiskChange(risk)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${config.riskProfile === risk
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {RISK_LABELS[risk]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Hilfkomponenten ──────────────────────────────────────────────────────────

function RuleGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function RuleToggle({
  checked, onToggle, label, description, small = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  small?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 cursor-pointer"
      onClick={onToggle}
    >
      <div className={`mt-0.5 shrink-0 rounded-full transition-colors flex items-center
        ${small ? 'w-8 h-5' : 'w-10 h-6'}
        ${checked ? 'bg-amber-500' : 'bg-gray-600'}`}
      >
        <div className={`bg-white rounded-full shadow transition-transform
          ${small ? 'w-4 h-4 ml-0.5' : 'w-5 h-5 ml-0.5'}
          ${checked ? (small ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0'}`}
        />
      </div>
      <div>
        <div className={`font-medium text-white ${small ? 'text-xs' : 'text-sm'}`}>{label}</div>
        <div className={`text-gray-400 ${small ? 'text-xs' : 'text-xs'}`}>{description}</div>
      </div>
    </div>
  );
}
