"use client";

import { ChevronDown, Crown, DoorOpen, KeyRound, Plus, Shield, Swords, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { normalizeRoomId, ROOM_ID_LENGTH } from "@/shared/roomId.mjs";

export function HomeScreen({ busy, error, onCreateRoom, onJoinRoom }: {
  busy: boolean;
  error: string;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (roomId: string) => Promise<void>;
}) {
  const [playOpen, setPlayOpen] = useState(false);
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    if (error) setPlayOpen(true);
  }, [error]);

  const submitJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onJoinRoom(roomId);
  };

  return <main className="home-screen">
    <div className="home-grain" aria-hidden="true"/>
    <section className="home-hero">
      <div className="home-sigil" aria-hidden="true"><Shield/><Crown/><Swords/></div>
      <span className="home-kicker">A SHARED OATH AWAITS</span>
      <h1>SHATTERED<br/><em>OATH</em></h1>
      <p>Gather your warriors. Choose a side. Survive an unlimited battle of cards, consequences, and shifting fate.</p>

      <div className={`home-play-panel ${playOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="home-play-button"
          aria-expanded={playOpen}
          aria-controls="home-room-actions"
          onClick={() => setPlayOpen((current) => !current)}
          disabled={busy}
        >
          <Swords size={20}/> Play game <ChevronDown size={18}/>
        </button>
        {playOpen && <div className="home-room-actions" id="home-room-actions">
          <form className="home-join-room" onSubmit={submitJoin}>
            <label htmlFor="home-room-id"><KeyRound size={15}/> Join an existing oath</label>
            <div>
              <input
                id="home-room-id"
                value={roomId}
                onChange={(event) => setRoomId(normalizeRoomId(event.target.value).slice(0, ROOM_ID_LENGTH))}
                placeholder="Enter room ID"
                maxLength={ROOM_ID_LENGTH}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
              <button type="submit" disabled={busy || roomId.length !== ROOM_ID_LENGTH}><DoorOpen size={17}/> Join</button>
            </div>
          </form>
          <div className="home-room-divider"><span>OR</span></div>
          <button type="button" className="home-create-room" onClick={() => void onCreateRoom()} disabled={busy}>
            <Plus size={18}/> Create a new room
          </button>
          {error && <p className="home-room-error" role="alert">{error}</p>}
        </div>}
      </div>

      <div className="home-feature-line" aria-label="Game features">
        <span><Users size={15}/> 2–10 players</span>
        <i/>
        <span><Shield size={15}/> Two rival teams</span>
        <i/>
        <span><Crown size={15}/> One victor</span>
      </div>
    </section>

  </main>;
}
