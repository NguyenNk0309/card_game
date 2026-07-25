"use client";
import { Dices, Sparkles } from "lucide-react";
export function DiceRoller({ roll, rolling, target, bonus, diceBuff = 0, dicePenalty = 0, onRoll, disabled = false, disabledLabel = "Đang chờ lượt của bạn" }: { roll: number | null; rolling: boolean; target: number; bonus: number; diceBuff?: number; dicePenalty?: number; onRoll: () => void; disabled?: boolean; disabledLabel?: string; }) {
  const modifier = bonus + diceBuff - dicePenalty;
  return <section className="dice-panel"><div className={`d20 ${rolling ? "rolling" : ""}`}><span>{roll ?? "20"}</span></div><div className="dice-copy"><span className="eyebrow">KIỂM TRA HÀNH ĐỘNG</span><strong>Mục tiêu {target}</strong><small>d20 + {bonus} điểm lá bài{diceBuff ? ` + ${diceBuff} buff đồng minh` : ""}{dicePenalty ? ` - ${dicePenalty} hiệu ứng địch` : ""}</small><em>Tổng điều chỉnh lượt này: {modifier >= 0 ? "+" : ""}{modifier}. Mặt d20 trở thành mục tiêu lượt kế.</em></div><button className="roll-button" onClick={onRoll} disabled={rolling || disabled}>{rolling ? <Sparkles size={17}/> : <Dices size={18}/>} {rolling ? "Đang đổ…" : disabled ? disabledLabel : "Đổ xúc xắc"}</button></section>;
}
