type AnchorRect = Pick<DOMRect, "left" | "right" | "top" | "height">;
type TooltipRect = Pick<DOMRect, "width" | "height">;

type CardAnchorRect = Pick<DOMRect, "left" | "right" | "top" | "width" | "height">;

export function fitTooltipToViewport(
  anchor: AnchorRect,
  tooltip: TooltipRect,
  viewport: { width: number; height: number },
  gutter = 12,
  offset = 9
) {
  const fitsRight = anchor.right + offset + tooltip.width <= viewport.width - gutter;
  const fitsLeft = anchor.left - offset - tooltip.width >= gutter;
  const placement: "left" | "right" = fitsRight || !fitsLeft ? "right" : "left";
  const preferredLeft = placement === "right" ? anchor.right + offset : anchor.left - tooltip.width - offset;
  const left = Math.min(Math.max(gutter, preferredLeft), Math.max(gutter, viewport.width - tooltip.width - gutter));
  const preferredTop = anchor.top + anchor.height / 2 - tooltip.height / 2;
  const top = Math.min(Math.max(gutter, preferredTop), Math.max(gutter, viewport.height - tooltip.height - gutter));
  return { left, placement, top };
}

export function fitCardTooltipToViewport(
  anchor: CardAnchorRect,
  tooltip: TooltipRect,
  viewport: { width: number; height: number },
  placement: "top" | "right" = "top",
  gutter = 12,
  offset = 14
) {
  const maxLeft = Math.max(gutter, viewport.width - tooltip.width - gutter);
  const maxTop = Math.max(gutter, viewport.height - tooltip.height - gutter);
  const clampLeft = (left: number) => Math.min(Math.max(gutter, left), maxLeft);
  const clampTop = (top: number) => Math.min(Math.max(gutter, top), maxTop);

  if (placement === "right") {
    return {
      left: clampLeft(anchor.right + offset),
      top: clampTop(anchor.top + anchor.height / 2 - tooltip.height / 2),
    };
  }

  return {
    left: clampLeft(anchor.left + anchor.width / 2 - tooltip.width / 2),
    top: clampTop(anchor.top - tooltip.height - offset),
  };
}
