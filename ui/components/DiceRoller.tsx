"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Dices, Hourglass, SkipForward, Sparkles, Trash2, X } from "lucide-react";
import { PityIcon } from "./PityCost";

type ConfirmAction = "skip" | "discard" | null;

export function DiceRoller({ roll, rolling, target, passiveBonus = 0, diceBuff = 0, dicePenalty = 0, pityPoints = 0, pityCost = 0, hasSelectedCard = false, onRoll, onPity, onSkip, onDiscard, disabled = false, disabledLabel = "Waiting for your turn" }: { roll: number | null; rolling: boolean; target: number; passiveBonus?: number; diceBuff?: number; dicePenalty?: number; pityPoints?: number; pityCost?: number; hasSelectedCard?: boolean; onRoll: () => void; onPity: () => void; onSkip: () => void; onDiscard: () => void; disabled?: boolean; disabledLabel?: ReactNode; }) {
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
    if (rolling || disabled || (confirmAction === "discard" && !hasSelectedCard)) setConfirmAction(null);
  }, [rolling, disabled, hasSelectedCard, confirmAction]);

  const confirm = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "skip") onSkip();
    if (action === "discard") onDiscard();
  };

  return <section className="dice-panel">
    <div className={`d20 ${rolling ? "rolling" : ""}`} aria-label={rolling ? "Rolling d20" : roll === null ? "D20" : `D20 rolled ${roll}`}><span aria-hidden="true">?</span></div>
    <div className="dice-copy"><span className="eyebrow">ACTION CHECK</span><strong>Target {target}</strong><small>d20{passiveBonus ? ` + ${passiveBonus} Commanding Voice` : ""}{diceBuff ? ` + ${diceBuff} Focus Order` : ""}{dicePenalty ? ` - ${dicePenalty} omen/hex` : ""}</small><em>Total modifier: {modifier >= 0 ? "+" : ""}{modifier}</em></div>
    <button className="roll-button" onClick={onRoll} disabled={rolling || disabled || !hasSelectedCard}>{rolling ? <Sparkles size={17}/> : disabled ? <Hourglass className="waiting-hourglass" size={18}/> : <Dices size={18}/>}<span>{rolling ? "Rolling..." : disabled ? disabledLabel : !hasSelectedCard ? "Select a card" : "Roll the die"}</span></button>
    <button className="pity-button" onClick={onPity} disabled={rolling || disabled || !hasSelectedCard || pityPoints < pityCost} title={!hasSelectedCard ? "Select a card first" : pityPoints < pityCost ? `Need ${pityCost - pityPoints} more pity point${pityCost - pityPoints === 1 ? "" : "s"}` : `Spend ${pityCost} pity point${pityCost === 1 ? "" : "s"} for guaranteed success`}><PityIcon size={18}/><span>Pity roll<small>{pityPoints} available · cost {pityCost}</small></span></button>
    <div className="turn-action-buttons" ref={confirmationRef}>
      <div className="turn-action-control">
        <button className="skip-turn-button" onClick={() => setConfirmAction("skip")} disabled={rolling || disabled} aria-expanded={confirmAction === "skip"}><SkipForward size={17}/><span>Skip</span></button>
        {confirmAction === "skip" && <div className="turn-action-confirm" role="dialog" aria-label="Confirm skip turn"><strong>Skip this turn?</strong><span>Your hand will stay unchanged.</span><div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div></div>}
      </div>
      <div className="turn-action-control">
        <button className="discard-card-button" onClick={() => setConfirmAction("discard")} disabled={rolling || disabled || !hasSelectedCard} aria-expanded={confirmAction === "discard"}><Trash2 size={17}/><span>Discard</span></button>
        {confirmAction === "discard" && <div className="turn-action-confirm" role="dialog" aria-label="Confirm discard card"><strong>Discard this card?</strong><span>The selected card leaves your hand.</span><div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div></div>}
      </div>
    </div>
  </section>;
}
