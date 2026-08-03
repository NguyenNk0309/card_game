"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { motionEase } from "../motion/presets";

export type AutoPanelVfxVariant =
  | "action-success"
  | "action-failure"
  | "action-skip"
  | "action-discard"
  | "action-neutral"
  | "summary-success"
  | "summary-failure"
  | "summary-skip"
  | "summary-discard"
  | "summary-neutral"
  | "life-revive"
  | "life-defeat"
  | "world-pending"
  | "world-resolved"
  | "battle-victory"
  | "battle-defeat"
  | "battle-complete";

const particleVectors = [
  [0, -46], [20, -39], [38, -21], [47, 0], [38, 22], [20, 40],
  [0, 47], [-20, 40], [-38, 22], [-47, 0], [-38, -21], [-20, -39],
] as const;

export function AutoPanelVfx({ variant }: { variant: AutoPanelVfxVariant }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const summary = variant.startsWith("summary-");
  const world = variant.startsWith("world-");
  const battle = variant.startsWith("battle-");
  const defeat = variant === "life-defeat" || variant === "battle-defeat" || variant.endsWith("failure");
  return <m.div
    className={`auto-panel-vfx auto-panel-vfx-${variant}`}
    data-auto-panel-vfx={variant}
    aria-hidden="true"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1, 0] }}
    transition={{ duration: battle ? 3.2 : 2.8, times: [0, 0.08, 0.76, 1], ease: "linear" }}
  >
    <m.span className="auto-panel-vfx-flash" initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: [0, 0.9, 0.28, 0], scale: [0.82, 1.02, 1, 1.04] }} transition={{ duration: battle ? 2.4 : 1.8, times: [0, 0.12, 0.42, 1], ease: motionEase }}/>
    <m.span className="auto-panel-vfx-frame" initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: [0, 0.72, 0.28, 0], scale: [0.72, 1.025, 1.04, 1] }} transition={{ duration: 2, times: [0, 0.24, 0.58, 1], ease: motionEase }}/>
    <m.span className="auto-panel-vfx-orbit orbit-outer" initial={{ opacity: 0, scale: 0.35, rotate: 0 }} animate={summary ? { opacity: [0, 0.72, 0], scaleX: [0.55, 1.05, 1] } : { opacity: [0, 0.62, 0], scale: [0.35, 1, 1.12], rotate: world ? 240 : 145 }} transition={{ duration: world ? 2.8 : 2.2, times: [0, 0.28, 1], ease: "linear" }}/>
    <m.span className="auto-panel-vfx-orbit orbit-inner" initial={{ opacity: 0, scale: 0.2, rotate: 120 }} animate={summary ? { opacity: [0, 0.58, 0], scaleX: [0.5, 1, 0.9], rotate: 90 } : { opacity: [0, 0.55, 0], scale: [0.2, 1, 1.16], rotate: world ? 0 : -100 }} transition={{ duration: world ? 2.4 : 1.8, times: [0, 0.34, 1], ease: "linear" }}/>
    <span className="auto-panel-vfx-particles">
      {particleVectors.map(([x, y], index) => <m.i
        key={`${x}:${y}`}
        initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: defeat ? 45 : 0 }}
        animate={{ opacity: [0, 1, 0.68, 0], x: `${x}vw`, y: `${defeat ? Math.abs(y) : y}vh`, scale: [0.3, 1, 0.9, 0.7], rotate: defeat ? 225 : 180 }}
        transition={{ duration: 1.65, times: [0, 0.18, 0.72, 1], delay: index * 0.015, ease: "linear" }}
      />)}
    </span>
  </m.div>;
}
