'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOnlineStore } from '@/store/onlineStore';
import { GameBoard } from '@/components/game/GameBoard';
import { RulesSummaryPopover } from '@/components/game/RulesConfig';
import { generatePlayerId } from '@/lib/roomCode';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const store = useOnlineStore();
  const [joinName, setJoinName] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRulesPopover, setShowRulesPopover] = useState(false);

  // Regeln-Popover einmalig zeigen wenn Regeln bekannt sind
  useEffect(() => {
    if (!store.roomRules) return;
    const ackKey = `rulesAck:${code}`;
    if (!sessionStorage.getItem(ackKey)) {
      setShowRulesPopover(true);
    }
  }, [store.roomRules, code]);

  const dismissRulesPopover = () => {
    sessionStorage.setItem(`rulesAck:${code}`, '1');
    setShowRulesPopover(false);
  };

  // Beim Laden: Session prüfen
  useEffect(() => {
    if (store.status !== 'idle') return; // Bereits verbunden (z.B. nach createRoom)

    const raw = sessionStorage.getItem(`room:${code}`);
    if (raw) {
      const session = JSON.parse(raw) as { isHost: boolean; playerId: string; playerName: string };
      if (session.isHost) {
        // Host kehrt zurück → Raum neu aufbauen (State verloren nach Refresh)
        router.push('/online');
      } else {
        // Gast kehrt zurück → neu beitreten
        store.joinRoom(code, session.playerId, session.playerName);
      }
    } else {
      // Neue Person öffnet Link → Beitrittsformular
      setShowJoinForm(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = async () => {
    if (!joinName.trim()) return;
    const playerId = generatePlayerId();
    sessionStorage.setItem(`room:${code}`, JSON.stringify({ isHost: false, playerId, playerName: joinName.trim() }));
    await store.joinRoom(code, playerId, joinName.trim());
    setShowJoinForm(false);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://schocken.vercel.app/room/${code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Beitrittsformular (neuer Spieler via Link) ────────────────────────────
  if (showJoinForm) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-amber-400">🎲 Schocken</h1>
            <p className="text-gray-400 text-sm">Einladung zum Spiel</p>
            <p className="font-mono text-lg text-amber-400 tracking-widest">{code}</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
            <input
              type="text" value={joinName} onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Dein Name" maxLength={20} autoFocus
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-500"
            />
            <button
              onClick={handleJoin}
              disabled={!joinName.trim() || store.status === 'connecting'}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all disabled:opacity-40"
            >
              {store.status === 'connecting' ? 'Verbinde…' : 'Beitreten 🎲'}
            </button>
          </div>
          {store.error && (
            <p className="text-center text-sm text-red-400">{store.error}</p>
          )}
          <p className="text-center">
            <Link href="/online" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← Zurück
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Verbindung herstellen ─────────────────────────────────────────────────
  if (store.status === 'connecting') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">🎲</div>
          <p className="text-gray-400">Verbinde…</p>
        </div>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (store.status === 'lobby') {
    return (
      <>
      {showRulesPopover && store.roomRules && (
        <RulesSummaryPopover
          rules={store.roomRules}
          roomName={store.roomName || 'Schocken'}
          onDismiss={dismissRulesPopover}
        />
      )}
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-amber-400">🎲 {store.roomName || 'Schocken'}</h1>
            <p className="font-mono text-sm text-gray-400 tracking-widest">{code}</p>
          </div>

          {/* Spielerliste */}
          <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Spieler ({store.lobbyPlayers.length})
            </p>
            {store.lobbyPlayers.length === 0 ? (
              <p className="text-gray-500 text-sm">Warte auf Spieler…</p>
            ) : (
              store.lobbyPlayers.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span>{p.id.startsWith('ai-') ? '🤖' : '🧑'}</span>
                  <span className="text-white">{p.name}</span>
                  {p.isHost && <span className="text-xs text-amber-400 ml-auto">Host</span>}
                  {p.id === store.myPlayerId && !p.isHost && <span className="text-xs text-gray-500 ml-auto">Du</span>}
                </div>
              ))
            )}
          </div>

          {/* Einladungslink */}
          <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Einladungslink</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono truncate">
                schocken.vercel.app/room/{code}
              </div>
              <button
                onClick={copyLink}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all whitespace-nowrap"
              >
                {copied ? '✓ Kopiert' : 'Kopieren'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Teile diesen Link per WhatsApp mit deinen Mitspielern.</p>
          </div>

          {/* Host: Spiel starten */}
          {store.isHost && (
            <button
              onClick={() => store.startGame()}
              disabled={store.lobbyPlayers.filter(p => !p.id.startsWith('ai-')).length < 1}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-400 text-gray-900 transition-all disabled:opacity-40"
            >
              Spiel starten 🎲
            </button>
          )}

          {!store.isHost && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-3 text-center text-gray-400 text-sm">
              Warte auf den Host…
            </div>
          )}

          <p className="text-center">
            <button onClick={() => { store.leaveRoom(); router.push('/online'); }}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← Raum verlassen
            </button>
          </p>
        </div>
      </div>
      </>
    );
  }

  // ── Spiel läuft ───────────────────────────────────────────────────────────
  if ((store.status === 'playing' || store.status === 'finished') && store.gameState) {
    return (
      <GameBoard
        gameState={store.gameState}
        myPlayerId={store.myPlayerId}
        isHost={store.isHost}
        fastMode={false}
        actions={{
          roll: store.roll,
          toggleHold: store.toggleHold,
          finalizeTurn: store.finalizeTurn,
          applySechsenDrehen: store.applySechsenDrehen,
          proceedAfterRound: store.proceedAfterRound,
          startSecondHalf: store.startSecondHalf,
          resetGame: () => { store.leaveRoom(); router.push('/online'); },
        }}
      />
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <p className="text-gray-400">Raum nicht gefunden oder Host offline.</p>
        <Link href="/online" className="text-amber-400 hover:text-amber-300 transition-colors">
          Zurück →
        </Link>
      </div>
    </div>
  );
}
