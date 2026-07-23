"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SharedRoomState } from "@/shared/types";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

const EMPTY_ROOM: SharedRoomState = {
  players: [],
  phase: "lobby",
  game: null,
  revision: 0
};

const BASE_POLL_DELAY_MS = 3000;
const HIDDEN_POLL_DELAY_MS = 15000;
const MAX_POLL_DELAY_MS = 30000;

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
  const socketRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const pollDelayRef = useRef(BASE_POLL_DELAY_MS);
  const pollRoomRef = useRef<() => Promise<void>>(async () => {});
  const sessionIdRef = useRef("");
  const disposedRef = useRef(false);

  const acceptResponse = useCallback((payload: { state?: SharedRoomState; error?: string | null }) => {
    if (payload.state) setRoom(payload.state);
    if (payload.error) setError(payload.error);
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
      const response = await fetch("/api/room", { cache: "no-store" });
      if (response.status === 429) {
        pollDelayRef.current = Math.min(MAX_POLL_DELAY_MS, Math.max(8000, pollDelayRef.current * 2));
        nextDelay = retryDelay(response, pollDelayRef.current);
        setStatus("reconnecting");
        setError(`The shared room is busy. Retrying in ${Math.ceil(nextDelay / 1000)} seconds…`);
        return;
      }
      if (!response.ok) throw new Error(`Room request failed with ${response.status}.`);
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
        setError(`The shared room is temporarily unavailable. Retrying in ${Math.ceil(nextDelay / 1000)} seconds…`);
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

    if (window.location.hostname.endsWith(".chatgpt.site")) {
      startPolling();
      return () => {
        disposedRef.current = true;
        pollingRef.current = false;
        if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
      };
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;
    const fallbackTimer = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        socket.close();
        startPolling();
      }
    }, 1800);

    socket.addEventListener("open", () => {
      window.clearTimeout(fallbackTimer);
      setStatus("connected");
      setError("");
      socket.send(JSON.stringify({ type: "hello", sessionId: stableSessionId }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "state" && message.state) acceptResponse({ state: message.state });
        else if (message.type === "error") setError(String(message.message || "The shared room rejected that action."));
      } catch {
        setError("The shared room returned an unreadable update.");
      }
    });

    socket.addEventListener("close", () => {
      socketRef.current = null;
      if (!disposedRef.current) startPolling();
    });

    socket.addEventListener("error", () => {
      socket.close();
      startPolling();
    });

    return () => {
      disposedRef.current = true;
      pollingRef.current = false;
      window.clearTimeout(fallbackTimer);
      socket.close();
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
          setError(`The room is busy. Your action was not sent; try again in ${Math.ceil(delay / 1000)} seconds.`);
          schedulePoll(delay);
          return;
        }
        const result = await response.json();
        acceptResponse(result);
        if (!response.ok && !result.error) setError("The shared room rejected that action.");
      }).catch(() => {
        setStatus("offline");
        setError("The shared room is temporarily unavailable. Try again in a moment.");
      });
      return true;
    }
    setError("The shared room is connecting. Try again in a moment.");
    return false;
  }, [acceptResponse, schedulePoll]);

  return {
    room,
    status,
    error,
    sessionId,
    send,
    clearError: () => setError("")
  };
}
