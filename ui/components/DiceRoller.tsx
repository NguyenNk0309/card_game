"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Dices, SkipForward, Sparkles, Trash2, X } from "lucide-react";
import { PityIcon } from "./PityCost";

type ConfirmAction = "skip" | "discard" | null;

export function DiceRoller({ roll, rolling, target, passiveBonus = 0, diceBuff = 0, dicePenalty = 0, pityPoints = 0, pityCost = 0, hasSelectedCard = false, canPlaySelectedCard = true, selectedCardBlockReason = "", onRoll, onPity, onSkip, onDiscard, disabled = false }: { roll: number | null; rolling: boolean; target: number; passiveBonus?: number; diceBuff?: number; dicePenalty?: number; pityPoints?: number; pityCost?: number; hasSelectedCard?: boolean; canPlaySelectedCard?: boolean; selectedCardBlockReason?: string; onRoll: () => void; onPity: () => void; onSkip: () => void; onDiscard: () => void; disabled?: boolean; }) {
  const modifier = passiveBonus + diceBuff - dicePenalty;
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 8, left: 8 });
  const [popoverBelow, setPopoverBelow] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmAction) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!controlsRef.current?.contains(target) && !confirmationRef.current?.contains(target)) setConfirmAction(null);
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

  useLayoutEffect(() => {
    if (!confirmAction) return;
    const placeConfirmation = () => {
      const anchor = confirmAction === "skip" ? skipButtonRef.current : discardButtonRef.current;
      const confirmation = confirmationRef.current;
      if (!anchor || !confirmation) return;
      const anchorRect = anchor.getBoundingClientRect();
      const confirmationRect = confirmation.getBoundingClientRect();
      const gap = 8;
      const shouldPlaceBelow = anchorRect.top - confirmationRect.height - gap < 8;
      setPopoverBelow(shouldPlaceBelow);
      setPopoverPosition({
        top: shouldPlaceBelow ? anchorRect.bottom + gap : anchorRect.top - confirmationRect.height - gap,
        left: Math.min(Math.max(8, anchorRect.right - confirmationRect.width), window.innerWidth - confirmationRect.width - 8),
      });
    };
    placeConfirmation();
    window.addEventListener("resize", placeConfirmation);
    window.addEventListener("scroll", placeConfirmation, true);
    return () => {
      window.removeEventListener("resize", placeConfirmation);
      window.removeEventListener("scroll", placeConfirmation, true);
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
    <div className="dice-copy"><span className="eyebrow">ACTION CHECK</span><strong>Target <b>{target}</b></strong><small>d20{passiveBonus ? ` + ${passiveBonus} Marshal's Fortune` : ""}{diceBuff ? ` + ${diceBuff} Precision Order` : ""}{dicePenalty ? ` - ${dicePenalty} omen/hex` : ""}</small><em>Total modifier: <b>{modifier >= 0 ? "+" : ""}{modifier}</b></em></div>
    <button className="roll-button" onClick={onRoll} disabled={rolling || disabled || !hasSelectedCard || !canPlaySelectedCard} title={selectedCardBlockReason || undefined}>{rolling ? <Sparkles size={17}/> : <Dices size={18}/>}<span>{rolling ? "Rolling..." : !hasSelectedCard && !disabled ? "Select a card" : selectedCardBlockReason || "Roll the die"}</span></button>
    <button className="pity-button" onClick={onPity} disabled={rolling || disabled || !hasSelectedCard || !canPlaySelectedCard || pityPoints < pityCost} title={!hasSelectedCard ? "Select a card" : selectedCardBlockReason || (pityPoints < pityCost ? `Need ${pityCost - pityPoints} pity` : `Spend ${pityCost} pity to succeed`)}><PityIcon size={18}/><span>Pity roll<small>{pityPoints} available · cost {pityCost}</small></span></button>
    <div className="turn-action-buttons" ref={controlsRef}>
      <div className="turn-action-control">
        <button ref={skipButtonRef} className="skip-turn-button" onClick={() => setConfirmAction("skip")} disabled={rolling || disabled} aria-expanded={confirmAction === "skip"}><SkipForward size={17}/><span>Skip</span></button>
      </div>
      <div className="turn-action-control">
        <button ref={discardButtonRef} className="discard-card-button" onClick={() => setConfirmAction("discard")} disabled={rolling || disabled || !hasSelectedCard} aria-expanded={confirmAction === "discard"}><Trash2 size={17}/><span>Discard</span></button>
      </div>
    </div>
    {confirmAction && createPortal(<div className={`turn-action-confirm turn-action-confirm-portal ${popoverBelow ? "below" : ""}`} ref={confirmationRef} role="dialog" aria-label={confirmAction === "skip" ? "Confirm skip turn" : "Confirm discard card"} style={popoverPosition}>
      <strong>{confirmAction === "skip" ? "Skip this turn?" : "Discard this card?"}</strong>
      <span>{confirmAction === "skip" ? "Hand stays unchanged." : "Card leaves your hand."}</span>
      <div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div>
    </div>, document.body)}
  </section>;
}
