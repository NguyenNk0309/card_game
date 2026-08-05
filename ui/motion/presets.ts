import type { Transition, Variants } from "motion/react";

export const motionEase = [0.22, 1, 0.36, 1] as const;
export const motionEaseIn = [0.4, 0, 1, 1] as const;

export const motionTransition = {
  quick: { duration: 0.1, ease: motionEase },
  standard: { duration: 0.16, ease: motionEase },
  screen: { duration: 0.18, ease: motionEase },
  panel: { duration: 0.22, ease: motionEase },
  dramatic: { duration: 0.38, ease: motionEase },
  layout: { type: "spring", stiffness: 560, damping: 46, mass: 0.58 },
  hand: { type: "spring", stiffness: 680, damping: 52, mass: 0.48 },
} satisfies Record<string, Transition>;

export const fadePresence: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const panelPresence: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.965 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98 },
};

export const popPresence: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.96 },
};

export const screenPresence: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const noticePresence: Variants = {
  hidden: { opacity: 0, x: 28, scale: 0.96 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 34, scale: 0.94 },
};

export const subtleHover = { y: -2, scale: 1.012 };
export const subtleTap = { y: 0, scale: 0.985 };
