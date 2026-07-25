"use client";
import { Dices, Sparkles } from "lucide-react";

export function DiceRoller({ roll, rolling, target, passiveBonus = 0, diceBuff = 0, dicePenalty = 0, onRoll, disabled = false, disabledLabel = "Waiting for your turn" }: { roll: number | null; rolling: boolean; target: number; passiveBonus?: number; diceBuff?: number; dicePenalty?: number; onRoll: () => void; disabled?: boolean; disabledLabel?: string; }) {
  const modifier = passiveBonus + diceBuff - dicePenalty;
  return <section className="dice-panel"><div className={`d20 ${rolling ? "rolling" : ""}`}><span>{roll ?? "20"}</span></div><div className="dice-copy"><span className="eyebrow">ACTION CHECK</span><strong>Target {target}</strong><small>d20{passiveBonus ? ` + ${passiveBonus} class passive` : ""}{diceBuff ? ` + ${diceBuff} active card buff` : ""}{dicePenalty ? ` - ${dicePenalty} enemy effect` : ""}</small><em>No card has a built-in roll bonus. Total modifier: {modifier >= 0 ? "+" : ""}{modifier}.</em></div><button className="roll-button" onClick={onRoll} disabled={rolling || disabled}>{rolling ? <Sparkles size={17}/> : <Dices size={18}/>} {rolling ? "Rolling..." : disabled ? disabledLabel : "Roll the die"}</button></section>;
}
