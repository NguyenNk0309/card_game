"use client";

import type { ReactNode } from "react";
import { domMax, LazyMotion, MotionConfig } from "motion/react";

export function GameMotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domMax} strict>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  </LazyMotion>;
}
