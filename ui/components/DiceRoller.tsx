"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Dices, SkipForward, Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { PityIcon } from "./PityCost";
import { motionTransition, popPresence, subtleHover, subtleTap } from "../motion/presets";

type ConfirmAction = "skip" | "discard" | null;

type ModifierDetail = {
  label: string;
  value: number;
};

function signedModifier(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function DiceRoller({ rolling, target, passiveBonus = 0, passiveName = "character passive", diceBuff = 0, dicePenalty = 0, shopDiceBonus = 0, markedTargetBonus = 0, pityPoints = 0, pityCost = 0, hasSelectedCard = false, canPlaySelectedCard = true, selectedCardBlockReason = "", onRoll, onPity, onSkip, onDiscard, disabled = false }: { rolling: boolean; target: number; passiveBonus?: number; passiveName?: string; diceBuff?: number; dicePenalty?: number; shopDiceBonus?: number; markedTargetBonus?: number; pityPoints?: number; pityCost?: number; hasSelectedCard?: boolean; canPlaySelectedCard?: boolean; selectedCardBlockReason?: string; onRoll: () => void; onPity: () => void; onSkip: () => void; onDiscard: () => void; disabled?: boolean; }) {
  const modifierDetails: ModifierDetail[] = [
    { value: passiveBonus, label: `from passive of ${passiveName}` },
    { value: diceBuff, label: "from buff" },
    { value: -dicePenalty, label: "from debuff" },
    { value: shopDiceBonus, label: "from potion/item" },
    { value: markedTargetBonus, label: "from Marked Target" },
  ].filter((detail) => detail.value !== 0);
  const modifier = modifierDetails.reduce((total, detail) => total + detail.value, 0);
  const reducedMotion = useReducedMotion();
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

  return <m.section className="dice-panel" layout>
    <div className="dice-action-check">
      <m.div className={`d20 ${rolling ? "rolling" : ""}`} aria-label={rolling ? "Rolling d20" : "D20"} animate={rolling && !reducedMotion ? { scale: [1, 0.94, 1] } : { scale: 1 }} transition={rolling && !reducedMotion ? { duration: 0.7, ease: "easeInOut", repeat: Infinity } : motionTransition.standard}><span aria-hidden="true">?</span></m.div>
      <div className="dice-copy"><span className="eyebrow">ACTION CHECK</span><strong className="dice-target">Target <b>{target}</b></strong><em className="dice-total-modifier">Total modifier: <span className="dice-modifier-anchor"><b className="dice-modifier-value" tabIndex={0} aria-describedby="dice-modifier-tooltip">{signedModifier(modifier)}</b><span className="dice-modifier-tooltip" id="dice-modifier-tooltip" role="tooltip"><span className="dice-modifier-tooltip-title">Modifier details</span>{modifierDetails.length ? modifierDetails.map((detail) => <span className="dice-modifier-detail" key={detail.label}><b>{signedModifier(detail.value)}</b> {detail.label}</span>) : <span className="dice-modifier-empty">No active modifiers</span>}</span></span></em></div>
    </div>
    <m.button className="roll-button" onClick={onRoll} disabled={rolling || disabled || !hasSelectedCard || !canPlaySelectedCard} title={selectedCardBlockReason || undefined} whileHover={!rolling && !disabled && hasSelectedCard && canPlaySelectedCard ? subtleHover : undefined} whileTap={!rolling && !disabled && hasSelectedCard && canPlaySelectedCard ? subtleTap : undefined}>{rolling ? <Sparkles size={17}/> : <Dices size={18}/>}<span>{rolling ? "Rolling..." : !hasSelectedCard && !disabled ? "Select a card" : selectedCardBlockReason || "Roll the die"}</span></m.button>
    <m.button className="pity-button" onClick={onPity} disabled={rolling || disabled || !hasSelectedCard || !canPlaySelectedCard || pityPoints < pityCost} title={!hasSelectedCard ? "Select a card" : selectedCardBlockReason || (pityPoints < pityCost ? `Need ${pityCost - pityPoints} pity` : `Spend ${pityCost} pity to succeed`)} whileHover={!rolling && !disabled && hasSelectedCard && canPlaySelectedCard && pityPoints >= pityCost ? subtleHover : undefined} whileTap={!rolling && !disabled && hasSelectedCard && canPlaySelectedCard && pityPoints >= pityCost ? subtleTap : undefined}><PityIcon size={18}/><span>Pity roll<small>{pityPoints} available · cost {pityCost}</small></span></m.button>
    <div className="turn-action-buttons" ref={controlsRef}>
      <div className="turn-action-control">
        <button ref={skipButtonRef} className="skip-turn-button" onClick={() => setConfirmAction("skip")} disabled={rolling || disabled} aria-expanded={confirmAction === "skip"}><SkipForward size={17}/><span>Skip</span></button>
      </div>
      <div className="turn-action-control">
        <button ref={discardButtonRef} className="discard-card-button" onClick={() => setConfirmAction("discard")} disabled={rolling || disabled || !hasSelectedCard} aria-expanded={confirmAction === "discard"}><Trash2 size={17}/><span>Discard</span></button>
      </div>
    </div>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{confirmAction && <m.div className={`turn-action-confirm turn-action-confirm-portal ${popoverBelow ? "below" : ""}`} ref={confirmationRef} role="dialog" aria-label={confirmAction === "skip" ? "Confirm skip turn" : "Confirm discard card"} style={popoverPosition} variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.quick}>
      <strong>{confirmAction === "skip" ? "Skip this turn?" : "Discard this card?"}</strong>
      <span>{confirmAction === "skip" ? "Hand stays unchanged." : "Selected card leaves the hand."}</span>
      <div><button onClick={confirm}><Check size={13}/> Confirm</button><button onClick={() => setConfirmAction(null)}><X size={13}/> Cancel</button></div>
    </m.div>}</AnimatePresence>, document.body)}
  </m.section>;
}
