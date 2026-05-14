'use client';

import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GameEngine } from '@/game/engine/GameEngine';
import { getAIPlayerName, getAIPlayerAvatar } from '@/game/ai/AIPlayer';
import type { GameState, GameRules, Player, AIPlayerConfig } from '@/game/rules/types';

// ─── Öffentliche Typen ────────────────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

export interface CreateRoomConfig {
  roomCode: string;
  roomName: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  rules: GameRules;
  aiPlayers: AIPlayerConfig[];
}

type RoomStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'finished';

// ─── Broadcast-Typen ─────────────────────────────────────────────────────────

type GameAction =
  | { type: 'roll'; playerId: string }
  | { type: 'hold'; playerId: string; dieIndex: 0 | 1 | 2 }
  | { type: 'finalize'; playerId: string }
  | { type: 'sechsen_drehen'; playerId: string }
  | { type: 'start_second_half'; playerId: string };

// ─── Store Interface ──────────────────────────────────────────────────────────

interface OnlineStore {
  roomCode: string | null;
  roomName: string;
  roomRules: GameRules | null;
  isHost: boolean;
  myPlayerId: string;
  myPlayerName: string;
  myPlayerAvatar: string;
  status: RoomStatus;
  lobbyPlayers: LobbyPlayer[];
  gameState: GameState | null;
  roundAckedBy: string[];
  error: string | null;
  _rules: GameRules | null;
  _aiPlayerConfigs: AIPlayerConfig[];

  createRoom: (config: CreateRoomConfig) => Promise<void>;
  joinRoom: (code: string, playerId: string, playerName: string, playerAvatar: string) => Promise<void>;
  startGame: () => void;
  restartGame: () => void;
  beginGame: () => void;
  leaveRoom: () => void;

  roll: () => void;
  toggleHold: (dieIndex: 0 | 1 | 2) => void;
  finalizeTurn: () => void;
  applySechsenDrehen: () => void;
  proceedAfterRound: () => void;
  startSecondHalf: () => void;
}

// ─── Interne Hilfsvariablen ───────────────────────────────────────────────────

