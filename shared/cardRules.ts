import type { ActionCard } from "./types";

const effectLabels: Record<ActionCard["effect"], string> = {
  damage: "Tấn công đơn",
  aoe: "Tấn công diện rộng",
  heal: "Hồi máu đồng minh",
  guard: "Tạo khiên cho đồng minh",
  support: "Hỗ trợ đồng đội"
};

const targetLabels: Record<ActionCard["target"], string> = {
  self: "Bản thân",
  ally: "Một đồng minh",
  "all-allies": "Toàn bộ đồng minh còn sống",
  enemy: "Một đối thủ còn sống",
  "all-enemies": "Toàn bộ đối thủ còn sống"
};

export function getCardEffectLabel(card: ActionCard) {
  if (card.effect === "heal" && card.target === "self") return "Tự hồi máu";
  if (card.effect === "guard" && card.target === "self") return "Tự tạo khiên";
  return effectLabels[card.effect];
}

export function getCardTargetLabel(card: ActionCard) {
  return targetLabels[card.target];
}

export function describeCardImpact(card: ActionCard) {
  const failure = card.failureEffect && card.failureValue ? ` Thất bại: ${card.failureEffect === "self-damage" ? `người dùng chịu ${card.failureValue} sát thương` : card.failureEffect === "team-damage" ? `toàn đội chịu ${card.failureValue} sát thương` : card.failureEffect === "lose-shield" ? `người dùng mất tối đa ${card.failureValue} khiên` : `mỗi đối thủ nhận ${card.failureValue} khiên`}.` : "";
  if (card.effect === "damage") return `Thành công: gây ${card.value} sát thương lên ${targetLabels[card.target].toLowerCase()}; khiên chặn trước HP${card.ignoresShield ? ", nhưng lá này xuyên khiên" : ""}.${failure}`;
  if (card.effect === "aoe") return `Thành công: mỗi đối thủ còn sống chịu ${card.value} sát thương${card.ignoresShield ? " xuyên khiên" : "; khiên chặn trước HP"}.${failure}`;
  if (card.effect === "heal") return card.target === "self" ? `Thành công: tự hồi tối đa ${card.value} HP; không thể hồi sinh.${failure}` : `Thành công: chọn một đồng minh còn sống (có thể chọn bản thân) để hồi tối đa ${card.value} HP; không thể hồi sinh.${failure}`;
  if (card.effect === "guard") return card.target === "self" ? `Thành công: tự nhận ${card.value} khiên.${failure}` : `Thành công: chọn một đồng minh còn sống (có thể chọn bản thân) để nhận ${card.value} khiên.${failure}`;
  if (card.supportType === "healing") return `Thành công: mọi đồng minh còn sống hồi tối đa ${card.value} HP ngay lập tức.`;
  if (card.supportType === "shield") return `Thành công: mọi đồng minh còn sống nhận ${card.value} khiên ngay lập tức.`;
  if (card.supportType === "enemy-dice") return `Thành công: kẻ địch được chọn bị -${card.value} kết quả d20 trong lượt kế tiếp.`;
  if (card.supportType === "delay-enemy") return "Thành công: đẩy lượt sắp tới của kẻ địch được chọn xuống cuối hàng đợi.";
  if (card.supportType === "advance-ally") return "Thành công: đưa lượt của đồng minh được chọn lên ngay kế tiếp.";
  if (card.supportType === "dispel-enemy") return `Thành công: xóa buff tấn công/d20 và phá tối đa ${card.value} khiên của kẻ địch được chọn.`;
  const buff = card.supportType === "attack" ? "sát thương của đòn đánh kế tiếp" : "bonus d20 trong lượt kế tiếp";
  return `Thành công: mọi đồng minh còn sống nhận +${card.value} ${buff}; buff được giữ cho đến khi dùng.`;
}
