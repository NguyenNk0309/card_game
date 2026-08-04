"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "motion/react";
import { mountD20Scene } from "./D20Scene";
import type { D20AnimationState, D20Quality, D20RollInput, D20RollOutput } from "./D20Types";

export type D20DiceProps = D20RollInput & {
  rollId?: string | number;
  quality?: D20Quality;
  pauseAt?: "result";
  startAt?: "result";
  onRollComplete: (result: D20RollOutput) => void;
  onRollError?: (error: Error) => void;
  onStateChange?: (state: D20AnimationState) => void;
};

const stateLabel: Record<D20AnimationState, string> = {
  idle: "Preparing d20",
  spawning: "Throwing d20",
  throwing: "D20 rolling",
  completed: "D20 roll complete",
  cancelled: "D20 roll cancelled",
  error: "D20 animation unavailable",
};

export function D20Dice({ rawResult, modifier, finalResult, rollId = `${rawResult}:${modifier}:${finalResult}`, quality = "high", pauseAt, startAt, onRollComplete, onRollError, onStateChange }: D20DiceProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef({ onRollComplete, onRollError, onStateChange });
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [animationState, setAnimationState] = useState<D20AnimationState>("idle");
  const reducedMotion = Boolean(useReducedMotion());
  const portalReady = portalHost !== null;
  callbackRef.current = { onRollComplete, onRollError, onStateChange };

  useLayoutEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const viewAnchor = anchorRef.current;
    if (!container || !viewAnchor) return;
    return mountD20Scene(container, {
      input: { rawResult, modifier, finalResult },
      viewAnchor,
      reducedMotion,
      quality,
      pauseAt,
      startAt,
      onRollComplete: (result) => callbackRef.current.onRollComplete(result),
      onRollError: (error) => callbackRef.current.onRollError?.(error),
      onStateChange: (state) => {
        setAnimationState(state);
        callbackRef.current.onStateChange?.(state);
      },
    });
  }, [rawResult, modifier, finalResult, rollId, quality, pauseAt, startAt, reducedMotion, portalReady]);

  return (
    <>
      <span className="d20-roll-anchor" ref={anchorRef} aria-hidden="true" />
      {portalHost && createPortal(
        <section
          className="d20-roll-overlay"
          role="status"
          aria-live="polite"
          aria-label={stateLabel[animationState]}
          data-d20-state={animationState}
        >
          <div className="d20-roll-scene" ref={containerRef}/>
          <span className="sr-only">{stateLabel[animationState]}</span>
        </section>,
        portalHost,
      )}
    </>
  );
}
