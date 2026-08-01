import type { ActionCard } from "@/shared/types";

export type EffectTextSegment = {
  text: string;
  tone?: string;
};

function numberTone(text: string, index: number, length: number, card?: ActionCard) {
  const before = text.slice(Math.max(0, index - 28), index).toLowerCase();
  const after = text.slice(index + length, Math.min(text.length, index + length + 32)).toLowerCase();
  const context = `${before} ${after}`;
  if (/^\s*(damage|backlash)/.test(after)) return "damage";
  if (/^\s*shield/.test(after)) return "shield";
  if (/^\s*hp/.test(after)) {
    const restoresHealth = card?.effect === "heal"
      || card?.supportType === "healing"
      || card?.supportType === "revive"
      || /(restore|heal|revive|regain)/.test(context);
    return restoresHealth ? "heal" : "damage";
  }
  if (/^\s*(completed )?turn/.test(after) || /^\s*(speed|phase)/.test(after)) return "speed";
  if (/\bphase\s*$/.test(before)) return "speed";
  if (/(d20|dice|roll|result)/.test(context)) return "dice";
  if (/(restore|heal|revive|healing)/.test(context)) return "heal";
  if (card?.effect === "heal") return "heal";
  if (card?.effect === "guard" || card?.supportType === "shield") return "shield";
  if (card?.effect === "damage" || card?.effect === "aoe") return "damage";
  if (/shield/.test(context)) return "shield";
  if (/(damage|backlash|lose .*hp|lost .*hp|takes? .*hp)/.test(context)) return "damage";
  if (/(turn|speed|phase)/.test(context)) return "speed";
  if (/(card|use|deck|hand|draw|discard|graveyard)/.test(context)) return "cards";
  return "value";
}

export function getEffectTextSegments(text: string, card?: ActionCard): EffectTextSegment[] {
  const matches = [...text.matchAll(/(heavy attack card|shield card|heal card|[+-]?\d+(?:\/\d+)?|one-third|half)/gi)]
    .filter((match) => !(match[0] === "20" && text[(match.index ?? 0) - 1]?.toLowerCase() === "d"));
  if (!matches.length) return [{ text }];
  const parts: EffectTextSegment[] = [];
  let cursor = 0;
  matches.forEach((match) => {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });
    const phrase = match[0].toLowerCase();
    const tone = phrase === "heavy attack card" ? "damage"
      : phrase === "shield card" ? "shield"
      : phrase === "heal card" ? "heal"
      : numberTone(text, index, match[0].length, card);
    parts.push({ text: match[0], tone });
    cursor = index + match[0].length;
  });
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function EffectText({ text, card }: { text: string; card?: ActionCard }) {
  return <>{getEffectTextSegments(text, card).map((part, index) => part.tone
    ? <strong className={`effect-number ${part.tone}`} key={`${index}-${part.text}`}>{part.text}</strong>
    : part.text)}</>;
}
