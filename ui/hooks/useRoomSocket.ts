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
  const reconnectRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    const storageKey = "shattered-oath-browser-session";
    let stableSessionId = window.localStorage.getItem(storageKey);
    if (!stableSessionId) {
      stableSessionId = `browser-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      window.localStorage.setItem(storageKey, stableSessionId);
    }
    setSessionId(stableSessionId);

    const connect = () => {
      if (disposed) return;
      setStatus(attemptRef.current ? "reconnecting" : "connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attemptRef.current = 0;
        setStatus("connected");
        setError("");
        socket.send(JSON.stringify({ type: "hello", sessionId: stableSessionId }));
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === "state" && message.state) {
            setRoom(message.state as SharedRoomState);
            setError("");
          } else if (message.type === "error") {
            setError(String(message.message || "The shared room rejected that action."));
          }
        } catch {
          setError("The shared room returned an unreadable update.");
        }
      });

      socket.addEventListener("close", () => {
        if (disposed) return;
        socketRef.current = null;
        attemptRef.current += 1;
        setStatus("reconnecting");
        const delay = Math.min(5000, 500 * 2 ** Math.min(4, attemptRef.current));
        reconnectRef.current = window.setTimeout(connect, delay);
      });

      socket.addEventListener("error", () => {
        setStatus("offline");
        setError("Cannot reach the shared room. Start the game with npm run dev and wait for the WebSocket server.");
      });
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("The shared room is reconnecting. Try again in a moment.");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return {
    room,
    status,
    error,
    sessionId,
    send,
    clearError: () => setError("")
  };
}
