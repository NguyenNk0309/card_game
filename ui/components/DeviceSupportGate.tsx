"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { motionTransition, screenPresence } from "../motion/presets";

const SUPPORTED_DEVICE_QUERY = "(min-width: 1280px) and (min-height: 720px)";
const MOBILE_DEVICE_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function isMobileDevice() {
  const mobileNavigator = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return mobileNavigator.userAgentData?.mobile === true
    || MOBILE_DEVICE_PATTERN.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function UnsupportedDevice() {
  return <main className="unsupported-device"><p>App currently does not support this device.</p></main>;
}

export function DeviceSupportGate({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const deviceQuery = window.matchMedia(SUPPORTED_DEVICE_QUERY);
    const syncSupport = () => setSupported(deviceQuery.matches && !isMobileDevice());

    syncSupport();
    deviceQuery.addEventListener("change", syncSupport);
    return () => deviceQuery.removeEventListener("change", syncSupport);
  }, []);

  if (supported === null) return null;
  return <AnimatePresence initial={false} mode="wait">{supported
    ? <m.div className="device-gate-screen" key="supported" variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}>{children}</m.div>
    : <m.div className="device-gate-screen" key="unsupported" variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}><UnsupportedDevice/></m.div>}
  </AnimatePresence>;
}
