'use client';

import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GameEngine } from '@/game/engine/GameEngine';
import { getAIPlayerName } from '@/game/ai/AIPlayer';
import type { GameState, GameRules, Player, AIPlayerConfig } from '@/game/rules/types';

// ─── Öffentliche Typen ────────────────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
}

export interface CreateRoomConfig {
  roomCode: string;
  roomName: string;
  hostId: string;
  hostName: string;
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
  | { type: 'proceed_after_round'; playerId: string }
  | { type: 'start_second_half'; playerId: string };

// ─── Store Interface ──────────────────────────────────────────────────────────

interface OnlineStore {
  roomCode: string | null;
  roomName: string;
  isHost: boolean;
  myPlayerId: string;
  myPlayerName: string;
  status: RoomStatus;
  lobbyPlayers: LobbyPlayer[];
  gameState: GameState | null;
  error: string | null;
  _rules: GameRules | null;
  _aiPlayerConfigs: AIPlayerConfig[];

  createRoom: (config: CreateRoomConfig) => Promise<void>;
  joinRoom: (code: string, playerId: string, playerName: string) => Promise<void>;
  startGame: () => void;
  leaveRoom: () => void;

  roll: () => void;
  toggleHold: (dieIndex: 0 | 1 | 2) => void;
  finalizeTurn: () => void;
  applySechsenDrehen: () => void;
  proceedAfterRound: () => void;
  startSecondHalf: () => void;
}

// ─── Interne Hilfsvariablen (außerhalb des Stores, keine Reaktivität nötig) ──

let _engine: GameEngine | null = null;
let _channel: RealtimeChannel | null = null;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  roomCode: null,
  roomName: '',
  isHost: false,
  myPlayerId: '',
  myPlayerName: '',
  status: 'idle',
  lobbyPlayers: [],
  gameState: null,
  error: null,
  _rules: null,
  _aiPlayerConfigs: [],

  // ── Raum erstellen (Host) ─────────────────────────────────────────────────

