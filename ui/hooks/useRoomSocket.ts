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

function localizeRoomError(message: string) {
  const rules: Array<[string, string]> = [
    ["already started", "Trận đấu đã bắt đầu."],
    ["session is incomplete", "Thông tin phiên người chơi chưa đầy đủ."],
    ["cannot create another", "Trình duyệt này không thể tạo thêm phiên người chơi."],
    ["already has 10 players", "Phòng đã đủ 10 người chơi."],
    ["player name is already", "Tên người chơi này đã được dùng."],
    ["character has already", "Nhân vật này đã được chọn."],
    ["Readiness can only", "Chỉ có thể đổi trạng thái sẵn sàng trong sảnh."],
    ["ready your own", "Bạn chỉ có thể sẵn sàng cho chính mình."],
    ["Join the lobby", "Hãy tham gia sảnh trước."],
    ["cannot leave during", "Không thể rời sảnh bằng nút này khi trận đang diễn ra."],
    ["remove your own", "Bạn chỉ có thể rời bằng phiên của chính mình."],
    ["joined player can remove", "Chỉ người đã tham gia mới có thể xóa người chơi khác."],
    ["before removing", "Hãy tham gia phòng trước khi xóa người chơi."],
    ["Use Leave", "Hãy dùng nút Rời để xóa chính bạn."],
    ["no longer in the room", "Người chơi đó không còn trong phòng."],
    ["At least two players", "Cần ít nhất hai người chơi."],
    ["Every joined player", "Tất cả người chơi phải sẵn sàng."],
    ["state is missing", "Dữ liệu trận đấu bị thiếu."],
    ["no active adventure", "Hiện không có trận đấu đang diễn ra."],
    ["current player", "Chỉ người đang có lượt mới được thực hiện hành động."],
    ["update is incomplete", "Dữ liệu cập nhật lượt chưa đầy đủ."],
    ["joined player can end", "Chỉ người trong trận mới có thể kết thúc trận."],
    ["not in the adventure", "Người chơi đó không còn trong trận."],
    ["does not recognize", "Phòng không nhận ra hành động này."]
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
      const response = await fetch("/api/room", { cache: "no-store" });
      if (response.status === 429) {
        pollDelayRef.current = Math.min(MAX_POLL_DELAY_MS, Math.max(8000, pollDelayRef.current * 2));
        nextDelay = retryDelay(response, pollDelayRef.current);
        setStatus("reconnecting");
        setError(`Phòng đang bận. Tự thử lại sau ${Math.ceil(nextDelay / 1000)} giây…`);
        return;
      }
      if (!response.ok) throw new Error(`Yêu cầu phòng thất bại với mã ${response.status}.`);
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
        setError(`Phòng tạm thời không khả dụng. Tự thử lại sau ${Math.ceil(nextDelay / 1000)} giây…`);
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
        else if (message.type === "error") setError(localizeRoomError(String(message.message || "Phòng đã từ chối hành động này.")));
      } catch {
        setError("Phòng trả về dữ liệu không thể đọc.");
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
          setError(`Phòng đang bận. Hành động chưa được gửi; thử lại sau ${Math.ceil(delay / 1000)} giây.`);
          schedulePoll(delay);
          return;
        }
        const result = await response.json();
        acceptResponse(result);
        if (!response.ok && !result.error) setError("Phòng đã từ chối hành động này.");
      }).catch(() => {
        setStatus("offline");
        setError("Phòng tạm thời không khả dụng. Vui lòng thử lại sau giây lát.");
      });
      return true;
    }
    setError("Phòng đang kết nối. Vui lòng thử lại sau giây lát.");
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
