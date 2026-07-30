import type { GameHistoryEntry, GameOutcome, PlayerLifeEvent, PlayerRunState, PlayerSession, SyncedGameState } from "./types";

export type ViewerRelation = "self" | "ally" | "enemy" | "neutral";
export type ViewpointTextOptions = { involvedPlayerIds?: string[]; emphasizedPlayerIds?: string[]; pronounPlayerId?: string };
export type OutcomePresentation = { category: string; title: string; detail: string; involvedPlayerIds: string[] };
export type HistoryPresentation = { type: string; actor: string; target: string; card: string; result: string; changes: string; penalty: string; duration: string; details: string; involvedPlayerIds: string[] };
export type LifeEventPresentation = { category: string; title: string; detail: string };
export type StatusPresentation = {
  kind: "shield" | "attackBuff" | "diceBuff" | "dicePenalty" | "zeroPity" | "skipTurns" | "revive" | "borrowedCards" | "purgedCards";
  label: string;
  displayValue: string;
  value: string;
  duration: string;
  tooltip: string;
  negative?: boolean;
  shield?: boolean;
};

export function viewerRelation(player?: PlayerSession | null, viewer?: PlayerSession | null): ViewerRelation;
export function playerReference(player?: PlayerSession | null, viewer?: PlayerSession | null, options?: { possessive?: boolean; includeRelation?: boolean; capitalize?: boolean }): string;
export function formatViewpointText(text: string, players: PlayerSession[], viewerId?: string, options?: ViewpointTextOptions): string;
export function formatOutcomePresentation(outcome: GameOutcome, players: PlayerSession[], viewerId?: string): OutcomePresentation;
export function formatHistoryPresentation(entry: GameHistoryEntry, players: PlayerSession[], viewerId?: string): HistoryPresentation;
export function formatLifeEventPresentation(event: PlayerLifeEvent, players: PlayerSession[], viewerId?: string): LifeEventPresentation;
export function getStatusPresentations(player: PlayerSession, state: PlayerRunState, players: PlayerSession[], viewerId?: string, currentPhase?: number): StatusPresentation[];
export function sanitizeCommunicationGame(game: SyncedGameState | null, players: PlayerSession[], viewerId?: string): SyncedGameState | null;
