"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { memo, useState } from "react";
import type { Hero } from "@/shared/types";

const CHARACTER_AVATARS: Record<string, string> = {
  "Elara Voss": "/art/characters/elara-voss.webp",
  "Thorne Vale": "/art/characters/thorne-vale.webp",
  "Mira Ash": "/art/characters/mira-ash.webp",
  "Brother Orren": "/art/characters/brother-orren.webp",
  "Liora Venn": "/art/characters/liora-venn.webp",
  "Nyx Calder": "/art/characters/nyx-calder.webp",
  "Bram Coalhand": "/art/characters/bram-coalhand.webp",
  "Sable Fen": "/art/characters/sable-fen.webp",
  "Kael Rook": "/art/characters/kael-rook.webp",
  "Ione Mire": "/art/characters/ione-mire.webp",
  "Dagan Flint": "/art/characters/dagan-flint.webp"
};

const preloadedCharacterAvatars = new Map<string, HTMLImageElement>();

export function preloadCharacterAvatars(heroes: readonly Pick<Hero, "name">[], priority: "high" | "low" = "low") {
  if (typeof window === "undefined") return;
  for (const hero of heroes) {
    const source = CHARACTER_AVATARS[hero.name];
    if (!source) continue;
    const existing = preloadedCharacterAvatars.get(source);
    if (existing) {
      if (priority === "high") existing.fetchPriority = "high";
      continue;
    }
    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.src = source;
    preloadedCharacterAvatars.set(source, image);
    void image.decode().catch(() => undefined);
  }
}

type CharacterAvatarProps = {
  hero: Pick<Hero, "name" | "initials" | "color">;
  className?: string;
  loading?: "eager" | "lazy";
  sizes?: string;
};

export const CharacterAvatar = memo(function CharacterAvatar({ hero, className = "portrait", loading = "lazy", sizes = "66px" }: CharacterAvatarProps) {
  const avatar = CHARACTER_AVATARS[hero.name];
  const [failedSource, setFailedSource] = useState("");
  const showImage = Boolean(avatar && failedSource !== avatar);
  return <span className={`character-avatar ${className} ${showImage ? "has-image" : "has-fallback"}`} style={{ "--hero-color": hero.color } as CSSProperties}>
    {showImage && <span className="avatar-loading-shimmer" aria-hidden="true"/>}
    {showImage ? <span className="avatar-image-motion"><Image className="character-avatar-image" src={avatar} alt="" fill sizes={sizes} loading={loading} fetchPriority={loading === "eager" ? "high" : "auto"} onError={() => setFailedSource(avatar)}/></span> : <span className="avatar-fallback">{hero.initials}</span>}
  </span>;
}, (previous, next) => previous.hero.name === next.hero.name
  && previous.hero.initials === next.hero.initials
  && previous.hero.color === next.hero.color
  && previous.className === next.className
  && previous.loading === next.loading
  && previous.sizes === next.sizes);
