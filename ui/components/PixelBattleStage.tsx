"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import animationManifestData from "@/public/pixel/animations.manifest.json";
import type { ActionCard, GameOutcome, GameTargetImpact, PlayerSession } from "@/shared/types";

type PixelClipDefinition = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  columns?: number;
  fps: number;
  loop?: boolean;
};

type PixelAnimationManifest = {
  version: number;
  clips: Record<string, PixelClipDefinition>;
};

type PixelBattleStageProps = {
  sequenceKey: string;
  actor?: PlayerSession;
  targets?: PlayerSession[];
  card?: ActionCard;
  outcome?: GameOutcome | null;
  mode?: "action" | "world" | "result";
  worldTitle?: string;
  verdict?: "victory" | "defeat" | "complete";
  impacts?: GameTargetImpact[];
  onAnimationComplete: () => void;
};

const animationManifest = animationManifestData as PixelAnimationManifest;
const FALLBACK_CLIP: PixelClipDefinition = {
  src: "",
  frameWidth: 64,
  frameHeight: 64,
  frames: 8,
  columns: 8,
  fps: 8
};
const pixelImageCache = new Map<string, { image: HTMLImageElement; ready: Promise<void> }>();

function loadPixelImage(src: string) {
  const cached = pixelImageCache.get(src);
  if (cached) return cached;
  const image = new Image();
  const ready = new Promise<void>((resolve) => {
    const finish = () => {
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
  });
  const entry = { image, ready };
  pixelImageCache.set(src, entry);
  image.src = src;
  return entry;
}

const slugify = (value = "") => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const normalizedCardId = (card?: ActionCard, outcome?: GameOutcome | null) => {
  const rawId = outcome?.cardId ?? card?.id ?? "";
  const commonMarker = rawId.lastIndexOf("-common-");
  return commonMarker >= 0 ? rawId.slice(commonMarker + 8) : rawId;
};

function resolveClip(...ids: Array<string | undefined>) {
  for (const id of ids) {
    if (id && animationManifest.clips[id]) return { id, clip: animationManifest.clips[id] };
  }
  return { id: "synthetic.fallback", clip: FALLBACK_CLIP };
}

function clipDuration(clip: PixelClipDefinition) {
  return Math.max(400, Math.round(Math.max(1, clip.frames) / Math.max(1, clip.fps) * 1000));
}

function actionAnimation(card?: ActionCard, outcome?: GameOutcome | null) {
  const kind = outcome?.kind;
  if (kind === "discard") return "discard";
  if (kind === "skip") return "skip";
  if (kind === "timeout") return "timeout";
  if (kind === "forced-skip") return "forced-skip";
  if (outcome?.resolution === "pity") return "pity-success";
  if (card?.pityCost === 0 || outcome?.pityCost === 0) return "zero-pity-success";
  if (outcome && !outcome.success) return "backlash";
  if (!card) return "cast";
  if (card.effect === "guard") return "brace";
  if (card.effect === "heal") return "second-wind";
  if (card.effect === "damage") return card.value >= 4 ? "heavy" : "slash";
  if (card.effect === "none") return "zero-pity-success";
  return "cast";
}

function targetAnimation(card?: ActionCard, outcome?: GameOutcome | null, impact?: GameTargetImpact) {
  if (impact) {
    if (impact.kind === "damage") return impact.defeated ? "defeat" : (impact.blocked ?? 0) > 0 ? "shield-hit" : "hurt";
    if (impact.kind === "shield") return "brace";
    if (impact.kind === "shield-loss" || impact.kind === "dispel") return "shield-break";
    if (impact.kind === "heal") return "second-wind";
    if (impact.kind === "revive" || impact.kind === "revive-pending") return "revive";
    if (impact.kind === "skip-turn" || impact.kind === "turn-delay" || impact.kind === "dice-penalty") return "forced-skip";
    if (impact.kind === "turn-advance") return "enter";
    if (impact.kind === "card-steal" || impact.kind === "card-purge") return "hurt";
    if (impact.kind === "attack-buff" || impact.kind === "dice-buff") return "cast";
    if (impact.kind === "none") return "idle";
  }
  if (!outcome?.success || !card) return "idle";
  if (outcome.defeated) return "defeat";
  if (card.effect === "damage" || card.effect === "aoe") return "shield-hit";
  if (card.effect === "guard" || card.supportType === "shield") return "brace";
  if (card.effect === "heal" || card.supportType === "healing") return "second-wind";
  if (card.supportType === "revive") return "revive";
  if (card.supportType === "dispel-enemy") return "shield-break";
  if (card.supportType === "skip-enemy" || card.supportType === "enemy-dice") return "forced-skip";
  if (card.supportType === "advance-ally") return "enter";
  if (card.supportType === "steal-card" || card.supportType === "purge-card") return "hurt";
  return "cast";
}

function vfxFallbackId(card?: ActionCard, outcome?: GameOutcome | null) {
  if (outcome?.kind && outcome.kind !== "card") return `shared.${outcome.kind}`;
  const supportFallback: Partial<Record<NonNullable<ActionCard["supportType"]>, string>> = {
    shield: "shield-gain",
    attack: "attack-buff",
    "enemy-dice": "dice-penalty",
    healing: "heal",
    "steal-card": "card-steal",
    "skip-enemy": "turn-skip",
    "delay-enemy": "turn-skip",
    "dispel-enemy": "dispel",
    dice: "dice-buff",
    "purge-card": "card-purge",
    "advance-ally": "turn-advance",
    revive: "revive"
  };
  const effectFallback: Partial<Record<ActionCard["effect"], string>> = {
    damage: "damage",
    aoe: "damage",
    heal: "heal",
    guard: "shield-gain",
    support: "support",
    none: "no-effect"
  };
  if (card?.supportType) return `shared.${supportFallback[card.supportType] ?? "support"}`;
  if (card?.effect) return `shared.${effectFallback[card.effect] ?? "neutral"}`;
  return "shared.neutral";
}

function impactVfxId(impact?: GameTargetImpact) {
  if (!impact) return undefined;
  if (impact.kind === "damage") return (impact.blocked ?? 0) > 0 ? "shared.shield-hit" : "shared.damage";
  const ids: Partial<Record<GameTargetImpact["kind"], string>> = {
    shield: "shared.shield-gain",
    "shield-loss": "shared.shield-loss",
    heal: "shared.heal",
    "attack-buff": "shared.attack-buff",
    "dice-buff": "shared.dice-buff",
    "dice-penalty": "shared.dice-penalty",
    "turn-advance": "shared.turn-advance",
    "turn-delay": "shared.turn-skip",
    "skip-turn": "shared.turn-skip",
    "revive-pending": "shared.revival-pending",
    revive: "shared.revive",
    dispel: "shared.dispel",
    "card-purge": "shared.card-purge",
    "card-steal": "shared.card-steal",
    none: "shared.no-effect"
  };
  return ids[impact.kind] ?? "shared.neutral";
}

function drawSyntheticFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  frames: number,
  color: string,
  variant: "character" | "vfx"
) {
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  const pulse = 1 + Math.sin(frame / Math.max(1, frames - 1) * Math.PI) * 0.12;
  context.save();
  context.translate(Math.round(width / 2), Math.round(height * 0.72));
  context.scale(pulse, pulse);
  context.fillStyle = color;
  if (variant === "vfx") {
    const radius = Math.max(5, Math.round((width * 0.12) + frame / Math.max(1, frames - 1) * width * 0.2));
    context.globalAlpha = 0.28 + (1 - frame / Math.max(1, frames - 1)) * 0.62;
    context.fillRect(-radius, -2, radius * 2, 4);
    context.fillRect(-2, -radius, 4, radius * 2);
    context.fillRect(-Math.round(radius * 0.7), -Math.round(radius * 0.7), 4, 4);
    context.fillRect(Math.round(radius * 0.7), -Math.round(radius * 0.7), 4, 4);
  } else {
    context.fillRect(-8, -25, 16, 19);
    context.fillRect(-6, -34, 12, 10);
    context.fillRect(-12, -22, 4, 19);
    context.fillRect(8, -22, 4, 19);
    context.fillRect(-7, -6, 5, 10);
    context.fillRect(2, -6, 5, 10);
  }
  context.restore();
}

