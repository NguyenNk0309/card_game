"use client";

import { Archive, AudioLines, Check, ChevronRight, CircleHelp, Clock3, Crown, Dices, Eye, Flame, Hand, Heart, History, Layers, ListOrdered, LogOut, Octagon, RefreshCw, Shield, SkipForward, Skull, Sparkles, Swords, Target, Trash2, Users, Volume2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, getPassiveDiceBonus, resolveCardTurn } from "@/backend/game/engine";
import { describeCardFailure, describeCardSuccess, getCardEffectLabel, getCardTargetLabel } from "@/shared/cardRules";
import type { ActionCard, GameHistoryEntry, PlayerSession, SyncedGameState, TeamId } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { CardEffectIcon } from "./components/CardEffectIcon";
import { useGameAudio } from "./hooks/useGameAudio";
import { useRoomSocket } from "./hooks/useRoomSocket";

const teamName: Record<TeamId, string> = { veil: "Veilbound", ember: "Embercourt" };
const typeName = { Might: "Might", Wit: "Wit", Spirit: "Spirit" } as const;
const worldEventLibrary = [
  { title: "Chaos Convergence", detail: "Every living player independently receives damage, healing, shield loss, attack power, or a volatile HP result." },
  { title: "Fractured Fate", detail: "The arena rolls a separate random effect for every living warrior; event level increases every five turns." },
  { title: "Crimson World Pulse", detail: "A battlefield pulse may wound or restore each living player and can alter shields or the next attack." },
  { title: "Unstable Arena Surge", detail: "Unstable energy affects both teams without preference, recording every individual result in Battle History." }
];

function CardOutcomeLines({ card }: { card: ActionCard }) {
  return <div className="card-outcome-lines"><p className="card-success-line"><Check size={13}/><span><b>SUCCESS</b>{describeCardSuccess(card)}</span></p><p className="card-failure-line"><X size={13}/><span><b>FAILURE</b>{describeCardFailure(card)}</span></p></div>;
}

function PublicDeck({ player }: { player: PlayerSession }) {
  return <div className="public-character-deck"><div className="public-deck-heading"><div><span className="eyebrow">PUBLIC CHARACTER DECK · <b className="player-name-highlight">{player.displayName}</b></span><strong>{player.hero.name} · 10 cards</strong></div><span>Speed {player.hero.speed}</span></div><div>{player.skillDeck.map((card) => <article key={card.id} className={`public-deck-card effect-${card.effect}`}><div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><div><span>{card.unique ? "Special" : "Common"} · {card.type}</span><strong>{card.name}</strong><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><p>{card.description}</p><CardOutcomeLines card={card}/></div></article>)}</div></div>;
}

function DetailedGuide({ onClose }: { onClose: () => void }) {
  return <div className="guide-update-backdrop"><section className="guide-update-panel"><button className="modal-close icon-button" onClick={onClose}><X size={18}/></button><span className="eyebrow">COMPLETE UPDATED GUIDE</span><h2>How to play Shattered Oath</h2><div className="guide-update-grid"><article><strong>1 · Build your warrior</strong><p>Players may choose the same character. Every public 10-card deck has 3 special cards, 2 common attacks, 1 common shield, 1 common heal, and 3 no-effect cards.</p></article><article><strong>2 · Speed sets each round</strong><p>Living players act from highest Speed to lowest. The expanded turn branch marks completed turns gray, highlights the active player, and leaves future turns pending. A new round resets the branch.</p></article><article><strong>3 · Play, discard, or skip</strong><p>Select one of your four private hand cards. Roll to resolve it, discard it to draw a random replacement and end your turn, or skip while preserving your full hand.</p></article><article><strong>4 · Random replacement draws</strong><p>Draw and discard piles retain a visible order for their owner, but every replacement is selected randomly from the available draw pile. An empty draw pile is replenished from discard first.</p></article><article><strong>5 · Beat the d20 target</strong><p>Targets range from 8 to 16. Active buffs, penalties, and matching passives modify the result. Failed common cards do nothing; failed special cards apply their printed backlash.</p></article><article><strong>6 · Effects and defeat</strong><p>Damage hits shield before HP unless it pierces. Healing cannot revive unless stated. Defeated players are gray and leave turn order. Sable can revive herself once at half HP.</p></article><article><strong>7 · World events</strong><p>A world event triggers every fifth completed turn. Use the event-library button beside the timer to review every possible event and its random effects.</p></article><article><strong>8 · Victory</strong><p>Eliminate the opposing team immediately, or lead on total HP after turn 30. Remaining living players, shield, and influence resolve ties.</p></article></div></section></div>;
}

