"use client";

import { Eye, X } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CardArtwork } from "../cardArtwork";
import { fadePresence, motionTransition, panelPresence } from "../motion/presets";

type Props = {
  artwork: CardArtwork;
  cardName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function CardArtworkViewer({ artwork, cardName, onOpenChange, open }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [loadedSource, setLoadedSource] = useState("");
  const reducedMotion = useReducedMotion();
  const revealCachedScene = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setLoadedSource(artwork.scene ?? "");
  }, [artwork.scene]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeWithEscape);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [onOpenChange, open]);

  const openViewer = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (artwork.scene) onOpenChange(true);
  };
  const openWithKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (artwork.scene) onOpenChange(true);
  };
  const keepFocusInViewer = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    closeRef.current?.focus({ preventScroll: true });
  };

  const portalRoot = artwork.scene && typeof document !== "undefined" ? document.body : null;

  return <>
    <span
      ref={triggerRef}
      className="gothic-card-view-image"
      role="button"
      tabIndex={artwork.scene ? 0 : -1}
      aria-disabled={!artwork.scene}
      aria-haspopup="dialog"
      aria-label={`View full illustration for ${cardName}`}
      onClickCapture={openViewer}
      onKeyDownCapture={openWithKeyboard}
    ><Eye aria-hidden="true"/><span>View Image</span></span>
    {portalRoot && createPortal(<AnimatePresence>{open && <m.div className="card-artwork-viewer-backdrop" onClick={() => onOpenChange(false)} variants={fadePresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}>
      <m.section
        className="card-artwork-viewer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={keepFocusInViewer}
        variants={panelPresence}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={motionTransition.panel}
      >
        <header>
          <div><small>FULL ILLUSTRATION</small><h2 id={titleId}>{cardName}</h2></div>
          <button ref={closeRef} type="button" className="card-artwork-viewer-close" onClick={() => onOpenChange(false)} aria-label="Close full illustration"><X/></button>
        </header>
        <div className={`card-artwork-viewer-frame ${loadedSource === artwork.scene ? "is-loaded" : "is-loading"}`} aria-busy={loadedSource !== artwork.scene}>
          <m.img className="card-artwork-viewer-image" ref={revealCachedScene} src={artwork.scene} alt={artwork.alt} decoding="async" draggable={false} onLoad={() => setLoadedSource(artwork.scene ?? "")} initial={{ opacity: 0 }} animate={{ opacity: loadedSource === artwork.scene ? 1 : 0 }}/>
          {loadedSource !== artwork.scene && <m.span className="card-artwork-viewer-loading" role="status" animate={{ opacity: reducedMotion ? 0.65 : [0.25, 0.8, 0.25] }} transition={reducedMotion ? { duration: 0 } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}>Loading full illustration&hellip;</m.span>}
        </div>
      </m.section>
    </m.div>}</AnimatePresence>, portalRoot)}
  </>;
}