function PixelClip({
  resolved,
  delayMs = 0,
  color = "#d4b56e",
  variant = "character",
  className = ""
}: {
  resolved: ReturnType<typeof resolveClip>;
  delayMs?: number;
  color?: string;
  variant?: "character" | "vfx";
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const { clip } = resolved;
    const columns = Math.max(1, clip.columns ?? clip.frames);
    const rows = Math.max(1, Math.ceil(clip.frames / columns));
    const duration = clipDuration(clip);
    const cachedImage = clip.src ? loadPixelImage(clip.src) : null;
    const image = cachedImage?.image;
    let imageReady = Boolean(image?.complete && image.naturalWidth);
    let stopped = false;
    let animationFrame = 0;
    let startedAt = 0;

    canvas.width = clip.frameWidth;
    canvas.height = clip.frameHeight;
    void cachedImage?.ready.then(() => {
      imageReady = Boolean(image?.naturalWidth);
    });

    const draw = (timestamp: number) => {
      if (stopped) return;
      if (!startedAt) startedAt = timestamp + delayMs;
      if (timestamp < startedAt) {
        context.clearRect(0, 0, clip.frameWidth, clip.frameHeight);
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      const elapsed = Math.max(0, timestamp - startedAt);
      const normalizedElapsed = clip.loop ? elapsed % duration : Math.min(elapsed, duration);
      const frame = Math.min(clip.frames - 1, Math.floor(normalizedElapsed / 1000 * clip.fps));
      context.clearRect(0, 0, clip.frameWidth, clip.frameHeight);
      context.imageSmoothingEnabled = false;
      if (imageReady && image && image.naturalWidth >= clip.frameWidth && image.naturalHeight >= clip.frameHeight) {
        const column = frame % columns;
        const row = Math.min(rows - 1, Math.floor(frame / columns));
        context.drawImage(
          image,
          column * clip.frameWidth,
          row * clip.frameHeight,
          clip.frameWidth,
          clip.frameHeight,
          0,
          0,
          clip.frameWidth,
          clip.frameHeight
        );
      } else {
        drawSyntheticFrame(context, clip.frameWidth, clip.frameHeight, frame, clip.frames, color, variant);
      }
      if (clip.loop || elapsed < duration) animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [resolved.id, resolved.clip, delayMs, color, variant]);

  return <canvas className={`pixel-animation-clip ${className}`} ref={canvasRef} data-animation-id={resolved.id} aria-hidden="true"/>;
}

function CharacterUnit({
  player,
  animation,
  delayMs,
  impactClip,
  target = false
}: {
  player: PlayerSession;
  animation: string;
  delayMs: number;
  impactClip?: ReturnType<typeof resolveClip>;
  target?: boolean;
}) {
  const heroSlug = slugify(player.hero.name);
  const resolved = resolveClip(
    `character.${heroSlug}.${animation}`,
    `character.${heroSlug}.idle`,
    "shared.neutral"
  );
  return <div className={`pixel-character-unit ${target ? "target" : "actor"}`}>
    <PixelClip resolved={resolved} delayMs={delayMs} color={player.hero.color} className="pixel-character-sprite"/>
    {impactClip && <PixelClip resolved={impactClip} delayMs={delayMs + 80} color={player.hero.color} variant="vfx" className="pixel-impact-sprite"/>}
    <span style={{ "--pixel-hero-color": player.hero.color } as React.CSSProperties}>{player.displayName}</span>
  </div>;
}

export function PixelBattleStage({
  sequenceKey,
  actor,
  targets = [],
  card,
  outcome,
  mode = "action",
  worldTitle,
  verdict = "complete",
  impacts,
  onAnimationComplete
}: PixelBattleStageProps) {
  const stageTargets = targets.slice(0, mode === "world" ? 10 : 5);
  const actorMove = mode === "result"
    ? verdict === "victory" ? "victory" : verdict === "defeat" ? "defeat" : "idle"
    : mode === "world" ? "hurt" : actionAnimation(card, outcome);
  const resolvedImpacts = impacts ?? outcome?.impacts ?? [];
  const actorImpact = actor ? resolvedImpacts.find((impact) => impact.targetId === actor.id) : undefined;
  const shownTargetImpacts = stageTargets.map((player) => resolvedImpacts.find((impact) => impact.targetId === player.id));
  const targetMoves = stageTargets.map((player, index) => mode === "result"
    ? verdict === "victory" ? "defeat" : verdict === "defeat" ? "victory" : "idle"
    : targetAnimation(card, outcome, shownTargetImpacts[index]));
  const actorClip = actor ? resolveClip(`character.${slugify(actor.hero.name)}.${actorMove}`, `character.${slugify(actor.hero.name)}.idle`) : resolveClip("shared.neutral");
  const actorImpactClip = impactVfxId(actorImpact) ? resolveClip(impactVfxId(actorImpact), "shared.neutral") : undefined;
  const targetClips = stageTargets.map((player, index) => resolveClip(`character.${slugify(player.hero.name)}.${targetMoves[index]}`, `character.${slugify(player.hero.name)}.idle`));
  const targetImpactClips = shownTargetImpacts.map((impact) => impactVfxId(impact) ? resolveClip(impactVfxId(impact), "shared.neutral") : undefined);
  const effectClip = mode === "result"
    ? resolveClip(verdict === "complete" ? "shared.neutral" : `result.${verdict}`, "shared.neutral")
    : mode === "world"
      ? resolveClip(`world.${slugify(worldTitle)}`, "shared.world", "shared.neutral")
      : outcome?.kind && outcome.kind !== "card"
        ? resolveClip(`shared.${outcome.kind}`, "shared.neutral")
        : resolveClip(
            normalizedCardId(card, outcome) ? `card.${normalizedCardId(card, outcome)}.${outcome?.success === false ? "failure" : "success"}` : undefined,
            vfxFallbackId(card, outcome),
            "shared.neutral"
          );
  const sequenceDuration = useMemo(() => Math.max(
    mode === "world" ? 3600 : mode === "result" ? 3200 : 2800,
    clipDuration(actorClip.clip),
    80 + (actorImpactClip ? clipDuration(actorImpactClip.clip) : 0),
    420 + clipDuration(effectClip.clip),
    800 + Math.max(0, ...targetClips.map(({ clip }) => clipDuration(clip))),
    880 + Math.max(0, ...targetImpactClips.map((resolved) => resolved ? clipDuration(resolved.clip) : 0))
  ) + 120, [mode, actorClip.clip, actorImpactClip, effectClip.clip, targetClips, targetImpactClips]);
  const [assetsReady, setAssetsReady] = useState(false);
  const completionRef = useRef(onAnimationComplete);
  completionRef.current = onAnimationComplete;

  useEffect(() => {
    let active = true;
    setAssetsReady(false);
    const sources = [...new Set([
      actorClip.clip.src,
      actorImpactClip?.clip.src,
      effectClip.clip.src,
      ...targetClips.map(({ clip }) => clip.src),
      ...targetImpactClips.map((resolved) => resolved?.clip.src)
    ].filter((src): src is string => Boolean(src)))];
    const loadAssets = Promise.all(sources.map((src) => loadPixelImage(src).ready));
    const fallbackTimer = window.setTimeout(() => {
      if (active) setAssetsReady(true);
    }, 6000);
    void loadAssets.then(() => {
      if (!active) return;
      window.clearTimeout(fallbackTimer);
      setAssetsReady(true);
    });
    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
    };
  }, [sequenceKey]);

  useEffect(() => {
    if (!assetsReady) return;
    let startedAt: number | null = null;
    let animationFrame = 0;
    const finishAfterRenderedSequence = (timestamp: number) => {
      startedAt ??= timestamp;
      if (timestamp - startedAt >= sequenceDuration) {
        completionRef.current();
        return;
      }
      animationFrame = window.requestAnimationFrame(finishAfterRenderedSequence);
    };
    animationFrame = window.requestAnimationFrame(finishAfterRenderedSequence);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [sequenceKey, sequenceDuration, assetsReady]);

  const shownTargets = stageTargets;
  const hiddenTargetCount = Math.max(0, targets.length - stageTargets.length);
  const label = mode === "result"
    ? verdict === "victory" ? "Victory animation" : verdict === "defeat" ? "Defeat animation" : "Battle judgment animation"
    : mode === "world"
      ? `${worldTitle ?? "World event"} animation`
      : `${card?.name ?? outcome?.label ?? "Turn"} animation`;
  const isFailureStage = outcome?.success === false || (mode === "result" && verdict === "defeat");

  return <section
    className={`pixel-battle-stage ${mode} ${isFailureStage ? "failure" : "success"}`}
    aria-label={label}
    data-sequence-key={sequenceKey}
    style={{ "--pixel-stage-duration": `${sequenceDuration}ms` } as React.CSSProperties}
  >
    <div className="pixel-stage-heading">
      <span>{mode === "world" ? "BATTLEFIELD VFX" : mode === "result" ? "FINAL BATTLE VFX" : "ACTION VFX"}</span>
      <strong>{mode === "result" ? verdict : card?.name ?? outcome?.kind?.replace("-", " ") ?? worldTitle}</strong>
    </div>
    <div className="pixel-stage-field">
      <i className="pixel-stage-ground" aria-hidden="true"/>
      {assetsReady ? <>
        {actor
          ? <CharacterUnit player={actor} animation={actorMove} delayMs={0} impactClip={actorImpactClip}/>
          : <div className="pixel-stage-empty-side" aria-hidden="true"/>}
        <div className="pixel-vfx-layer">
          <PixelClip resolved={effectClip} delayMs={420} variant="vfx" color={outcome?.success === false ? "#e56f60" : "#e7b95f"} className="pixel-vfx-sprite"/>
        </div>
        <div className={`pixel-target-party count-${Math.min(10, shownTargets.length)}`}>
          {shownTargets.map((player, index) => <CharacterUnit player={player} animation={targetMoves[index]} delayMs={800} impactClip={targetImpactClips[index]} target key={player.id}/>)}
          {hiddenTargetCount > 0 && <span className="pixel-extra-targets">+{hiddenTargetCount}</span>}
        </div>
      </> : <div className="pixel-stage-loading" role="status"><i/><span>Preparing pixel VFX...</span></div>}
    </div>
    <div className={`pixel-stage-timeline ${assetsReady ? "playing" : "loading"}`} aria-hidden="true"><i/></div>
  </section>;
}
