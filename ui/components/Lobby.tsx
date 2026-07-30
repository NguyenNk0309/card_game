"use client";

import { Check, Crown, Eye, Flame, LogOut, Shield, Sparkles, Swords, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { describeCardFailure, describeCardSuccess } from "@/shared/cardRules";
import type { CharacterOption, PlayerSession, TeamId } from "@/shared/types";
import { CardEffectIcon } from "./CardEffectIcon";
import { CardDescription } from "./CardDescription";
import { EffectText } from "./EffectText";
import { PityCostBadge } from "./PityCost";

type Props = {
  players: PlayerSession[]; playerName: string; error: string; selectedPlayerId: string | null;
  localSessionId: string; connectionStatus: string; characterOptions: CharacterOption[]; selectedHeroName: string;
  onNameChange: (name: string) => void; onSlotSelect: (team: TeamId) => void; onSelectPlayer: (id: string) => void;
  onToggleReady: (id: string) => void; onLeave: (id: string) => void; onRemovePlayer: (id: string) => void;
  onEnterGame: () => void; onHeroSelect: (heroName: string) => void;
};

const statusText: Record<string, string> = { connecting: "CONNECTING", connected: "CONNECTED", reconnecting: "RECONNECTING", offline: "OFFLINE" };

type CharacterGroup = "attacker" | "guardian" | "healer" | "supporter";

const characterGroups: Array<{ id: CharacterGroup; label: string; roles: string[] }> = [
  { id: "attacker", label: "Attacker", roles: ["Ranger", "Mage", "Assassin", "Duelist", "Berserker"] },
  { id: "guardian", label: "Guardian", roles: ["Guardian", "Tank"] },
  { id: "healer", label: "Healer", roles: ["Healer"] },
  { id: "supporter", label: "Supporter", roles: ["Support", "Controller"] }
];

export function Lobby({ players, playerName, error, selectedPlayerId, localSessionId, connectionStatus, characterOptions, selectedHeroName, onNameChange, onSlotSelect, onSelectPlayer, onToggleReady, onLeave, onRemovePlayer, onEnterGame, onHeroSelect }: Props) {
  const [activeCharacterGroup, setActiveCharacterGroup] = useState<CharacterGroup>("attacker");
  const localPlayer = players.find((player) => player.id === localSessionId);
  const selected = players.find((player) => player.id === selectedPlayerId) ?? localPlayer;
  const selectedOption = characterOptions.find((option) => option.hero.name === selectedHeroName);
  const reviewingOwnPick = !selected || selected.id === localSessionId;
  const randomPending = reviewingOwnPick ? (localPlayer?.randomHero ?? !selectedHeroName) : Boolean(selected?.randomHero);
  const shownHero = randomPending ? undefined : reviewingOwnPick ? selectedOption?.hero ?? localPlayer?.hero : selected?.hero;
  const shownDeck = randomPending ? [] : reviewingOwnPick ? selectedOption?.skillDeck ?? localPlayer?.skillDeck ?? [] : selected?.skillDeck ?? [];
  const characterPickLocked = Boolean(localPlayer?.ready);
  const readyCount = players.filter((player) => player.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;
  const hasBothTeams = players.some((player) => player.hero.team === "veil") && players.some((player) => player.hero.team === "ember");
  const canStart = allReady && hasBothTeams;
  const relationClass = (player?: PlayerSession) => player && localPlayer ? (player.hero.team === localPlayer.hero.team ? "ally" : "enemy") : "neutral";
  const teamPlayers = (team: TeamId) => players.filter((player) => player.hero.team === team).sort((left, right) => left.joinedAt - right.joinedAt);
  const canJoinSlot = !localPlayer && Boolean(playerName.trim()) && (Boolean(shownHero) || randomPending) && connectionStatus === "connected";
  const activeGroup = characterGroups.find((group) => group.id === activeCharacterGroup) ?? characterGroups[0];
  const visibleCharacterOptions = characterOptions.filter((option) => activeGroup.roles.includes(option.hero.role));
  const renderTeam = (team: TeamId) => {
    const members = teamPlayers(team);
    const TeamIcon = team === "veil" ? Eye : Flame;
    const teamLabel = team === "veil" ? "Veilbound" : "Embercourt";
    const canSwitchToTeam = Boolean(localPlayer && !localPlayer.ready && localPlayer.hero.team !== team && connectionStatus === "connected");
    const canUseEmptySlot = canJoinSlot || canSwitchToTeam;
    return <section className={`lobby-team-column ${team}`} aria-label={`${teamLabel} team slots`} key={team}>
      <header><div><TeamIcon size={17}/><strong>{teamLabel}</strong></div><span>{members.length}/5</span></header>
      <div className="lobby-team-slots">
        {members.map((player, index) => <article className={`joined-player team-slot-player ${selected?.id === player.id ? "selected" : ""}`} key={player.id}>
          <button className="joined-main" onClick={() => onSelectPlayer(player.id)}>
            <div className="portrait" style={{ "--hero-color": player.randomHero ? "#d4b56e" : player.hero.color } as React.CSSProperties}>{player.randomHero ? "?" : player.hero.initials}</div>
            <div><div className="joined-name"><strong className={`player-name-highlight ${relationClass(player)}`}>{player.displayName}</strong>{player.id === localSessionId && <UserCheck className="local-session-icon" size={14} aria-label="Your session"/>}</div>{!player.randomHero && <p>{player.hero.name} · {player.hero.className}</p>}</div>
            <div className="lobby-player-status"><span>Slot {index + 1}</span><span className={`ready-badge ${player.ready ? "is-ready" : ""}`}>{player.ready && <Check size={13}/>} {player.ready ? "Ready" : "Not ready"}</span></div>
          </button>
          {player.id === localSessionId ? <div className="joined-actions local-player-actions"><button className="out-team-button" onClick={() => onLeave(player.id)} aria-label={`Leave team as ${player.displayName}`}><LogOut size={14}/> Out team</button><button className={player.ready ? "unready-button" : "ready-button"} onClick={() => onToggleReady(player.id)}>{player.ready ? "Cancel ready" : "Ready"}</button></div> : <div className="joined-actions remote-player-actions">{localPlayer ? <button className="remove-player-button" onClick={() => onRemovePlayer(player.id)}><UserMinus size={14}/> Remove</button> : <span className="remote-player-label">Another browser</span>}</div>}
        </article>)}
        {Array.from({ length: 5 - members.length }, (_, index) => <button className={`empty-team-slot ${canSwitchToTeam ? "switch-team-slot" : ""}`} type="button" key={`empty-${team}-${index}`} onClick={() => onSlotSelect(team)} disabled={!canUseEmptySlot} aria-label={`${localPlayer ? "Switch to" : "Join"} ${teamLabel} in slot ${members.length + index + 1}`}>
          <UserPlus size={18}/><span><strong>Empty slot</strong><small>{localPlayer ? localPlayer.hero.team === team ? "Your current team" : localPlayer.ready ? "Cancel Ready to switch" : `Switch to ${teamLabel}` : playerName.trim() ? `Join ${teamLabel}` : "Enter your name first"}</small></span>
        </button>)}
      </div>
    </section>;
  };

  return <section className="lobby-stage">
    <div className="lobby-intro"><span className="eyebrow">THE ARENA AWAITS</span><h1>Join the battle.</h1><p>Choose or randomize a character, enter a name, join a team, and ready up.</p></div>
    <div className="lobby-grid">
      <section className="join-panel">
        <div className="lobby-panel-heading"><div><span className="eyebrow">SHARED GAME ROOM</span><h2>{localPlayer ? <><span className={`player-name-highlight ${relationClass(localPlayer)}`}>{localPlayer.displayName}</span> joined {localPlayer.hero.team === "veil" ? "Veilbound" : "Embercourt"}</> : "Enter your name and choose a slot"}</h2></div><div className="lobby-heading-status"><span className={`connection-pill ${connectionStatus}`}>{statusText[connectionStatus] ?? connectionStatus}</span><div className={players.length >= 10 ? "capacity full" : "capacity"}><Users size={16} /> {players.length}/10</div></div></div>
        {!localPlayer && <div className="join-form"><label htmlFor="player-name">Player name</label><div><input id="player-name" value={playerName} onChange={(event) => onNameChange(event.target.value)} placeholder="Enter a name..." maxLength={24} autoComplete="off"/></div><span className="join-slot-hint">Then choose a slot.</span></div>}
        {error && <div className="lobby-error" role="alert">{error}</div>}
        <div className="joined-heading"><div><span className="eyebrow">JOINED PLAYERS</span><strong>{readyCount}/{players.length} ready</strong></div><span>Five slots per team.</span></div>
        <div className="lobby-team-board">{renderTeam("veil")}{renderTeam("ember")}</div>
        <div className={`ready-gate ${canStart ? "all-ready" : ""}`}>{canStart ? <Check size={19}/> : <Shield size={19}/>}<div><strong>{canStart ? "Everyone is ready" : players.length < 2 ? "Waiting for another player" : !hasBothTeams ? "Both teams need a player" : "Waiting for all players"}</strong><span>{canStart ? "Start when ready." : !hasBothTeams && players.length >= 2 ? "Each team needs one player." : "Every player must be ready."}</span></div><button className="enter-game-button" onClick={onEnterGame} disabled={!canStart || connectionStatus !== "connected"}><Swords size={17}/> Enter the battle</button></div>
      </section>
      <aside className="character-panel">
        <div className={`hero-picker ${characterPickLocked ? "is-locked" : ""}`}><div className="deck-heading"><div><span className="eyebrow">CHOOSE YOUR CHARACTER</span><strong>{characterPickLocked ? "Cancel ready to change" : "Optional before readying"}</strong></div><Users size={18}/></div><div className="hero-class-tabs" role="tablist" aria-label="Character classes">{characterGroups.map((group) => <button type="button" role="tab" aria-selected={activeCharacterGroup === group.id} className={activeCharacterGroup === group.id ? "active" : ""} onClick={() => setActiveCharacterGroup(group.id)} key={group.id}>{group.label}<span>{characterOptions.filter((option) => group.roles.includes(option.hero.role)).length}</span></button>)}</div><div className="hero-picker-grid" role="tabpanel" aria-label={`${activeGroup.label} characters`}>{visibleCharacterOptions.map((option) => <button type="button" key={option.hero.name} className={selectedHeroName === option.hero.name ? "selected" : ""} aria-pressed={selectedHeroName === option.hero.name} onClick={() => onHeroSelect(selectedHeroName === option.hero.name ? "" : option.hero.name)} disabled={characterPickLocked} title={characterPickLocked ? "Cancel ready to change." : option.hero.summary}><span style={{ "--hero-color": option.hero.color } as React.CSSProperties}>{option.hero.initials}</span><strong>{option.hero.name}</strong><small>{option.hero.className}</small></button>)}{!visibleCharacterOptions.length && <div className="empty-character-group"><Sparkles size={22}/><span>No characters in this class.</span></div>}</div></div>
        {shownHero ? <div className="character-review-layout">
          <section className="character-info-column">
            <div className="character-banner"><div className="large-portrait" style={{ "--hero-color": shownHero.color } as React.CSSProperties}>{shownHero.initials}</div><div><span className="eyebrow">{reviewingOwnPick ? "YOUR CHARACTER PICK" : "SELECTED CHARACTER"}</span><h2>{shownHero.name}</h2></div></div>
            <div className="character-profile"><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · {shownHero.passiveName}</span><strong>{shownHero.passiveText}</strong></div></div><div className="character-impact-grid"><div className="character-trait strength"><span>Strength</span><strong>{shownHero.strength}</strong></div><div className="character-trait weakness"><span>Weakness</span><strong>{shownHero.weakness}</strong></div></div></div>
            <div className="character-stats"><span className="stat-health"><strong>{shownHero.hp}</strong><span>HP</span></span><span className="stat-speed"><strong>{shownHero.speed}</strong><span>Speed</span></span><span className="stat-cards"><strong>10</strong><span>cards · <b>3</b> special</span></span></div>
          </section>
          <section className="character-deck-column">
            <div className="deck-heading"><div><span className="eyebrow">PERSONAL SKILL DECK</span></div><Sparkles size={18}/></div>
            <div className="lobby-skill-deck">{shownDeck.map((card) => <article className={`skill-card card-with-header effect-${card.effect} ${card.unique ? "hero-unique-card" : "common-skill-card"} ${card.effect === "none" ? "no-effect-card" : ""}`} key={card.id} style={{ "--hero-color": shownHero.color } as React.CSSProperties}><PityCostBadge card={card}/><div className={`unique-card-banner ${card.unique ? "" : "common-card-banner"}`}>{card.unique ? <><Crown size={13}/> SPECIAL</> : "COMMON"}</div><div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><span className="skill-kind">{card.unique ? "Class skill" : card.effect === "none" ? "No-effect common card" : "Common action card"}</span><strong>{card.name}</strong><CardDescription card={card}/><div className="card-outcome-lines"><p className="card-success-line"><Check size={13}/><span><b>SUCCESS</b><EffectText text={describeCardSuccess(card)} card={card}/></span></p><p className="card-failure-line"><X size={13}/><span><b>FAILURE</b><EffectText text={describeCardFailure(card)} card={card}/></span></p></div></article>)}</div>
          </section>
        </div> : randomPending ? <div className="no-character"><Sparkles size={32}/><h2>No character selected</h2><p>A random character joins at battle start.</p></div> : <div className="no-character"><Sparkles size={28}/><h2>Your character awaits</h2><p>Choose one to review skills.</p></div>}</aside>
    </div>
  </section>;
}