let _engine: GameEngine | null = null;
let _channel: RealtimeChannel | null = null;
let _initialPlayers: Player[] | null = null;
let _disconnectTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const ABSENT_TIMEOUT_MS = 45_000;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  roomCode: null,
  roomName: '',
  roomRules: null,
  isHost: false,
  myPlayerId: '',
  myPlayerName: '',
  myPlayerAvatar: '',
  status: 'idle',
  lobbyPlayers: [],
  gameState: null,
  roundAckedBy: [],
  error: null,
  _rules: null,
  _aiPlayerConfigs: [],

  // ── Raum erstellen (Host) ─────────────────────────────────────────────────

  createRoom: async (config) => {
    const { roomCode, roomName, hostId, hostName, hostAvatar, rules, aiPlayers } = config;
    set({ status: 'connecting', roomCode, roomName, roomRules: rules, isHost: true, myPlayerId: hostId, myPlayerName: hostName, myPlayerAvatar: hostAvatar, error: null, _rules: rules, _aiPlayerConfigs: aiPlayers, roundAckedBy: [] });

    const aiLobbyEntries: LobbyPlayer[] = aiPlayers.map((_, i) => ({
      id: `ai-${i}`, name: getAIPlayerName(i), avatar: getAIPlayerAvatar(i), isHost: false,
    }));

    const channel = supabase.channel(`room:${roomCode}`, {
      config: { broadcast: { self: true }, presence: { key: hostId } },
    });
    _channel = channel;

    // Aktionen von Gästen empfangen
    channel.on('broadcast', { event: 'player_action' }, ({ payload }) => {
      const action = payload as GameAction;
      if (!_engine) return;
      if (_engine.getState().currentPlayerId !== action.playerId) return;
      applyAction(action);
    });

    // Runden-Ack vom Gast empfangen
    channel.on('broadcast', { event: 'ack_round' }, ({ payload }) => {
      const { playerId } = payload as { playerId: string };
      const cur = get();
      const newAcked = cur.roundAckedBy.includes(playerId)
        ? cur.roundAckedBy
        : [...cur.roundAckedBy, playerId];
      set({ roundAckedBy: newAcked });
      _channel?.send({ type: 'broadcast', event: 'round_ack_state', payload: { acked: newAcked } });
      if (allHumanPlayersAcked(newAcked, get().gameState)) {
        set({ roundAckedBy: [] });
        _channel?.send({ type: 'broadcast', event: 'round_ack_state', payload: { acked: [] } });
        _engine?.proceedAfterRound();
      }
    });

    // Neuer Spieler tritt bei
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      broadcastCurrentState();
      broadcastLobbyInfo();
      // Disconnect-Timer löschen falls Spieler wiederverbindet
      for (const p of (newPresences as unknown) as Array<{ id: string }>) {
        if (_disconnectTimers[p.id]) {
          clearTimeout(_disconnectTimers[p.id]);
          delete _disconnectTimers[p.id];
        }
      }
      syncLobbyFromPresence(channel, set, aiLobbyEntries);
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      syncLobbyFromPresence(channel, set, aiLobbyEntries);
      // 45s-Timer für Spieler-Abwesenheit starten (nur wenn Spiel läuft)
      if (get().status !== 'playing') return;
      for (const p of (leftPresences as unknown) as Array<{ id: string }>) {
        if (p.id.startsWith('ai-') || p.id === get().myPlayerId) continue;
        if (_disconnectTimers[p.id]) continue;
        _disconnectTimers[p.id] = setTimeout(() => {
          delete _disconnectTimers[p.id];
          if (_engine && get().status === 'playing') {
            _engine.markPlayerAbsent(p.id);
            // Wenn alle verbleibenden Human-Spieler abwesend: Acks prüfen
            const newAcked = get().roundAckedBy;
            if (get().gameState?.phase === 'round_result' && allHumanPlayersAcked(newAcked, get().gameState)) {
              set({ roundAckedBy: [] });
              _channel?.send({ type: 'broadcast', event: 'round_ack_state', payload: { acked: [] } });
              _engine?.proceedAfterRound();
            }
          }
        }, ABSENT_TIMEOUT_MS);
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      syncLobbyFromPresence(channel, set, aiLobbyEntries);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: hostId, name: hostName, avatar: hostAvatar, isHost: true });
          set({ status: 'lobby', lobbyPlayers: [{ id: hostId, name: hostName, avatar: hostAvatar, isHost: true }, ...aiLobbyEntries] });
          channel.send({ type: 'broadcast', event: 'room_info', payload: { roomName, hostName, rules } });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Verbindung fehlgeschlagen'));
        }
      });
    }).catch((err) => set({ error: String(err), status: 'idle' }));

    function broadcastCurrentState() {
      if (!_engine || !_channel) return;
      _channel.send({ type: 'broadcast', event: 'game_state', payload: { state: _engine.getState() } });
    }
    function broadcastLobbyInfo() {
      if (!_channel) return;
      _channel.send({ type: 'broadcast', event: 'room_info', payload: { roomName, hostName, rules } });
    }
  },

  // ── Raum beitreten (Gast) ─────────────────────────────────────────────────

  joinRoom: async (code, playerId, playerName, playerAvatar) => {
    set({ status: 'connecting', roomCode: code, isHost: false, myPlayerId: playerId, myPlayerName: playerName, myPlayerAvatar: playerAvatar, error: null, roundAckedBy: [] });

    const channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    _channel = channel;

    channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
      const state = payload.state as GameState;
      const prevPhase = get().gameState?.phase;
      // Acks zurücksetzen wenn neue Runde beginnt
      const roundAckedBy = prevPhase === 'round_result' && state.phase === 'playing' ? [] : get().roundAckedBy;
      set({
        gameState: state,
        roundAckedBy,
        status: state.phase === 'playing' || state.phase === 'round_result' || state.phase === 'half_time' || state.phase === 'finished' ? 'playing' : 'lobby',
      });
    });

    channel.on('broadcast', { event: 'room_info' }, ({ payload }) => {
      set({ roomName: payload.roomName ?? '', roomRules: payload.rules ?? null });
    });

    channel.on('broadcast', { event: 'round_ack_state' }, ({ payload }) => {
      set({ roundAckedBy: (payload as { acked: string[] }).acked });
    });

    channel.on('broadcast', { event: 'game_started' }, () => {
      set({ status: 'playing' });
    });

    channel.on('broadcast', { event: 'game_restart' }, () => {
      set({ roundAckedBy: [] });
    });

    channel.on('presence', { event: 'sync' }, () => {
      syncLobbyFromPresence(channel, set);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: playerId, name: playerName, avatar: playerAvatar, isHost: false });
          set({ status: 'lobby' });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Raum nicht gefunden oder nicht erreichbar'));
        }
      });
    }).catch((err) => set({ error: String(err), status: 'idle' }));
  },

  // ── Spiel starten (nur Host) ──────────────────────────────────────────────

  startGame: () => {
    const { roomCode, lobbyPlayers } = get();
    if (!roomCode || !_channel) return;

    const humanPlayers: Player[] = lobbyPlayers
      .filter(p => !p.id.startsWith('ai-'))
      .map(p => ({
        id: p.id, name: p.name, avatar: p.avatar || '😎',
        type: 'human' as const, covers: 0, isEliminated: false, isOut: false,
      }));

    const aiConfigs = get()._aiPlayerConfigs;
    const aiPlayers: Player[] = aiConfigs.map((cfg, i) => ({
      id: `ai-${i}`, name: getAIPlayerName(i), avatar: getAIPlayerAvatar(i),
      type: 'ai' as const, aiConfig: cfg, covers: 0, isEliminated: false, isOut: false,
    }));

    const allPlayers = [...humanPlayers, ...aiPlayers];
    _initialPlayers = allPlayers;

    const rules = get()._rules ?? buildDefaultRules();
    _engine = new GameEngine(allPlayers, rules, (newState) => {
      set({ gameState: newState });
      _channel?.send({ type: 'broadcast', event: 'game_state', payload: { state: newState } });
      triggerAIIfNeeded(_engine!, newState);
    });

    set({ gameState: _engine.getState(), status: 'playing', roundAckedBy: [] });
    _channel.send({ type: 'broadcast', event: 'game_started', payload: {} });
  },

  // ── Spiel neu starten (gleiche Spieler, gleiche Regeln) ──────────────────

  restartGame: () => {
    if (!_initialPlayers || !_channel) return;
    const rules = get()._rules ?? buildDefaultRules();
    const freshPlayers = _initialPlayers.map(p => ({
      ...p, covers: 0, isEliminated: false, isOut: false, isAbsent: false,
    }));

    // Disconnect-Timer löschen
    for (const t of Object.values(_disconnectTimers)) clearTimeout(t);
    _disconnectTimers = {};

    _engine = new GameEngine(freshPlayers, rules, (newState) => {
      set({ gameState: newState });
      _channel?.send({ type: 'broadcast', event: 'game_state', payload: { state: newState } });
      triggerAIIfNeeded(_engine!, newState);
    });

    set({ gameState: _engine.getState(), roundAckedBy: [], status: 'playing' });
    _channel.send({ type: 'broadcast', event: 'game_restart', payload: {} });
  },

  // ── Spiel wirklich beginnen (Host drückt "Starten" im Spielfeld) ──────────

  beginGame: () => {
    if (!_engine || !get().isHost) return;
    _engine.startLoadingRound();
  },

  // ── Raum verlassen ────────────────────────────────────────────────────────

  leaveRoom: () => {
    for (const t of Object.values(_disconnectTimers)) clearTimeout(t);
    _disconnectTimers = {};
    if (_channel) { supabase.removeChannel(_channel); _channel = null; }
    _engine = null;
    _initialPlayers = null;
    set({ status: 'idle', roomCode: null, roomName: '', roomRules: null, myPlayerAvatar: '', gameState: null, lobbyPlayers: [], roundAckedBy: [], error: null });
  },

  // ── Spielaktionen ─────────────────────────────────────────────────────────

  roll: () => sendOrApply({ type: 'roll', playerId: get().myPlayerId }, get),
  toggleHold: (dieIndex) => sendOrApply({ type: 'hold', playerId: get().myPlayerId, dieIndex }, get),
  finalizeTurn: () => sendOrApply({ type: 'finalize', playerId: get().myPlayerId }, get),
  applySechsenDrehen: () => sendOrApply({ type: 'sechsen_drehen', playerId: get().myPlayerId }, get),
  startSecondHalf: () => sendOrApply({ type: 'start_second_half', playerId: get().myPlayerId }, get),

  proceedAfterRound: () => {
    const { isHost, myPlayerId } = get();
    if (!isHost) {
      // Gast: Ack an Host senden
      const newAcked = get().roundAckedBy.includes(myPlayerId)
        ? get().roundAckedBy
        : [...get().roundAckedBy, myPlayerId];
      set({ roundAckedBy: newAcked });
      _channel?.send({ type: 'broadcast', event: 'ack_round', payload: { playerId: myPlayerId } });
      return;
    }
    // Host: eigenes Ack hinzufügen
    const newAcked = get().roundAckedBy.includes(myPlayerId)
      ? get().roundAckedBy
      : [...get().roundAckedBy, myPlayerId];
    set({ roundAckedBy: newAcked });
    _channel?.send({ type: 'broadcast', event: 'round_ack_state', payload: { acked: newAcked } });
    if (allHumanPlayersAcked(newAcked, get().gameState)) {
      set({ roundAckedBy: [] });
      _channel?.send({ type: 'broadcast', event: 'round_ack_state', payload: { acked: [] } });
      _engine?.proceedAfterRound();
    }
  },
}));

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function sendOrApply(action: GameAction, get: () => OnlineStore) {
  if (get().isHost) {
    applyAction(action);
  } else {
    _channel?.send({ type: 'broadcast', event: 'player_action', payload: action });
  }
}

