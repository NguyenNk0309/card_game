"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ActionCard } from "@/shared/types";
import { EffectText, getEffectTextSegments } from "./EffectText";

type Props = {
  as?: "p" | "span";
  card?: ActionCard;
  className: string;
  maxLines: number;
  text: string;
};

const wordEndOffsets = (text: string) => {
  const offsets = [...text.matchAll(/\S+(?:\s+|$)/g)].map((match) => (match.index ?? 0) + match[0].length);
  return offsets.length ? offsets : [text.length];
};

function fillMeasurementNode(node: HTMLElement, text: string, card?: ActionCard) {
  node.replaceChildren();
  const content = document.createElement("span");
  for (const segment of getEffectTextSegments(text, card)) {
    if (!segment.tone) {
      content.append(document.createTextNode(segment.text));
      continue;
    }
    const highlight = document.createElement("strong");
    highlight.className = `effect-number ${segment.tone}`;
    highlight.textContent = segment.text;
    content.append(highlight);
  }
  node.append(content);
}

export function TruncatedEffectText({ as = "span", card, className, maxLines, text }: Props) {
  const Element = as;
  const nodeRef = useRef<HTMLElement | null>(null);
  const [visibleText, setVisibleText] = useState(text);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let frame = 0;

    const measure = () => {
      const width = node.getBoundingClientRect().width;
      const targetHeight = node.clientHeight;
      if (width <= 0 || targetHeight <= 0) return;

      const clone = node.cloneNode(false) as HTMLElement;
      clone.classList.add("card-copy-measure");
      clone.removeAttribute("aria-label");
      clone.removeAttribute("title");
      clone.style.width = `${width}px`;
      node.parentElement?.append(clone);

      const fits = (candidate: string) => {
        fillMeasurementNode(clone, candidate, card);
        return clone.scrollHeight <= targetHeight + 1;
      };

      if (fits(text)) {
        setVisibleText(text);
        clone.remove();
        return;
      }

      const offsets = wordEndOffsets(text);
      let low = 0;
      let high = offsets.length - 1;
      let best = "...";
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = `${text.slice(0, offsets[middle]).trimEnd()}...`;
        if (fits(candidate)) {
          best = candidate;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      setVisibleText(best);
      clone.remove();
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    void document.fonts?.ready.then(scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [card, maxLines, text]);

  return <Element
    ref={(node) => { nodeRef.current = node; }}
    className={className}
    data-max-lines={maxLines}
    aria-label={text}
    title={text}
  ><span aria-hidden="true"><EffectText text={visibleText} card={card}/></span></Element>;
}