function HighlightPlayerNames({ text = "", players }: { text?: string; players: PlayerSession[] }) {
  const playerByName = new Map(players.map((player) => [player.displayName.toLocaleLowerCase(), player]));
  const names = [...playerByName.keys()].sort((left, right) => right.length - left.length);
  if (!text || !names.length) return <>{text}</>;
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escapedNames.join("|")})`, "gi"));
  return <>{parts.map((part, index) => { const player = playerByName.get(part.toLocaleLowerCase()); return player ? <span className={`inline-player-name ${player.hero.team}`} key={`${part}-${index}`}>{part}</span> : part; })}</>;
}

function HistoryEntries({ entries, players, expanded = false }: { entries: GameHistoryEntry[]; players: PlayerSession[]; expanded?: boolean }) {
  return <div className={`history-list ${expanded ? "expanded-history-list" : ""}`}>{!entries.length && <p className="empty-history">No actions yet.</p>}{[...entries].reverse().map((entry) => <article className={`history-entry ${entry.kind} ${entry.success ? "success" : "failure"}`} key={entry.id}><span className={entry.kind === "world" ? "history-event-label" : ""}>{entry.kind === "world" && <Zap size={12}/>} {entry.kind === "world" ? `WORLD EVENT · TURN ${entry.turn}` : `Turn ${entry.turn}`}</span><strong className={`history-player-name ${entry.actorTeam ?? "world"} ${entry.actorTeam ? "player-name-highlight" : ""}`}>{entry.actorName}</strong><p><HighlightPlayerNames text={entry.message} players={players}/></p>{entry.diceRoll != null && <div className="history-dice"><span>d20: {entry.diceRoll}</span><span>Active/passive bonus: +{entry.diceBonus ?? 0}</span>{Boolean(entry.dicePenalty) && <span>Penalty: -{entry.dicePenalty}</span>}<strong>Total {entry.diceTotal} / target {entry.diceTarget}</strong></div>}</article>)}</div>;
}

function TurnOrderList({ players, game, order, expanded = false, onInspect }: { players: PlayerSession[]; game: SyncedGameState | null; order: PlayerSession[]; expanded?: boolean; onInspect: (id: string) => void }) {
  const activeId = order[0]?.id;
  const acted = new Set(game?.actedThisRound ?? []);
  const branchPlayers = expanded ? (game?.roundOrder ?? order.map((player) => player.id)).map((id) => players.find((player) => player.id === id)).filter((player): player is PlayerSession => Boolean(player)) : order.slice(0, 2);
  return <div className={`turn-queue-list ${expanded ? "expanded-turn-list turn-branch" : ""}`}>{branchPlayers.map((player) => { const status = player.id === activeId ? "current" : acted.has(player.id) ? "passed" : "future"; return <article className={`turn-queue-item ${status}`} aria-label={`${status}: ${player.displayName}`} key={player.id}>{!expanded && <b>{status === "current" ? "ACTIVE" : status === "passed" ? "PASSED" : "PENDING"}</b>}<button className="portrait-button" onClick={() => onInspect(player.id)} aria-label={`View ${player.displayName}'s character`}><div className="portrait mini" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>{player.hero.initials}</div></button><div className="turn-player-copy"><strong className="player-name-highlight">{player.displayName}</strong><span className="turn-player-meta">{player.hero.name} · Speed {player.hero.speed} · {teamName[player.hero.team]} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</span></div>{expanded && <i className="turn-branch-node" aria-hidden="true"/>}</article>; })}</div>;
}

function RunStatus({ completedTurns, secondsLeft, eventTurn, onEvents }: { completedTurns: number; secondsLeft: number; eventTurn?: number; onEvents: () => void }) {
  return <nav className="run-status" aria-label="Battle status"><div><span className="eyebrow">TURN</span><strong>{completedTurns} <i>/ 30</i></strong></div><div className="chapter-pips" aria-label="Thirty-turn timeline">{Array.from({ length: 30 }).map((_, index) => { const turn = index + 1; const phaseClass = index < completedTurns ? "complete" : index === completedTurns ? "current" : "future"; return <i key={turn} data-turn={turn} title={turn % 5 === 0 ? `Turn ${turn}: World Event` : `Turn ${turn}`} aria-label={turn % 5 === 0 ? `Turn ${turn}, World Event` : `Turn ${turn}`} className={`${phaseClass} ${turn % 5 === 0 ? "world-event-turn" : ""} ${eventTurn === turn ? "event-triggered" : ""}`}/>; })}</div><button className="world-event-library-button" onClick={onEvents}><Zap size={15}/><span>All world events</span></button><div className={`turn-clock ${secondsLeft <= 10 ? "urgent" : ""}`}><Clock3 size={14}/> {secondsLeft} seconds</div></nav>;
}

function CardZoneVfx({ motion }: { motion: { id: number; drawn?: ActionCard; discarded?: ActionCard } }) {
  return <div className="card-zone-vfx" aria-hidden="true">{motion.discarded && <div className={`card-motion hand-to-discard effect-${motion.discarded.effect}`}><span>Leaving hand</span><div className="card-sigil"><CardEffectIcon card={motion.discarded}/></div><strong>{motion.discarded.name}</strong><small>Moved to discard</small></div>}{motion.drawn && <div className={`card-motion draw-to-hand effect-${motion.drawn.effect}`}><span>Replacement card</span><div className="card-sigil"><CardEffectIcon card={motion.drawn}/></div><strong>{motion.drawn.name}</strong><small>Drawn into the same slot</small></div>}</div>;
}

