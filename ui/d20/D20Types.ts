export type D20AnimationState =
  | "idle"
  | "spawning"
  | "throwing"
  | "completed"
  | "cancelled"
  | "error";

export type D20RollInput = {
  rawResult: number;
  modifier: number;
  finalResult: number;
};

export type D20RollOutput = D20RollInput;

export type D20Quality = "high" | "low";
