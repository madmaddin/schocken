'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGameStore } from '@/store/gameStore';
import { STANDARD_RULES } from '@/game/rules/presets';
import { getAIPlayerName } from '@/game/ai/AIPlayer';
import { RulesConfigPanel } from '@/components/game/RulesConfig';
import { AvatarPicker, DEFAULT_HUMAN_AVATAR } from '@/components/game/AvatarPicker';
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
  const [avatar, setAvatar] = useState(DEFAULT_HUMAN_AVATAR);
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

  const canStart = nickname.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-amber-400">🎲 Schocken</h1>
          <p className="text-gray-400">Trainingsspiel — Du gegen die KI</p>
          <Link
            href="/online"
            className="inline-block mt-1 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
          >
            Mit Freunden spielen →
          </Link>
        </div>

        {/* Nickname + Avatar */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-700 flex items-center justify-center text-3xl shrink-0">
              {avatar}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Dein Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="z. B. Stammtisch-Max"
                maxLength={20}
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">Dein Avatar</p>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
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
          <RulesConfigPanel rules={rules} onChange={set} />
        </div>

        {/* Start */}
        <button
          onClick={() => startTrainingGame(nickname.trim(), avatar, aiCount, rules, aiConfigs)}
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

