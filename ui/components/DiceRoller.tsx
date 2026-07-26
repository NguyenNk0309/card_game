"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Dices, SkipForward, Sparkles, Trash2, X } from "lucide-react";

type ConfirmAction = "skip" | "discard" | null;

export function DiceRoller({ roll, rolling, target, passiveBonus = 0, diceBuff = 0, dicePenalty = 0, onRoll, onSkip = () => document.querySelector<HTMLButtonElement>(".encounter-row > .skip-turn-button")?.click(), onDiscard = () => document.querySelector<HTMLButtonElement>(".game-shell > .discard-card-button")?.click(), disabled = false, disabledLabel = "Waiting for your turn" }: { roll: number | null; rolling: boolean; target: number; passiveBonus?: number; diceBuff?: number; dicePenalty?: number; onRoll: () => void; onSkip?: () => void; onDiscard?: () => void; disabled?: boolean; disabledLabel?: string; }) {
  const modifier = passiveBonus + diceBuff - dicePenalty;
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmAction) return;
    const closeOutside = (event: PointerEvent) => {
      if (!confirmationRef.current?.contains(event.target as Node)) setConfirmAction(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmAction(null);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmAction]);

  useEffect(() => {
    if (rolling || disabled) setConfirmAction(null);
  }, [rolling, disabled]);

  const confirm = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "skip") onSkip();
    if (action === "discard") onDiscard();
  };

  return <section className="dice-panel">
    <div className={`d20 ${rolling ? "rolling" : ""}`}><span>{roll ?? "20"}</span></div>
    <div className="dice-copy"><span className="eyebrow">ACTION CHECK</span><strong>Target {target}</strong><small>d20{passiveBonus ? ` + ${passiveBonus} class passive` : ""}{diceBuff ? ` + ${diceBuff} active card buff` : ""}{dicePenalty ? ` - ${dicePenalty} enemy effect` : ""}</small><em>No card has a built-in roll bonus. Total modifier: {modifier >= 0 ? "+" : ""}{modifier}.</em></div>
    <button className="roll-button" onClick={onRoll} disabled={rolling || disabled}>{rolling ? <Sparkles size={17}/> : <Dices size={18}/>} {rolling ? "Rolling..." : disabled ? disabledLabel : "Roll the die"}</button>
    <div className="turn-action-buttons" ref={confirmationRef}>
      <div className="turn-action-control">
        <button className="skip-turn-button" onClick={() => setConfirmAction("skip")} disabled={rolling || disabled} aria-expanded={confirmAction === "skip"}><SkipForward size={17}/><span>Skip</span><small>Keep hand</small></button>
        {confirmAction === "skip" && <div className="turn-action-confirm" role="dialog" aria-label="Confirm skip turn"><strong>Skip this turn?</strong><span>Your hand will stay unchanged.</span><div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div></div>}
      </div>
      <div className="turn-action-control">
        <button className="discard-card-button" onClick={() => setConfirmAction("discard")} disabled={rolling || disabled} aria-expanded={confirmAction === "discard"}><Trash2 size={17}/><span>Discard</span><small>Replace card</small></button>
        {confirmAction === "discard" && <div className="turn-action-confirm" role="dialog" aria-label="Confirm discard card"><strong>Discard this card?</strong><span>The selected card leaves your hand.</span><div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div></div>}
      </div>
    </div>
  </section>;
}