export default function GameApp() {
  const { room, status, error: roomError, sessionId, serverTimeOffsetMs, send, clearError } = useRoomSocket();
  const { musicOn, volume, setVolume, toggleMusic, playEffect } = useGameAudio();
  const characterOptions = useMemo(() => getCharacterOptions(), []);
  const [playerName, setPlayerName] = useState("");
  const [selectedHeroName, setSelectedHeroName] = useState(characterOptions[0]?.hero.name ?? "");
  const [lobbyError, setLobbyError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lobbyAdventure] = useState(() => createAdventure("ARENA"));
  const [selectedCard, setSelectedCard] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [animatedRoll, setAnimatedRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dismissedOutcomeKey, setDismissedOutcomeKey] = useState("");
  const [dismissedSummaryKey, setDismissedSummaryKey] = useState("");
  const [dismissedVfxKey, setDismissedVfxKey] = useState("");
  const [dismissedWorldEventId, setDismissedWorldEventId] = useState("");
  const [deckReview, setDeckReview] = useState<"draw" | "discard" | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"history" | "turns" | "events" | null>(null);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [mobileParty, setMobileParty] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cardZoneMotion, setCardZoneMotion] = useState<{ id: number; drawn?: ActionCard; discarded?: ActionCard } | null>(null);
  const expirySentRef = useRef(0);
  const previousLocalZonesRef = useRef<{ playerId: string; hand: string[]; drawPile: string[]; discardPile: string[] } | null>(null);
  const outcomeSoundReadyRef = useRef(false);
  const lastOutcomeSoundKeyRef = useRef("");

  const { players, phase, game } = room;
  const adventure = game?.adventure ?? lobbyAdventure;
  const queuedActiveId = game?.turnOrder?.[0];
  const activePlayerIndex = queuedActiveId ? Math.max(0, players.findIndex((player) => player.id === queuedActiveId)) : game?.activePlayerIndex ?? 0;
  const activePlayer = players[activePlayerIndex];
  const activeState = activePlayer ? game?.playerStates[activePlayer.id] : undefined;
  const localPlayer = players.find((player) => player.id === sessionId);
  const localState = localPlayer ? game?.playerStates[localPlayer.id] : undefined;
  const cardCatalog = useMemo(() => players.flatMap((player) => player.skillDeck), [players]);
  const localHand = localState?.hand.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card)) ?? [];
  const activeCard = useMemo(() => localHand.find((card) => card.id === selectedCard) ?? localHand[0], [localHand, selectedCard]);
  const runComplete = phase === "game" && Boolean(game?.ended);
  const secondsLeft = game?.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - (now + serverTimeOffsetMs)) / 1000)) : 0;
  const passiveDiceBonus = localPlayer && activeCard && localState ? getPassiveDiceBonus(localPlayer, activeCard, localState) : 0;
  const outcome = game?.outcome ?? null;
  const outcomeKey = outcome ? `${game?.turnStartedAt ?? 0}-${outcome.label}` : "";
  const showOutcome = Boolean(outcome?.kind === "card" && outcome.actorName === localPlayer?.displayName && outcomeKey !== dismissedOutcomeKey && !runComplete);
  const showTurnSummary = Boolean(outcome?.actorName && outcome.actorName !== localPlayer?.displayName && outcomeKey !== dismissedSummaryKey && !runComplete);
  const vfxCard = outcome?.kind === "card" ? cardCatalog.find((card) => card.name === outcome.cardName) : undefined;
  const showBattleVfx = Boolean(vfxCard && outcomeKey !== dismissedVfxKey && !runComplete);
  const showWorldEvent = Boolean(game?.worldEvent && game.worldEvent.id !== dismissedWorldEventId && !runComplete);
  const inspectedPlayer = players.find((player) => player.id === inspectedPlayerId);
  const reviewedCardIds = deckReview === "draw" ? localState?.drawPile ?? [] : deckReview === "discard" ? localState?.discardPile ?? [] : [];
  const reviewedCards = reviewedCardIds.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card));
  const modalOpen = showGuide || Boolean(deckReview) || Boolean(expandedPanel) || Boolean(inspectedPlayer) || showOutcome || showTurnSummary || showWorldEvent || runComplete;
  const visibleTurnOrder = useMemo(() => {
    if (!game) return [];
    const living = players.filter((player) => (game.playerStates[player.id]?.hp ?? 0) > 0);
    const ids = game.turnOrder?.length
      ? game.turnOrder
      : [...players.slice(activePlayerIndex), ...players.slice(0, activePlayerIndex)].map((player) => player.id);
    return [...new Set([...ids, ...living.map((player) => player.id)])]
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player && (game.playerStates[player.id]?.hp ?? 0) > 0));
  }, [game, players, activePlayerIndex]);

  const targetOptions = activeCard && localPlayer ? players.filter((player) => {
    const hp = game?.playerStates[player.id]?.hp ?? player.hero.hp;
    if (activeCard.target === "defeated-ally") return player.hero.team === localPlayer.hero.team && hp <= 0 && !(game?.playerStates[player.id]?.reviveIn ?? 0);
    if (activeCard.target === "player") return true;
    if (hp <= 0) return false;
    if (activeCard.target === "enemy") return player.hero.team !== localPlayer.hero.team;
    if (activeCard.target === "ally") return player.hero.team === localPlayer.hero.team && (activeCard.supportType !== "advance-ally" || player.id !== localPlayer.id);
    return false;
  }) : [];

  const teamTotals = (team: TeamId) => {
    const members = players.filter((player) => player.hero.team === team);
    return {
      hp: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.hp ?? player.hero.hp), 0),
      maxHp: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.maxHp ?? player.hero.maxHp), 0),
      shield: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.shield ?? 0), 0),
      alive: members.filter((player) => (game?.playerStates[player.id]?.hp ?? player.hero.hp) > 0).length,
      total: members.length
    };
  };
  const veil = teamTotals("veil");
  const ember = teamTotals("ember");

  useEffect(() => { if (localHand[0]) setSelectedCard(localHand[0].id); }, [localPlayer?.id, game?.completedTurns]);
  useEffect(() => {
    if (!activeCard || !localPlayer) return;
    if (activeCard.target === "self" || activeCard.target === "all-allies" || activeCard.target === "all-enemies") setTargetPlayerId(localPlayer.id);
    else setTargetPlayerId(targetOptions[0]?.id ?? "");
  }, [activeCard?.id, localPlayer?.id, game?.completedTurns]);
  useEffect(() => { if (phase !== "game" || game?.ended) return; const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, [phase, game?.ended]);
  useEffect(() => {
    if (phase !== "game" || game?.ended || !game?.turnDeadline || secondsLeft > 0 || expirySentRef.current === game.turnDeadline) return;
    expirySentRef.current = game.turnDeadline;
    send({ type: "expire-turn" });
  }, [phase, game?.ended, game?.turnDeadline, secondsLeft, send]);
  useEffect(() => {
    if (!players.length || !localPlayer) return setSelectedPlayerId(null);
    if (!players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(localPlayer.id);
  }, [players, selectedPlayerId, localPlayer]);
  useEffect(() => {
    if (!showTurnSummary || !outcomeKey) return;
    const timer = window.setTimeout(() => setDismissedSummaryKey(outcomeKey), 3000);
    return () => window.clearTimeout(timer);
  }, [showTurnSummary, outcomeKey]);
  useEffect(() => {
    if (!showBattleVfx || !outcomeKey) return;
    const timer = window.setTimeout(() => setDismissedVfxKey(outcomeKey), 1400);
    return () => window.clearTimeout(timer);
  }, [showBattleVfx, outcomeKey]);
  useEffect(() => {
    if (!localPlayer || !localState) {
      previousLocalZonesRef.current = null;
      return;
    }
    const previous = previousLocalZonesRef.current;
    if (previous?.playerId === localPlayer.id) {
      const discardedId = previous.hand.find((id) => !localState.hand.includes(id) && localState.discardPile.includes(id));
      const drawnId = localState.hand.find((id) => !previous.hand.includes(id) && (previous.drawPile.includes(id) || previous.discardPile.includes(id)));
      const discarded = discardedId ? cardCatalog.find((card) => card.id === discardedId) : undefined;
      const drawn = drawnId ? cardCatalog.find((card) => card.id === drawnId) : undefined;
      if (discarded || drawn) setCardZoneMotion({ id: Date.now(), discarded, drawn });
    }
    previousLocalZonesRef.current = { playerId: localPlayer.id, hand: [...localState.hand], drawPile: [...localState.drawPile], discardPile: [...localState.discardPile] };
  }, [localPlayer, localState, cardCatalog]);
  useEffect(() => {
    if (!cardZoneMotion || modalOpen) return;
    const timer = window.setTimeout(() => setCardZoneMotion(null), 1850);
    return () => window.clearTimeout(timer);
  }, [cardZoneMotion, modalOpen]);
  useEffect(() => {
    if (!outcomeSoundReadyRef.current) {
      outcomeSoundReadyRef.current = true;
      lastOutcomeSoundKeyRef.current = outcomeKey;
      return;
    }
    if (!outcomeKey || lastOutcomeSoundKeyRef.current === outcomeKey) return;
    lastOutcomeSoundKeyRef.current = outcomeKey;
    if (outcome?.kind === "card") playEffect(outcome.success ? "success" : "fail");
  }, [outcomeKey, outcome?.kind, outcome?.success, playEffect]);

  const joinPlayer = () => {
    const name = playerName.trim();
    if (status !== "connected" || !sessionId) return setLobbyError("The shared room is still connecting. Please try again shortly.");
    if (localPlayer) return setLobbyError("This browser already controls one player.");
    if (players.length >= 10) return setLobbyError("The room already has 10 players.");
    if (!name) return setLobbyError("Enter a name before pressing Join.");
    if (players.some((player) => player.displayName.toLowerCase() === name.toLowerCase())) return setLobbyError("That name is already in use. Choose another name.");
    const veilCount = players.filter((player) => player.hero.team === "veil").length;
    const session = createPlayerSession(name, veilCount <= players.length - veilCount ? 0 : 1, selectedHeroName, sessionId);
    if (send({ type: "join", player: session })) { setSelectedPlayerId(session.id); setPlayerName(""); setLobbyError(""); }
  };
  const toggleReady = (id: string) => send({ type: "ready", sessionId: id, ready: !players.find((player) => player.id === id)?.ready });
  const leaveLobby = (id: string) => { send({ type: "leave", sessionId: id }); setSelectedPlayerId(null); setLobbyError(""); };
  const enterGame = () => {
    if (players.length < 2 || !players.every((player) => player.ready)) return setLobbyError("Every joined player must be ready before the battle starts.");
    send({ type: "start", game: createInitialGame(players, createAdventure(), 30) });
  };
  const castDie = () => {
    if (rolling || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    playEffect("roll");
    setRolling(true); let ticks = 0;
    const timer = window.setInterval(() => { setAnimatedRoll(Math.floor(Math.random() * 20) + 1); ticks += 1; if (ticks >= 9) { window.clearInterval(timer); const finalRoll = Math.floor(Math.random() * 20) + 1; if (send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, finalRoll) })) playEffect("play"); setAnimatedRoll(finalRoll); setRolling(false); } }, 85);
  };
  const skipTurn = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || runComplete || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    if (send({ type: "skip-turn", sessionId })) playEffect("skip");
  };
  const discardCard = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || status !== "connected" || rolling || (activeState?.hp ?? 0) <= 0) return;
    if (send({ type: "discard-card", sessionId, cardId: activeCard.id })) playEffect("discard");
  };
  const removePlayer = (targetSessionId: string) => {
    const target = players.find((player) => player.id === targetSessionId);
    if (!localPlayer || !target || targetSessionId === sessionId || !window.confirm(`Remove ${target.displayName} from the battle?`)) return;
    send({ type: "remove-player", sessionId, targetSessionId });
  };
  const inspectPlayer = (playerId: string) => {
    setDeckReview(null);
    setExpandedPanel(null);
    setInspectedPlayerId(playerId);
  };
  const closeModal = () => {
    if (showGuide) return setShowGuide(false);
    if (deckReview) return setDeckReview(null);
    if (expandedPanel) return setExpandedPanel(null);
    if (inspectedPlayer) return setInspectedPlayerId(null);
    if (showOutcome) return setDismissedOutcomeKey(outcomeKey);
    if (showTurnSummary) return setDismissedSummaryKey(outcomeKey);
    if (showWorldEvent && game?.worldEvent) setDismissedWorldEventId(game.worldEvent.id);
  };

  return <main className="game-shell arena-focus"><div className="grain"/>{showBattleVfx && vfxCard && <div className={`battle-card-vfx effect-${vfxCard.effect} ${outcome?.success ? "success" : "failure"}`} aria-hidden="true"><i/><i/><i/><div><CardEffectIcon card={vfxCard}/><strong>{vfxCard.name}</strong></div></div>}{cardZoneMotion && !modalOpen && <CardZoneVfx key={cardZoneMotion.id} motion={cardZoneMotion}/>} {phase === "game" && localPlayer && <button className="discard-card-button" onClick={discardCard} disabled={activePlayer?.id !== sessionId || status !== "connected" || runComplete || rolling || !activeCard || (activeState?.hp ?? 0) <= 0}><Trash2 size={19}/><span>Discard selected card</span><small>Draw replacement · End turn</small></button>}{inspectedPlayer && <aside className="inspected-deck-overlay"><PublicDeck player={inspectedPlayer}/></aside>}{showGuide && <DetailedGuide onClose={() => setShowGuide(false)}/>}
    <header className="topbar"><div className="brand"><div className="brand-mark"><Crown size={20}/></div><div><strong>SHATTERED OATH</strong><span>Two teams. One victor.</span></div></div>
      {phase === "game" ? <RunStatus completedTurns={game?.completedTurns ?? 0} secondsLeft={secondsLeft} eventTurn={game?.worldEvent?.turn} onEvents={() => setExpandedPanel("events")}/> : <div className="lobby-top-status"><Users size={16}/> {players.length}/10 players · {players.filter((player) => player.ready).length} ready</div>}
      <div className="top-actions"><div className="audio-controls"><button className={`icon-button music-toggle ${musicOn ? "playing" : ""}`} onClick={() => void toggleMusic()} aria-label={musicOn ? "Pause medieval music" : "Play medieval music"} title={musicOn ? "Pause medieval music" : "Play medieval music"}>{musicOn ? <Volume2 size={18}/> : <AudioLines size={18}/>}</button><label className="volume-control" title={`Audio volume ${volume}%`}><input type="range" min="0" max="100" value={volume} style={{ "--audio-volume": `${volume}%` } as React.CSSProperties} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Game audio volume"/><output>{volume}%</output></label></div><button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16}/> How to play</button>{phase === "game" && localPlayer && <button className="text-button leave-game-control" onClick={() => send({ type: "leave-game", sessionId })}><LogOut size={16}/> Leave battle</button>}{phase === "game" && localPlayer && !runComplete && <button className="text-button end-game-control" onClick={() => send({ type: "end-game", sessionId })}><Octagon size={16}/> End battle</button>}{phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open player list"><Users size={18}/></button>}</div>
    </header>
    {phase === "lobby" ? <Lobby players={players} playerName={playerName} error={lobbyError || roomError} selectedPlayerId={selectedPlayerId} localSessionId={sessionId} connectionStatus={status} characterOptions={characterOptions} selectedHeroName={selectedHeroName} onNameChange={(name) => { setPlayerName(name); setLobbyError(""); clearError(); }} onJoin={joinPlayer} onSelectPlayer={setSelectedPlayerId} onToggleReady={toggleReady} onLeave={leaveLobby} onRemovePlayer={removePlayer} onEnterGame={enterGame} onHeroSelect={(name) => { setSelectedHeroName(name); setLobbyError(""); }}/> :
      <div className="game-layout"><div className={mobileParty ? "mobile-rail open" : "mobile-rail"}><button className="mobile-close icon-button" onClick={() => setMobileParty(false)}><X size={17}/></button><PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} onInspectPlayer={inspectPlayer}/></div><PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} onInspectPlayer={inspectPlayer}/>
        <section className="world-stage combat-stage"><div className="realm-meta"><div><span className="eyebrow">TEAM BATTLE ARENA · 30-TURN MATCH</span><h1>Eliminate the opposing team</h1></div><span className="seed-button">d20 target: {adventure.target}</span></div>
          <section className="combat-banner"><Swords size={24}/><div><strong>{activePlayer?.displayName ? <><span className="player-name-highlight">{activePlayer.displayName}</span>&apos;s turn</> : "Waiting for a player"}</strong><p>Defeat every opponent to win immediately. After turn 30, the team with more total HP wins.</p></div></section>
          <div className="encounter-row"><section className="objective-card"><div className="objective-icon"><Target size={22}/></div><div><span className="eyebrow">THIS TURN'S TARGET</span><strong>Roll d20 plus active and passive bonuses to reach {adventure.target}</strong><small>The server reveals a new random target for every turn. Previous rolls do not determine it.</small>{activePlayer?.id === sessionId && ["enemy", "ally", "defeated-ally", "player"].includes(activeCard?.target ?? "") ? <label className="target-picker"><Target size={16}/><span>Choose {getCardTargetLabel(activeCard).toLowerCase()}</span>{targetOptions.length ? <select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)}>{targetOptions.map((player) => <option value={player.id} key={player.id}>{player.displayName} · {player.hero.name} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP · {game?.playerStates[player.id]?.shield ?? 0} shield{(game?.playerStates[player.id]?.skipTurns ?? 0) > 0 ? " · NEXT TURN CANCELLED" : ""}{(game?.playerStates[player.id]?.reviveIn ?? 0) > 0 ? " · REVIVING" : ""}</option>)}</select> : <span className="no-valid-target">No valid target is available. A successful roll will have no effect.</span>}</label> : null}</div></section><DiceRoller roll={rolling ? animatedRoll : game?.roll ?? null} rolling={rolling} target={adventure.target} passiveBonus={passiveDiceBonus} diceBuff={activeState?.diceBuff ?? 0} dicePenalty={activeState?.dicePenalty ?? 0} onRoll={castDie} disabled={activePlayer?.id !== sessionId || status !== "connected" || runComplete || (localState?.hp ?? 1) <= 0} disabledLabel={(localState?.hp ?? 1) <= 0 ? "You have been defeated" : runComplete ? "The battle has ended" : status !== "connected" ? "Reconnecting..." : `Waiting for ${activePlayer?.displayName ?? "a player"}`}/><button className="skip-turn-button" onClick={skipTurn} disabled={activePlayer?.id !== sessionId || status !== "connected" || runComplete || rolling || (activeState?.hp ?? 0) <= 0}><SkipForward size={19}/><span>Skip turn</span><small>Keep this hand</small></button></div>
          <section className="hand-zone private-hand-zone"><div className="hand-heading"><div><span className="eyebrow">{localPlayer ? "YOUR PRIVATE HAND" : "PRIVATE HAND"}</span><strong>{activePlayer?.id === sessionId ? "Choose a card, select a target when required, then roll the die" : "Plan your next move while the current player acts"}</strong></div>{localPlayer && <div className="pile-review-actions"><span><Hand size={16}/> Hand ({localState?.hand.length ?? 0})</span><button onClick={() => setDeckReview("draw")}><Layers size={16}/> Draw pile ({localState?.drawPile.length ?? 0})</button><button onClick={() => setDeckReview("discard")}><Archive size={16}/> Discard ({localState?.discardPile.length ?? 0})</button></div>}</div>
            {localState && <div className="active-effects-strip"><b>ACTIVE EFFECTS</b>{localState.attackBuff > 0 && <span className="effect-attack">Next attack +{localState.attackBuff}</span>}{localState.diceBuff > 0 && <span className="effect-bonus">Next d20 +{localState.diceBuff}</span>}{localState.dicePenalty > 0 && <span className="effect-penalty">Next d20 -{localState.dicePenalty}</span>}{localState.skipTurns > 0 && <span className="effect-penalty">Next turn cancelled</span>}{localState.reviveIn > 0 && <span className="effect-heal">Revives in {localState.reviveIn} turns</span>}{(localState.borrowedCards?.length ?? 0) > 0 && <span className="effect-support">{(localState.borrowedCards?.length ?? 0)} borrowed card</span>}{!localState.attackBuff && !localState.diceBuff && !localState.dicePenalty && !localState.skipTurns && !localState.reviveIn && !(localState.borrowedCards?.length ?? 0) && <span>No active effects</span>}</div>}
            {localPlayer ? <div className="action-hand four-cards">{localHand.map((card) => <button className={`action-card effect-${card.effect} ${card.unique ? "hero-special-card" : "common-action-card"} ${card.effect === "none" ? "no-effect-card" : ""} ${selectedCard === card.id ? "selected" : ""}`} aria-pressed={selectedCard === card.id} style={{ "--hero-color": localPlayer.hero.color } as React.CSSProperties} key={card.id} onClick={() => setSelectedCard(card.id)} disabled={runComplete || activePlayer?.id !== sessionId || (localState?.hp ?? 0) <= 0}>{card.unique && <span className="special-skill-banner"><Crown size={12}/> {localPlayer.hero.className.toUpperCase()} SKILL</span>}<div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><span>{card.unique ? "Special card" : card.effect === "none" ? "No-effect card" : "Common action"} · {typeName[card.type]}</span><strong>{card.name}</strong><p>{card.description}</p><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><CardOutcomeLines card={card}/></button>)}</div> : <div className="private-hand-empty"><Eye size={20}/><strong>Join the battle to receive a private hand.</strong></div>}
          </section>
        </section>
        <aside className="rival-panel"><section className="current-turn-card"><span className="eyebrow">CURRENT PLAYER</span><div><button className="portrait-button" onClick={() => { if (activePlayer) inspectPlayer(activePlayer.id); }} aria-label="View current character"><div className="portrait" style={{ "--hero-color": activePlayer?.hero.color } as React.CSSProperties}>{activePlayer?.hero.initials}</div></button><div><strong className="player-name-highlight">{activePlayer?.displayName}</strong><span>{activePlayer?.hero.name} · {activePlayer?.hero.className}</span></div></div><small>{secondsLeft} seconds left · Target {adventure.target}</small></section>
          <section className="turn-queue-card"><div className="panel-heading"><div><span className="eyebrow">TURN ORDER</span><strong>Current and upcoming turns</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("turns")} aria-label="Expand turn order"><ListOrdered size={17}/></button></div><TurnOrderList players={players} game={game} order={visibleTurnOrder} onInspect={inspectPlayer}/></section>
          <section className="rivalry"><div className="panel-heading"><div><span className="eyebrow">TEAM STATUS</span><strong>Only one team can win</strong></div><Shield size={17}/></div>{(["veil", "ember"] as TeamId[]).map((team) => { const data = team === "veil" ? veil : ember; return <article className={`faction-card ${team}`} key={team}><div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18}/> : <Flame size={18}/>}</div><div><span>{teamName[team]}</span><strong>{data.hp}/{data.maxHp} total HP</strong></div></div><p>{data.alive}/{data.total} alive · {data.shield} total shield</p><div className="influence-track"><i style={{ width: `${data.maxHp ? data.hp / data.maxHp * 100 : 0}%` }}/></div></article>; })}</section>
          <section className="history-panel"><div className="panel-heading"><div><span className="eyebrow">BATTLE HISTORY</span><strong>Actions, rolls, and world events</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("history")} aria-label="Expand battle history"><History size={17}/></button></div><HistoryEntries entries={game?.history ?? []} players={players}/></section>
        </aside>
      </div>}
    {modalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><section className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${deckReview || expandedPanel ? "wide-modal" : ""} ${(showOutcome || showTurnSummary || showWorldEvent) && !showGuide && !deckReview && !expandedPanel && !inspectedPlayer ? "resolution-card" : ""}`}><button className="modal-close icon-button" onClick={closeModal} aria-label="Close"><X size={18}/></button>
      {showGuide ? <div className="tutorial-scroll"><span className="eyebrow">COMPLETE TUTORIAL</span><h2>How to win Shattered Oath</h2><p className="modal-lead">Two teams alternate cards and d20 rolls. Eliminate the opposing team, or hold more total HP after turn 30.</p><section className="tutorial-section"><h3><Users size={20}/> Setup</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a class</strong><p>Every 13-card deck contains 3 class specials, 5 common actions, and 5 no-effect common cards. Special cards harm their owner or team on failure; common-card failures simply do nothing.</p></div></article><article><b>2</b><div><strong>Your cards are private</strong><p>The server sends each browser only its own hand, draw pile, and discard pile. Click any avatar to inspect public character details without revealing cards.</p></div></article></div></section><section className="tutorial-section"><h3><Dices size={20}/> Playing a turn</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a highlighted card</strong><p>Only the rolled card leaves your hand. It enters discard and a replacement is drawn. When the draw pile is empty, discard is shuffled into a new draw pile.</p></div></article><article><b>2</b><div><strong>Beat the random target</strong><p>The server reveals a fresh target from 8 to 16 every turn. It is independent of every previous roll. Only active buffs and the acting character's matching passive modify the d20.</p></div></article><article><b>3</b><div><strong>Skip without changing cards</strong><p>Manual Skip and automatic timeout preserve the exact hand, draw pile, and discard pile. Cards cycle only after rolling a selected card.</p></div></article></div></section><section className="tutorial-section"><h3><Zap size={20}/> Failure and events</h3><p>Special-card failures cause the listed balanced backlash; common-card failures have no effect. Guardians and tanks shield, healers restore or revive, controllers change rolls and turns, commanders improve decks, and attackers focus damage. Large red world-event markers appear every 5 turns. Each event affects both teams with a separate random result for every living player and is recorded in Battle History.</p></section><section className="tutorial-section warning-section"><h3><Clock3 size={20}/> Synchronized turns</h3><p>Every client uses the server clock for the same 30-second deadline. At zero, the server immediately passes the turn without changing cards. Eliminating a team wins immediately; after turn 30, total HP decides the winner.</p></section></div> :
      deckReview ? <div className="expanded-panel-content"><span className="eyebrow">YOUR PRIVATE DECK</span><h2>{deckReview === "draw" ? "Draw pile" : "Discard pile"}</h2><p className="modal-lead">{deckReview === "draw" ? "These cards remain available to draw. Their order is shown only to you." : "Only cards you rolled have entered this pile. It reshuffles when the draw pile needs a replacement."}</p>{reviewedCards.length ? <div className="pile-card-grid">{reviewedCards.map((card, index) => <article className={`pile-review-card effect-${card.effect} ${card.unique ? "special" : ""}`} key={`${card.id}-${index}`}><span>{index + 1} · {card.unique ? "Special" : "Common"} · {card.type}</span><div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><strong>{card.name}</strong><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><CardOutcomeLines card={card}/></article>)}</div> : <div className="private-hand-empty"><Archive size={24}/><strong>This pile is empty.</strong></div>}</div> :
      expandedPanel === "events" ? <div className="expanded-panel-content world-event-library"><span className="eyebrow">WORLD EVENT LIBRARY</span><h2>Every event in Shattered Oath</h2><p className="modal-lead">One of these events triggers every fifth completed turn. Its level rises with the battle, and every living player receives an independent random result.</p><div>{worldEventLibrary.map((event, index) => <article key={event.title}><span>EVENT {index + 1}</span><strong>{event.title}</strong><p>{event.detail}</p><small>Possible results: HP damage · HP healing · shield loss · next-attack bonus · volatile heal/damage</small></article>)}</div></div> :
      expandedPanel === "history" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED BATTLE HISTORY</span><h2>Every action and world event</h2><HistoryEntries entries={game?.history ?? []} players={players} expanded/></div> :
      expandedPanel === "turns" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED TURN ORDER</span><h2>Current and upcoming players</h2><TurnOrderList players={players} game={game} order={visibleTurnOrder} expanded onInspect={inspectPlayer}/></div> :
      inspectedPlayer ? <div className="character-detail-modal"><div className="large-portrait" style={{ "--hero-color": inspectedPlayer.hero.color } as React.CSSProperties}>{inspectedPlayer.hero.initials}</div><span className="eyebrow"><b className="player-name-highlight">{inspectedPlayer.displayName}</b> · {teamName[inspectedPlayer.hero.team]}</span><h2>{inspectedPlayer.hero.name}</h2><p className="modal-lead">{inspectedPlayer.hero.title} · {inspectedPlayer.hero.className}</p><p>{inspectedPlayer.hero.summary}</p><div className="character-detail-stats"><div><span>HP</span><strong>{game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp}/{game?.playerStates[inspectedPlayer.id]?.maxHp ?? inspectedPlayer.hero.maxHp}</strong></div><div><span>Shield</span><strong>{game?.playerStates[inspectedPlayer.id]?.shield ?? 0}</strong></div><div><span>Status</span><strong>{(game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp) > 0 ? "Living" : "Defeated"}</strong></div></div><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · {inspectedPlayer.hero.passiveName}</span><strong>{inspectedPlayer.hero.passiveText}</strong></div></div><div className="character-impact-grid"><div className="character-trait strength"><span>Strength</span><strong>{inspectedPlayer.hero.strength}</strong></div><div className="character-trait weakness"><span>Weakness</span><strong>{inspectedPlayer.hero.weakness}</strong></div></div><div className="impact-note"><Sparkles size={18}/><div><span>Battle impact</span><p>{inspectedPlayer.hero.impact}</p></div></div><p className="privacy-note"><Eye size={15}/> This character's hand, draw pile, and discard pile remain private.</p></div> :
      showOutcome && outcome ? <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">YOUR ACTION</span><h2><HighlightPlayerNames text={`${outcome.actorName ?? "Player"} used ${outcome.cardName ?? "a card"}`} players={players}/></h2><div className="resolution-chips">{outcome.effect && <span>{outcome.effect}</span>}{outcome.targetName && <span>Target: <HighlightPlayerNames text={outcome.targetName} players={players}/></span>}</div><div className="resolution-equation"><span><small>d20 roll</small><strong>{outcome.roll ?? 0}</strong></span><i>+</i><span><small>total bonus</small><strong>{outcome.bonus ?? 0}</strong></span>{Boolean(outcome.dicePenalty) && <><i>−</i><span className="failure"><small>enemy penalty</small><strong>{outcome.dicePenalty}</strong></span></>}<i>=</i><span className={outcome.success ? "success" : "failure"}><small>your total</small><strong>{outcome.total}</strong></span><i className="compare-word">vs</i><span className="dice-target-result"><small>dice target</small><strong>{outcome.target}</strong></span></div><strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "SUCCESS" : "FAILURE"}</strong><p className="modal-lead"><HighlightPlayerNames text={outcome.detail} players={players}/></p>{outcome.failureDetail && <p className="negative-card-effect"><Skull size={16}/> <HighlightPlayerNames text={outcome.failureDetail} players={players}/></p>}<div className="resolution-metrics"><div><span>Effect value</span><strong>{outcome.amount ?? 0}</strong></div><div><span>Next random target</span><strong>{outcome.nextTarget ?? adventure.target}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue <ChevronRight size={17}/></button></div> :
      showTurnSummary && outcome ? <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">TURN SUMMARY</span><h2><HighlightPlayerNames text={outcome.label} players={players}/></h2><p className="modal-lead"><HighlightPlayerNames text={outcome.detail} players={players}/></p></div> :
      showWorldEvent && game?.worldEvent ? <div className="resolution-content world-event-resolution"><div className="resolution-hero world"><Zap size={34}/></div><span className="eyebrow">WORLD EVENT · LEVEL {game.worldEvent.level}</span><h2>{game.worldEvent.title}</h2><p className="modal-lead"><HighlightPlayerNames text={game.worldEvent.description} players={players}/></p><div className="resolution-metrics"><div><span>Occurred on turn</span><strong>{game.worldEvent.turn}</strong></div><div><span>Next event</span><strong>{game.worldEvent.turn < 30 ? game.worldEvent.turn + 5 : "None"}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedWorldEventId(game.worldEvent!.id)}>Continue <ChevronRight size={17}/></button></div> :
      runComplete ? <><span className="eyebrow">BATTLE COMPLETE</span><h2>{game?.winnerTeam ? `${teamName[game.winnerTeam]} wins!` : "The battle was ended."}</h2><p className="modal-lead">{game?.endReason}</p><div className="resolution-metrics"><div><span>Veilbound</span><strong>{veil.hp} HP</strong></div><div><span>Embercourt</span><strong>{ember.hp} HP</strong></div></div><button className="primary-button" onClick={() => send({ type: "return:lobby" })}><RefreshCw size={17}/> Return to lobby</button></> : null}
    </section></div>}
  </main>;
}
