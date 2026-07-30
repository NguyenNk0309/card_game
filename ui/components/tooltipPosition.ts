type AnchorRect = Pick<DOMRect, "right" | "top" | "height">;
type TooltipRect = Pick<DOMRect, "width" | "height">;

export function fitTooltipToViewport(
  anchor: AnchorRect,
  tooltip: TooltipRect,
  viewport: { width: number; height: number },
  gutter = 12,
  offset = 9
) {
  const preferredLeft = anchor.right + offset;
  const left = Math.min(Math.max(gutter, preferredLeft), Math.max(gutter, viewport.width - tooltip.width - gutter));
  const preferredTop = anchor.top + anchor.height / 2 - tooltip.height / 2;
  const top = Math.min(Math.max(gutter, preferredTop), Math.max(gutter, viewport.height - tooltip.height - gutter));
  return { left, top };
}
