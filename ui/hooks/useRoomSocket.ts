"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SharedRoomState } from "@/shared/types";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

const EMPTY_ROOM: SharedRoomState = {
  players: [],
  phase: "lobby",
  game: null,
  revision: 0,
  serverNow: Date.now()
};

const BASE_POLL_DELAY_MS = 1500;
const HIDDEN_POLL_DELAY_MS = 5000;
const MAX_POLL_DELAY_MS = 15000;

function localizeRoomError(message: string) {
  const rules: Array<[string, string]> = [
    ["already started", "The battle has already started."],
    ["session is incomplete", "Player session incomplete."],
    ["cannot create another", "This browser already controls a player."],
    ["already has 10 players", "The room already has 10 players."],
    ["player name is already", "Name already in use."],
    ["character has already", "Character already chosen."],
    ["Readiness can only", "Ready changes only in lobby."],
    ["ready your own", "Change only your ready status."],
    ["change your own character", "Change only your character."],
    ["Cancel Ready before changing characters", "Cancel Ready before changing characters."],
    ["Join the lobby", "Join the lobby first."],
    ["cannot leave during", "Use Leave Battle instead."],
    ["remove your own", "Leave only your own player."],
    ["joined player can remove", "Join before removing players."],
    ["before removing", "Join before removing players."],
    ["Use Leave", "Use Leave for your player."],
    ["no longer in the room", "That player is no longer in the room."],
    ["At least two players", "Two players required."],
    ["one player must join each team", "Each team needs one player."],
    ["choose your own team", "Choose only your team."],
    ["before choosing a team", "Join before choosing a team."],
    ["Cancel ready before changing teams", "Cancel ready before changing teams."],
    ["Every joined player", "Every joined player must be ready."],
    ["state is missing", "The battle state is missing."],
    ["no active adventure", "There is no active battle."],
    ["current player", "Only the current player can act."],
    ["skip this turn", "Only the current player can skip."],
    ["cannot skip", "Defeated players cannot skip."],
    ["update is incomplete", "The turn update is incomplete."],
    ["pending World Event must be resolved", "Resolve the World Event first."],
    ["no pending World Event choice", "World Event choice closed."],
    ["World Event choice is no longer current", "World Event choice expired."],
    ["already submitted", "Choice already submitted."],
    ["Each selected card must be unique", "Choose each Tribute card only once."],
    ["Choose exactly", "Choose the required card count."],
    ["owned, non-borrowed", "Choose owned common cards from hand, draw, or discard."],
    ["submit your own World Event choice", "Submit only your choice."],
    ["impossible phase jump", "Invalid phase change."],
    ["joined player can end", "Join before ending the battle."],
    ["not in the adventure", "That player is no longer in the battle."],
    ["does not recognize", "Unknown room action."]
  ];
  return rules.find(([key]) => message.includes(key))?.[1] ?? message;
}

function retryDelay(response: Response, fallback: number) {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return fallback;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.min(MAX_POLL_DELAY_MS, Math.max(1000, seconds * 1000));
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? fallback : Math.min(MAX_POLL_DELAY_MS, Math.max(1000, date - Date.now()));
}

