import Image from "next/image";
import type { CSSProperties } from "react";
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

export function CharacterAvatar({ hero, className = "portrait", sizes = "66px" }: {
  hero: Pick<Hero, "name" | "initials" | "color">;
  className?: string;
  sizes?: string;
}) {
  const avatar = CHARACTER_AVATARS[hero.name];
  return <span className={`character-avatar ${className}`} style={{ "--hero-color": hero.color } as CSSProperties}>
    {avatar ? <Image className="character-avatar-image" src={avatar} alt="" fill sizes={sizes}/> : hero.initials}
  </span>;
}
