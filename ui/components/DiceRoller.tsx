"use client";

import { Dices, Sparkles } from "lucide-react";

export function DiceRoller({
  roll,
  rolling,
  target,
  bonus,
  onRoll,
  disabled = false,
  disabledLabel = "Waiting for your turn"
}: {
  roll: number | null;
  rolling: boolean;
  target: number;
  bonus: number;
  onRoll: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <section className="dice-panel">
      <div className={`d20 ${rolling ? "rolling" : ""}`}>
        <span>{roll ?? "20"}</span>
      </div>
      <div className="dice-copy">
        <span className="eyebrow">PARTY CHECK</span>
        <strong>Target {target}</strong>
        <small>d20 + {bonus} card bonus</small>
      </div>
      <button className="roll-button" onClick={onRoll} disabled={rolling || disabled}>
        {rolling ? <Sparkles size={17} /> : <Dices size={18} />}
        {rolling ? "Casting…" : disabled ? disabledLabel : "Cast the die"}
      </button>
    </section>
  );
}
