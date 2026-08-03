"use client";

import { useEffect, useState, type ReactNode } from "react";

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
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const deviceQuery = window.matchMedia(SUPPORTED_DEVICE_QUERY);
    const syncSupport = () => setSupported(deviceQuery.matches && !isMobileDevice());

    syncSupport();
    deviceQuery.addEventListener("change", syncSupport);
    return () => deviceQuery.removeEventListener("change", syncSupport);
  }, []);

  return supported ? children : <UnsupportedDevice/>;
}