export function useRoomSocket() {
  const [room, setRoom] = useState<SharedRoomState>(EMPTY_ROOM);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const pollDelayRef = useRef(BASE_POLL_DELAY_MS);
  const pollRoomRef = useRef<() => Promise<void>>(async () => {});
  const sessionIdRef = useRef("");
  const disposedRef = useRef(false);

  const acceptResponse = useCallback((payload: { state?: SharedRoomState; error?: string | null }) => {
    if (payload.state) {
      const expectedViewer = sessionIdRef.current;
      const ownsPlayer = Boolean(expectedViewer && payload.state.players.some((player) => player.id === expectedViewer));
      if (ownsPlayer && payload.state.viewerSessionId !== expectedViewer) return;
      setRoom(payload.state);
      if (Number.isFinite(payload.state.serverNow)) setServerTimeOffsetMs(payload.state.serverNow - Date.now());
    }
    if (payload.error) setError(localizeRoomError(payload.error));
    else setError("");
  }, []);

  const schedulePoll = useCallback((delay: number) => {
    if (disposedRef.current || !pollingRef.current) return;
    if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = window.setTimeout(() => void pollRoomRef.current(), delay);
  }, []);

  const pollRoom = useCallback(async () => {
    if (pollInFlightRef.current || disposedRef.current || !pollingRef.current) return;
    pollInFlightRef.current = true;
    let nextDelay = document.visibilityState === "hidden" ? HIDDEN_POLL_DELAY_MS : BASE_POLL_DELAY_MS;
    try {
      const response = await fetch(`/api/room?sessionId=${encodeURIComponent(sessionIdRef.current)}`, { cache: "no-store" });
      if (response.status === 429) {
        pollDelayRef.current = Math.min(MAX_POLL_DELAY_MS, Math.max(8000, pollDelayRef.current * 2));
        nextDelay = retryDelay(response, pollDelayRef.current);
        setStatus("reconnecting");
        setError(`Room busy; retrying in ${Math.ceil(nextDelay / 1000)}s.`);
        return;
      }
      if (!response.ok) throw new Error(`Room request failed with status ${response.status}.`);
      const payload = await response.json() as { state?: SharedRoomState; error?: string | null };
      acceptResponse(payload);
      pollDelayRef.current = BASE_POLL_DELAY_MS;
      const playerCount = Math.max(1, payload.state?.players.length ?? 1);
      nextDelay = document.visibilityState === "hidden"
        ? HIDDEN_POLL_DELAY_MS
        : Math.min(10000, Math.max(BASE_POLL_DELAY_MS, playerCount * 1000));
      setStatus("connected");
    } catch {
      if (!disposedRef.current) {
        pollDelayRef.current = Math.min(MAX_POLL_DELAY_MS, Math.max(BASE_POLL_DELAY_MS, pollDelayRef.current * 2));
        nextDelay = pollDelayRef.current;
        setStatus("reconnecting");
        setError(`Room unavailable; retrying in ${Math.ceil(nextDelay / 1000)}s.`);
      }
    } finally {
      pollInFlightRef.current = false;
      schedulePoll(nextDelay);
    }
  }, [acceptResponse, schedulePoll]);

  pollRoomRef.current = pollRoom;

  const startPolling = useCallback(() => {
    if (pollingRef.current || disposedRef.current) return;
    pollingRef.current = true;
    pollDelayRef.current = BASE_POLL_DELAY_MS;
    setStatus("reconnecting");
    schedulePoll(0);
  }, [schedulePoll]);

  useEffect(() => {
    disposedRef.current = false;
    const storageKey = "shattered-oath-browser-session";
    let stableSessionId = window.localStorage.getItem(storageKey);
    if (!stableSessionId) {
      stableSessionId = `browser-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      window.localStorage.setItem(storageKey, stableSessionId);
    }
    sessionIdRef.current = stableSessionId;
    setSessionId(stableSessionId);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let socketUrl = `${protocol}//${window.location.host}/ws`;
    let fallbackTimer: number | null = null;
    let reconnectTimer: number | null = null;

    const connectSocket = () => {
      if (disposedRef.current) return;
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      fallbackTimer = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
          startPolling();
        }
      }, 1200);

      socket.addEventListener("open", () => {
        if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
        pollingRef.current = false;
        if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
        setStatus("connected");
        setError("");
        socket.send(JSON.stringify({ type: "hello", sessionId: stableSessionId }));
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === "state" && message.state) acceptResponse({ state: message.state });
          else if (message.type === "error") setError(localizeRoomError(String(message.message || "Action rejected.")));
        } catch {
          setError("Unreadable room data.");
        }
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposedRef.current) return;
        startPolling();
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connectSocket, 5000);
      });

      socket.addEventListener("error", () => socket.close());
    };

    const startRealtime = async () => {
      if (window.location.hostname.endsWith(".chatgpt.site")) {
        try {
          const response = await fetch("/api/realtime-config", { cache: "no-store" });
          const config = await response.json() as { origin?: string };
          if (response.ok && config.origin) {
            const origin = new URL(config.origin);
            origin.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
            origin.pathname = "/ws";
            origin.search = "";
            origin.hash = "";
            socketUrl = origin.toString();
          }
        } catch {
          // The same-origin socket and polling fallback remain available.
        }
      }
      connectSocket();
    };
    void startRealtime();

    return () => {
      disposedRef.current = true;
      pollingRef.current = false;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
    };
  }, [acceptResponse, startPolling]);

  const send = useCallback((message: Record<string, unknown>) => {
    const payload = { ...message, sessionId: message.sessionId ?? sessionIdRef.current };
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    if (pollingRef.current) {
      void fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (response) => {
        if (response.status === 429) {
          const delay = retryDelay(response, Math.min(MAX_POLL_DELAY_MS, Math.max(8000, pollDelayRef.current * 2)));
          pollDelayRef.current = delay;
          setStatus("reconnecting");
          setError(`Room busy; retry in ${Math.ceil(delay / 1000)}s.`);
          schedulePoll(delay);
          return;
        }
        const result = await response.json();
        acceptResponse(result);
        if (!response.ok && !result.error) setError("Action rejected.");
      }).catch(() => {
        setStatus("offline");
        setError("Room temporarily unavailable.");
      });
      return true;
    }
    setError("Room still connecting.");
    return false;
  }, [acceptResponse, schedulePoll]);

  return {
    room,
    status,
    error,
    sessionId,
    serverTimeOffsetMs,
    send,
    clearError: () => setError("")
  };
}
