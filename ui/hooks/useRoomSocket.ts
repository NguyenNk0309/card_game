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

export function useRoomSocket() {
  const [room, setRoom] = useState<SharedRoomState>(EMPTY_ROOM);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef("");
  const disposedRef = useRef(false);

  const acceptResponse = useCallback((payload: { state?: SharedRoomState; error?: string | null }) => {
    if (payload.state) setRoom(payload.state);
    if (payload.error) setError(payload.error);
    else setError("");
  }, []);

  const pollRoom = useCallback(async () => {
    try {
      const response = await fetch("/api/room", { cache: "no-store" });
      if (!response.ok) throw new Error(`Room request failed with ${response.status}.`);
      acceptResponse(await response.json());
      setStatus("connected");
    } catch {
      if (!disposedRef.current) {
        setStatus("offline");
        setError("The shared room is temporarily unavailable. Reconnecting…");
      }
    }
  }, [acceptResponse]);

  const startPolling = useCallback(() => {
    if (pollingRef.current || disposedRef.current) return;
    pollingRef.current = true;
    setStatus("reconnecting");
    void pollRoom();
    pollTimerRef.current = window.setInterval(pollRoom, 800);
  }, [pollRoom]);

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
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
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
      socket.close();
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
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
  }, [acceptResponse]);

  return {
    room,
    status,
    error,
    sessionId,
    send,
    clearError: () => setError("")
  };
}
