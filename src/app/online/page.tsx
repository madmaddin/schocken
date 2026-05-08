'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOnlineStore } from '@/store/onlineStore';
import { STANDARD_RULES } from '@/game/rules/presets';
import { getAIPlayerName } from '@/game/ai/AIPlayer';
import { generateRoomCode, generatePlayerId } from '@/lib/roomCode';
import { RulesConfigPanel } from '@/components/game/RulesConfig';
import { AvatarPicker, DEFAULT_HUMAN_AVATAR } from '@/components/game/AvatarPicker';
import type { AIPlayerConfig, AISkillLevel, AIRiskProfile, GameRules } from '@/game/rules/types';

const DEFAULT_AI_CONFIG: AIPlayerConfig = { skillLevel: 'fortgeschritten', riskProfile: 'ausgewogen' };

const SKILL_LABELS: Record<AISkillLevel, string> = {
  anfaenger: 'Anfänger', fortgeschritten: 'Fortgeschr.', profi: 'Profi',
};
const RISK_LABELS: Record<AIRiskProfile, string> = {
  defensiv: 'Defensiv', ausgewogen: 'Ausgewogen', offensiv: 'Offensiv',
};

export default function OnlinePage() {
  const router = useRouter();
  const createRoom = useOnlineStore((s) => s.createRoom);
  const joinRoom = useOnlineStore((s) => s.joinRoom);
  const status = useOnlineStore((s) => s.status);
  const error = useOnlineStore((s) => s.error);

  // ── Raum erstellen ──
  const [hostName, setHostName] = useState('');
  const [hostAvatar, setHostAvatar] = useState(DEFAULT_HUMAN_AVATAR);
  const [roomName, setRoomName] = useState('');
  const [aiCount, setAiCount] = useState(0);
  const [aiConfigs, setAiConfigs] = useState<AIPlayerConfig[]>([]);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [rules, setRules] = useState<GameRules>(STANDARD_RULES);
  const [showRulesConfig, setShowRulesConfig] = useState(false);

  // ── Raum beitreten ──
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState(DEFAULT_HUMAN_AVATAR);

  const handleAiCountChange = (count: number) => {
    setAiCount(count);
    setAiConfigs(prev => {
      if (count > prev.length) return [...prev, ...Array.from({ length: count - prev.length }, () => ({ ...DEFAULT_AI_CONFIG }))];
      return prev.slice(0, count);
    });
  };

  const updateAIConfig = (i: number, patch: Partial<AIPlayerConfig>) => {
    setAiConfigs(prev => prev.map((cfg, idx) => idx === i ? { ...cfg, ...patch } : cfg));
  };

  const handleCreate = async () => {
    if (!hostName.trim() || !roomName.trim()) return;
    const roomCode = generateRoomCode();
    const hostId = generatePlayerId();
    sessionStorage.setItem(`room:${roomCode}`, JSON.stringify({ isHost: true, playerId: hostId, playerName: hostName.trim(), avatar: hostAvatar }));
    await createRoom({ roomCode, roomName: roomName.trim(), hostId, hostName: hostName.trim(), hostAvatar, rules, aiPlayers: aiConfigs });
    router.push(`/room/${roomCode}`);
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !joinName.trim()) return;
    const playerId = generatePlayerId();
    sessionStorage.setItem(`room:${code}`, JSON.stringify({ isHost: false, playerId, playerName: joinName.trim(), avatar: joinAvatar }));
    await joinRoom(code, playerId, joinName.trim(), joinAvatar);
    router.push(`/room/${code}`);
  };

  const isCreating = status === 'connecting';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold text-amber-400">🎲 Schocken</h1>
          <p className="text-gray-400">Mit Freunden spielen</p>
          <Link href="/" className="inline-block text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Zurück zum Trainingsspiel
          </Link>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ── Raum erstellen ── */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Neuen Raum erstellen</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center text-2xl shrink-0">
                {hostAvatar}
              </div>
              <input
                type="text" value={hostName} onChange={e => setHostName(e.target.value)}
                placeholder="Dein Name" maxLength={20}
                className="flex-1 bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Dein Avatar</p>
              <AvatarPicker value={hostAvatar} onChange={setHostAvatar} />
            </div>
            <input
              type="text" value={roomName} onChange={e => setRoomName(e.target.value)}
              placeholder="Raumname (z.B. Stammtisch-Runde)" maxLength={30}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
            />
          </div>

          {/* KI-Mitspieler */}
          <div className="space-y-3 border-t border-gray-700 pt-3">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">
                KI-Mitspieler: <span className="text-amber-400 font-bold">{aiCount}</span>
              </label>
              <input type="range" min={0} max={6} value={aiCount}
                onChange={e => handleAiCountChange(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0 (nur Menschen)</span><span>6 KI</span>
              </div>
            </div>

            {aiCount > 0 && (
              <div className="border-t border-gray-700 pt-2">
                <button
                  onClick={() => setShowAIConfig(!showAIConfig)}
                  className="flex items-center justify-between w-full text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <span>KI konfigurieren</span>
                  <span className="text-xs text-gray-500">{showAIConfig ? '▲' : '▼'}</span>
                </button>
                {showAIConfig && (
                  <div className="mt-3 space-y-4">
                    {Array.from({ length: aiCount }, (_, i) => (
                      <div key={i} className={`space-y-2 ${i < aiCount - 1 ? 'border-b border-gray-700 pb-3' : ''}`}>
                        <p className="text-xs font-semibold text-amber-400">{getAIPlayerName(i)}</p>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">Spielstärke</p>
                          <div className="flex gap-2">
                            {(Object.keys(SKILL_LABELS) as AISkillLevel[]).map(level => (
                              <button key={level} onClick={() => updateAIConfig(i, { skillLevel: level })}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${(aiConfigs[i] ?? DEFAULT_AI_CONFIG).skillLevel === level ? 'bg-amber-500 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {SKILL_LABELS[level]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">Risikofreude</p>
                          <div className="flex gap-2">
                            {(Object.keys(RISK_LABELS) as AIRiskProfile[]).map(risk => (
                              <button key={risk} onClick={() => updateAIConfig(i, { riskProfile: risk })}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${(aiConfigs[i] ?? DEFAULT_AI_CONFIG).riskProfile === risk ? 'bg-amber-500 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {RISK_LABELS[risk]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Regelwerk */}
          <div className="border-t border-gray-700 pt-3">
            <button
              onClick={() => setShowRulesConfig(!showRulesConfig)}
              className="flex items-center justify-between w-full text-sm text-gray-300 hover:text-white transition-colors"
            >
              <span>Regelwerk anpassen</span>
              <span className="text-xs text-gray-500">{showRulesConfig ? '▲' : '▼'}</span>
            </button>
            {showRulesConfig && (
              <div className="mt-4">
                <RulesConfigPanel rules={rules} onChange={(patch) => setRules(prev => ({ ...prev, ...patch }))} />
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={!hostName.trim() || !roomName.trim() || isCreating}
            className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Erstelle Raum…' : 'Raum erstellen 🎲'}
          </button>
        </div>

        {/* ── Raum beitreten ── */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Raum beitreten</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center text-2xl shrink-0">
              {joinAvatar}
            </div>
            <input
              type="text" value={joinName} onChange={e => setJoinName(e.target.value)}
              placeholder="Dein Name" maxLength={20}
              className="flex-1 bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Dein Avatar</p>
            <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Raumcode (z.B. ABC123)" maxLength={6}
              className="flex-1 bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500 tracking-widest font-mono uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={!joinName.trim() || joinCode.trim().length < 6 || isCreating}
              className="px-6 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Beitreten
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
