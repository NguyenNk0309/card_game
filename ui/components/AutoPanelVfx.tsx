export type AutoPanelVfxVariant =
  | "action-success"
  | "action-failure"
  | "action-skip"
  | "action-discard"
  | "action-neutral"
  | "summary-success"
  | "summary-failure"
  | "summary-skip"
  | "summary-discard"
  | "summary-neutral"
  | "life-revive"
  | "life-defeat"
  | "world-pending"
  | "world-resolved"
  | "battle-victory"
  | "battle-defeat"
  | "battle-complete";

export function AutoPanelVfx({ variant }: { variant: AutoPanelVfxVariant }) {
  return <div className={`auto-panel-vfx auto-panel-vfx-${variant}`} data-auto-panel-vfx={variant} aria-hidden="true">
    <span className="auto-panel-vfx-flash"/>
    <span className="auto-panel-vfx-frame"/>
    <span className="auto-panel-vfx-orbit orbit-outer"/>
    <span className="auto-panel-vfx-orbit orbit-inner"/>
    <span className="auto-panel-vfx-particles">
      <i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/>
    </span>
  </div>;
}