  createRoom: async (config) => {
    const { roomCode, roomName, hostId, hostName, rules, aiPlayers } = config;
    set({ status: 'connecting', roomCode, roomName, isHost: true, myPlayerId: hostId, myPlayerName: hostName, error: null, _rules: rules, _aiPlayerConfigs: aiPlayers });

    const channel = supabase.channel(`room:${roomCode}`, {
      config: { broadcast: { self: true }, presence: { key: hostId } },
    });
    _channel = channel;

    // Spielzustand von Gästen empfangen (wird ignoriert, Host ist maßgeblich)
    channel.on('broadcast', { event: 'player_action' }, ({ payload }) => {
      const action = payload as GameAction;
      if (!_engine) return;
      const state = _engine.getState();
      // Nur wenn es wirklich der Zug dieses Spielers ist
      if (state.currentPlayerId !== action.playerId) return;
      applyAction(action);
    });

    // Neuer Spieler tritt bei → aktuellen Zustand senden
    channel.on('presence', { event: 'join' }, () => {
      broadcastCurrentState();
      broadcastLobbyInfo();
    });

    channel.on('presence', { event: 'leave' }, () => {
      syncLobbyFromPresence(channel, set);
    });

    channel.on('presence', { event: 'sync' }, () => {
      syncLobbyFromPresence(channel, set);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: hostId, name: hostName, isHost: true });

          // AI-Spieler als Platzhalter in die Lobby-Liste eintragen
          const aiLobbyEntries: LobbyPlayer[] = aiPlayers.map((_, i) => ({
            id: `ai-${i}`,
            name: getAIPlayerName(i),
            isHost: false,
          }));
          set({ status: 'lobby', lobbyPlayers: [{ id: hostId, name: hostName, isHost: true }, ...aiLobbyEntries] });

          // Lobby-Info broadcasten damit Joiner sofort den Raumnamen sehen
          channel.send({ type: 'broadcast', event: 'room_info', payload: { roomName, hostName } });

          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Verbindung fehlgeschlagen'));
        }
      });
    }).catch((err) => set({ error: String(err), status: 'idle' }));

    // Hilfsfunktion: aktuellen Spielzustand an alle senden
    function broadcastCurrentState() {
      if (!_engine || !_channel) return;
      _channel.send({ type: 'broadcast', event: 'game_state', payload: { state: _engine.getState() } });
    }

    function broadcastLobbyInfo() {
      if (!_channel) return;
      _channel.send({ type: 'broadcast', event: 'room_info', payload: { roomName, hostName } });
    }
  },

  // ── Raum beitreten (Gast) ─────────────────────────────────────────────────

  joinRoom: async (code, playerId, playerName) => {
    set({ status: 'connecting', roomCode: code, isHost: false, myPlayerId: playerId, myPlayerName: playerName, error: null });

    const channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    _channel = channel;

    // Spielzustand vom Host empfangen
    channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
      const state = payload.state as GameState;
      set({ gameState: state, status: state.phase === 'playing' || state.phase === 'round_result' || state.phase === 'half_time' || state.phase === 'finished' ? 'playing' : 'lobby' });
    });

    // Raum-Info (Name etc.)
    channel.on('broadcast', { event: 'room_info' }, ({ payload }) => {
      set({ roomName: payload.roomName ?? '' });
    });

    // Spiel gestartet
    channel.on('broadcast', { event: 'game_started' }, () => {
      set({ status: 'playing' });
    });

    channel.on('presence', { event: 'sync' }, () => {
      syncLobbyFromPresence(channel, set);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: playerId, name: playerName, isHost: false });
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
    const { roomCode, lobbyPlayers, myPlayerId, myPlayerName } = get();
    if (!roomCode || !_channel) return;

    // Spieler-Array: Host zuerst, dann Gäste (ohne KI-Platzhalter), dann KI
    const humanPlayers: Player[] = lobbyPlayers
      .filter(p => !p.id.startsWith('ai-'))
      .map(p => ({
        id: p.id,
        name: p.name,
        type: 'human' as const,
        covers: 0,
        isEliminated: false,
        isOut: false,
      }));

    // AI-Spieler aus gespeicherter Konfiguration
    const aiConfigs = get()._aiPlayerConfigs;
    const aiPlayers: Player[] = aiConfigs.map((cfg, i) => ({
      id: `ai-${i}`,
      name: getAIPlayerName(i),
      type: 'ai' as const,
      aiConfig: cfg,
      covers: 0,
      isEliminated: false,
      isOut: false,
    }));

    const allPlayers = [...humanPlayers, ...aiPlayers];

    // GameEngine mit Broadcast-Callback
    const rules = get()._rules ?? buildDefaultRules();
    _engine = new GameEngine(allPlayers, rules, (newState) => {
      set({ gameState: newState });
      _channel?.send({ type: 'broadcast', event: 'game_state', payload: { state: newState } });
      // KI-Zug anstoßen wenn nötig
      triggerAIIfNeeded(_engine!, newState);
    });

    _engine.startLoadingRound();
    set({ status: 'playing' });
    _channel.send({ type: 'broadcast', event: 'game_started', payload: {} });
  },

  // ── Raum verlassen ────────────────────────────────────────────────────────

  leaveRoom: () => {
    if (_channel) {
      supabase.removeChannel(_channel);
      _channel = null;
    }
    _engine = null;
    set({ status: 'idle', roomCode: null, roomName: '', gameState: null, lobbyPlayers: [], error: null });
  },

  // ── Spielaktionen (werden entweder direkt ausgeführt oder via Kanal gesendet) ──

  roll: () => sendOrApply({ type: 'roll', playerId: get().myPlayerId }, get),
  toggleHold: (dieIndex) => sendOrApply({ type: 'hold', playerId: get().myPlayerId, dieIndex }, get),
  finalizeTurn: () => sendOrApply({ type: 'finalize', playerId: get().myPlayerId }, get),
  applySechsenDrehen: () => sendOrApply({ type: 'sechsen_drehen', playerId: get().myPlayerId }, get),
  proceedAfterRound: () => sendOrApply({ type: 'proceed_after_round', playerId: get().myPlayerId }, get),
  startSecondHalf: () => sendOrApply({ type: 'start_second_half', playerId: get().myPlayerId }, get),
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
    case 'proceed_after_round': _engine.proceedAfterRound(); break;
    case 'start_second_half': _engine.proceedAfterHalfTime(); break;
  }
}

function triggerAIIfNeeded(engine: GameEngine, state: GameState) {
  const current = state.players.find(p => p.id === state.currentPlayerId);
  const isAITurn =
    state.phase === 'playing' &&
    current?.type === 'ai' &&
    !state.activeTurn &&
    !state.roundFinalRolls[state.currentPlayerId];

  if (isAITurn) {
    engine.performAITurn(state.currentPlayerId);
  }
}

function syncLobbyFromPresence(
  channel: RealtimeChannel,
  set: (s: Partial<OnlineStore>) => void
) {
  const presenceState = channel.presenceState<{ id: string; name: string; isHost: boolean }>();
  const players: LobbyPlayer[] = Object.values(presenceState)
    .flat()
    .map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
  set({ lobbyPlayers: players });
}

function buildDefaultRules() {
  // Fallback — sollte nie aufgerufen werden
  return {
    minPlayers: 2, maxPlayers: 8, generalEnabled: true, juleEnabled: false,
    strasseAusHand: false, juleAusHand: false, generalAusHand: false,
    sechsenDrehenEnabled: false, mauernEnabled: false, heldDiceReturnEnabled: false,
    einwuerfelnEnabled: false, schockAusSchlagtNachgelegt: false,
    ersterHochEnabled: false, ersterHochHeadsUp: false, verdecktEnabled: false,
    totalCovers: 13,
  };
}
