"use client";

import { Fragment, type ReactNode } from "react";

type Props = {
  text?: string;
  cardNames: readonly string[];
  onInspectCard?: (name: string) => void;
  renderRemainder?: (text: string) => ReactNode;
};

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function HighlightCardNames({ text = "", cardNames, onInspectCard, renderRemainder }: Props) {
  const cardByName = new Map<string, string>();
  for (const name of cardNames) {
    const normalized = name.trim();
    if (normalized) cardByName.set(normalized.toLocaleLowerCase(), normalized);
  }
  const names = [...cardByName.values()].sort((left, right) => right.length - left.length);
  const renderPlainText = (value: string) => renderRemainder ? renderRemainder(value) : value;
  if (!text || !names.length) return <>{renderPlainText(text)}</>;

  const parts = text.split(new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(escapePattern).join("|")})(?![\\p{L}\\p{N}])`, "giu"));
  return <>{parts.map((part, index) => {
    const cardName = cardByName.get(part.toLocaleLowerCase());
    return cardName && onInspectCard
      ? <button type="button" className="history-card-link" title={`View ${cardName}`} aria-label={`View ${cardName} card`} onClick={() => onInspectCard(cardName)} key={`${part}-${index}`}>{part}</button>
      : <Fragment key={`${part}-${index}`}>{renderPlainText(part)}</Fragment>;
  })}</>;
}
