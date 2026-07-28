import type { WorldEventIntensity, WorldEventKey } from "./types";

export type WorldEventDefinition = {
  key: Exclude<WorldEventKey, "legacy-world-event">;
  phase: number;
  level: number;
  intensity: WorldEventIntensity;
  title: string;
  interactive: boolean;
  shortDescription: string;
  description: string;
  fullDescription: string;
  metadata: Readonly<{ tone: string; icon: string; privacy: "public" | "private-cards" | "private-choice" }>;
};

export type WorldEventScheduleEntry = {
  phase: number;
  level: number;
  intensity: WorldEventIntensity;
  selection: "fixed" | "random";
  eventKeys: readonly WorldEventKey[];
};

export const WORLD_EVENT_DEFINITIONS: Readonly<Record<Exclude<WorldEventKey, "legacy-world-event">, WorldEventDefinition>>;
export const WORLD_EVENT_SCHEDULE: readonly WorldEventScheduleEntry[];
export const WORLD_EVENT_PHASES: readonly number[];
export function isWorldEventPhase(phase: number): boolean;
export function getWorldEventScheduleEntry(phase: number): WorldEventScheduleEntry | null;
export function getNextWorldEventPhase(phase: number): number | null;
export function getPreviousWorldEventPhase(phase: number): number | null;
export function getWorldEventDefinition(key: WorldEventKey | string): WorldEventDefinition | null;
export function getWorldEventsForPhase(phase: number): WorldEventDefinition[];
export function describeWorldEventScheduleEntry(entry: WorldEventScheduleEntry | null): string;