function applyAction(action: GameAction) {
  if (!_engine) return;
  switch (action.type) {
    case 'roll': _engine.rollActive(); break;
    case 'hold': _engine.toggleHold(action.dieIndex); break;
    case 'finalize': _engine.finalizeTurn(); break;
    case 'sechsen_drehen': _engine.applySechsenDrehen(); break;
    case 'start_second_half': _engine.proceedAfterHalfTime(); break;
  }
}

function allHumanPlayersAcked(acked: string[], gameState: GameState | null): boolean {
  if (!gameState) return false;
  const activeHumanIds = gameState.players
    .filter(p => p.type === 'human' && !p.isEliminated && !p.isAbsent)
    .map(p => p.id);
  return activeHumanIds.length > 0 && activeHumanIds.every(id => acked.includes(id));
}

function triggerAIIfNeeded(engine: GameEngine, state: GameState) {
  const current = state.players.find(p => p.id === state.currentPlayerId);
  if (state.phase !== 'playing' || state.activeTurn || state.roundFinalRolls[state.currentPlayerId]) return;
  if (current?.type === 'ai' && !current.isAbsent) {
    engine.performAITurn(state.currentPlayerId);
  }
}

function syncLobbyFromPresence(
  channel: RealtimeChannel,
  set: (s: Partial<OnlineStore>) => void,
  aiEntries: LobbyPlayer[] = []
) {
  const presenceState = channel.presenceState<{ id: string; name: string; avatar: string; isHost: boolean }>();
  const humanPlayers: LobbyPlayer[] = Object.values(presenceState)
    .flat()
    .map(p => ({ id: p.id, name: p.name, avatar: p.avatar || '😎', isHost: p.isHost }));
  set({ lobbyPlayers: [...humanPlayers, ...aiEntries] });
}

function buildDefaultRules(): GameRules {
  return {
    minPlayers: 2, maxPlayers: 8, generalEnabled: true, juleEnabled: false,
    strasseAusHand: false, juleAusHand: false, generalAusHand: false,
    sechsenDrehenEnabled: false, mauernEnabled: false, heldDiceReturnEnabled: false,
    einwuerfelnEnabled: false, schockAusSchlagtNachgelegt: false,
    ersterHochEnabled: false, ersterHochHeadsUp: false, verdecktEnabled: false,
    totalCovers: 13,
  };
}
