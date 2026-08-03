"use client";

import { ChevronDown, Crown, DoorOpen, KeyRound, Plus, Shield, Swords, Users } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { FormEvent, useEffect, useState } from "react";
import { normalizeRoomId, ROOM_ID_LENGTH } from "@/shared/roomId.mjs";
import { motionEase, motionTransition, popPresence, subtleHover, subtleTap } from "../motion/presets";

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

  return <m.main className="home-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={motionTransition.standard}>
    <div className="home-grain" aria-hidden="true"/>
    <m.section className="home-hero" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.075, delayChildren: 0.08 } } }}>
      <m.div className="home-sigil" aria-hidden="true" variants={popPresence} transition={motionTransition.panel}><Shield/><Crown/><Swords/></m.div>
      <m.span className="home-kicker" variants={popPresence}>A SHARED OATH AWAITS</m.span>
      <m.h1 variants={popPresence}>SHATTERED<br/><em>OATH</em></m.h1>
      <m.p variants={popPresence}>Gather your warriors. Choose a side. Survive an unlimited battle of cards, consequences, and shifting fate.</m.p>

      <m.div className={`home-play-panel ${playOpen ? "is-open" : ""}`} variants={popPresence}>
        <m.button
          type="button"
          className="home-play-button"
          aria-expanded={playOpen}
          aria-controls="home-room-actions"
          onClick={() => setPlayOpen((current) => !current)}
          disabled={busy}
          whileHover={!busy ? subtleHover : undefined}
          whileTap={!busy ? subtleTap : undefined}
        >
          <Swords size={20}/> Play game <m.span className="home-play-chevron" animate={{ rotate: playOpen ? 180 : 0 }} transition={motionTransition.quick}><ChevronDown size={18}/></m.span>
        </m.button>
        <AnimatePresence initial={false}>
          {playOpen && <m.div className="home-room-actions" id="home-room-actions" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -6 }} transition={{ duration: 0.24, ease: motionEase }}>
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
                <m.button type="submit" disabled={busy || roomId.length !== ROOM_ID_LENGTH} whileHover={!busy && roomId.length === ROOM_ID_LENGTH ? subtleHover : undefined} whileTap={!busy && roomId.length === ROOM_ID_LENGTH ? subtleTap : undefined}><DoorOpen size={17}/> Join</m.button>
              </div>
            </form>
            <div className="home-room-divider"><span>OR</span></div>
            <m.button type="button" className="home-create-room" onClick={() => void onCreateRoom()} disabled={busy} whileHover={!busy ? subtleHover : undefined} whileTap={!busy ? subtleTap : undefined}>
              <Plus size={18}/> Create a new room
            </m.button>
            <AnimatePresence>{error && <m.p className="home-room-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>{error}</m.p>}</AnimatePresence>
          </m.div>}
        </AnimatePresence>
      </m.div>

      <m.div className="home-feature-line" aria-label="Game features" variants={popPresence}>
        <span><Users size={15}/> 2–10 players</span>
        <i/>
        <span><Shield size={15}/> Two rival teams</span>
        <i/>
        <span><Crown size={15}/> One victor</span>
      </m.div>
    </m.section>
  </m.main>;
}
