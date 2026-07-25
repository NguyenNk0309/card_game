"use client";

import { Check, Crown, DoorOpen, Eye, Flame, Shield, Sparkles, Swords, UserMinus, UserPlus, Users, X } from "lucide-react";
import { describeCardFailure, describeCardSuccess, getCardEffectLabel, getCardTargetLabel } from "@/shared/cardRules";
import type { CharacterOption, PlayerSession } from "@/shared/types";
import { CardEffectIcon } from "./CardEffectIcon";

type Props = {
  players: PlayerSession[]; playerName: string; error: string; selectedPlayerId: string | null;
  localSessionId: string; connectionStatus: string; characterOptions: CharacterOption[]; selectedHeroName: string;
  onNameChange: (name: string) => void; onJoin: () => void; onSelectPlayer: (id: string) => void;
  onToggleReady: (id: string) => void; onLeave: (id: string) => void; onRemovePlayer: (id: string) => void;
  onEnterGame: () => void; onHeroSelect: (heroName: string) => void;
};

const statusText: Record<string, string> = { connecting: "CONNECTING", connected: "CONNECTED", reconnecting: "RECONNECTING", offline: "OFFLINE" };

export function Lobby({ players, playerName, error, selectedPlayerId, localSessionId, connectionStatus, characterOptions, selectedHeroName, onNameChange, onJoin, onSelectPlayer, onToggleReady, onLeave, onRemovePlayer, onEnterGame, onHeroSelect }: Props) {
  const localPlayer = players.find((player) => player.id === localSessionId);
  const selected = localPlayer ? players.find((player) => player.id === selectedPlayerId) ?? localPlayer : undefined;
  const selectedOption = characterOptions.find((option) => option.hero.name === selectedHeroName) ?? characterOptions[0];
  const shownHero = selected?.hero ?? selectedOption?.hero;
  const shownDeck = selected?.skillDeck ?? selectedOption?.skillDeck ?? [];
  const readyCount = players.filter((player) => player.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;

  return <section className="lobby-stage">
    <div className="lobby-intro"><span className="eyebrow">THE ARENA AWAITS</span><h1>Join the battle.</h1><p>Choose any character, review a 10-card deck with 3 special cards, 2 attacks, 1 shield, 1 heal, and 3 no-effect cards, then ready up.</p></div>
    <div className="lobby-grid">
      <section className="join-panel">
        <div className="lobby-panel-heading"><div><span className="eyebrow">SHARED GAME ROOM</span><h2>Enter your player name</h2></div><div className="lobby-heading-status"><span className={`connection-pill ${connectionStatus}`}>{statusText[connectionStatus] ?? connectionStatus}</span><div className={players.length >= 10 ? "capacity full" : "capacity"}><Users size={16} /> {players.length}/10</div></div></div>
        {!localPlayer ? <form className="join-form" onSubmit={(event) => { event.preventDefault(); onJoin(); }}><label htmlFor="player-name">Player name</label><div><input id="player-name" value={playerName} onChange={(event) => onNameChange(event.target.value)} placeholder="Enter a name..." maxLength={24} autoComplete="off"/><button className="join-button" type="submit" disabled={!shownHero || players.length >= 10}><UserPlus size={18} /> {players.length >= 10 ? "Room full" : "Join"}</button></div></form> : <div className="joined-session-note"><Check size={17}/><div><strong>You joined as <span className="player-name-highlight">{localPlayer.displayName}</span></strong><span>This browser controls only your player session.</span></div></div>}
        {error && <div className="lobby-error" role="alert">{error}</div>}
        <div className="joined-heading"><div><span className="eyebrow">JOINED PLAYERS</span><strong>{readyCount}/{players.length} ready</strong></div><span>When everyone is ready, any player may start the battle.</span></div>
        <div className="joined-list">
          {!players.length && <div className="empty-lobby"><DoorOpen size={24}/><strong>No players have joined</strong><span>Enter a name and press Join to create the first session.</span></div>}
          {players.map((player, index) => <article className={`joined-player ${selected?.id === player.id ? "selected" : ""}`} key={player.id}>
            <button className="joined-main" onClick={() => onSelectPlayer(player.id)}><div className="portrait" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>{player.hero.initials}</div><div><div className="joined-name"><strong className="player-name-highlight">{player.displayName}</strong><span>{player.id === localSessionId ? "Your session" : `Session ${index + 1}`}</span></div><p>{player.hero.name} · {player.hero.className}</p></div><span className={`ready-badge ${player.ready ? "is-ready" : ""}`}>{player.ready && <Check size={13}/>} {player.ready ? "Ready" : "Not ready"}</span></button>
            <div className="joined-actions"><button onClick={() => onSelectPlayer(player.id)}><Eye size={14}/> Review deck</button>{player.id === localSessionId ? <><button className={player.ready ? "unready-button" : "ready-button"} onClick={() => onToggleReady(player.id)}>{player.ready ? "Cancel ready" : "Ready"}</button><button className="leave-button" onClick={() => onLeave(player.id)} aria-label={`Leave room as ${player.displayName}`} title="Leave room"><UserMinus size={15}/></button></> : <><span className="remote-player-label">Controlled in another browser</span>{localPlayer && <button className="remove-player-button" onClick={() => onRemovePlayer(player.id)}><UserMinus size={14}/> Remove</button>}</>}</div>
          </article>)}
        </div>
        <div className={`ready-gate ${allReady ? "all-ready" : ""}`}>{allReady ? <Check size={19}/> : <Shield size={19}/>}<div><strong>{allReady ? "Everyone is ready" : players.length < 2 ? "Waiting for another player" : "Waiting for all players"}</strong><span>{allReady ? "Any joined player may start the battle." : "Every joined player must press Ready before the battle can start."}</span></div><button className="enter-game-button" onClick={onEnterGame} disabled={!allReady || connectionStatus !== "connected"}><Swords size={17}/> Enter the battle</button></div>
      </section>
      <aside className="character-panel">{shownHero ? <>
        {!localPlayer && <div className="hero-picker"><div className="deck-heading"><div><span className="eyebrow">CHOOSE YOUR CHARACTER</span><strong>Characters may be chosen by multiple players</strong></div><Users size={18}/></div><div className="hero-picker-grid">{characterOptions.map((option) => <button key={option.hero.name} className={selectedHeroName === option.hero.name ? "selected" : ""} onClick={() => onHeroSelect(option.hero.name)} title={option.hero.summary}><span style={{ "--hero-color": option.hero.color } as React.CSSProperties}>{option.hero.initials}</span><strong>{option.hero.name}</strong><small>{option.hero.className}</small></button>)}</div></div>}
        <div className="character-banner"><div className="large-portrait" style={{ "--hero-color": shownHero.color } as React.CSSProperties}>{shownHero.initials}</div><div><span className="eyebrow">{selected ? <><b className="player-name-highlight">{selected.displayName}</b>&apos;S CHARACTER</> : "YOUR CHARACTER PICK"}</span><h2>{shownHero.name}</h2><p>{shownHero.title} · {shownHero.className}</p></div>{selected ? <div className={`team-chip ${shownHero.team}`}>{shownHero.team === "veil" ? <Eye size={15}/> : <Flame size={15}/>} {shownHero.team === "veil" ? "Veilbound" : "Embercourt"}</div> : <span className="team-pending">Team assigned for balance when you join</span>}</div>
        <div className="character-profile"><p>{shownHero.summary}</p><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · {shownHero.passiveName}</span><strong>{shownHero.passiveText}</strong></div></div><div className="character-impact-grid"><div className="character-trait strength"><span>Strength</span><strong>{shownHero.strength}</strong></div><div className="character-trait weakness"><span>Weakness</span><strong>{shownHero.weakness}</strong></div></div><div className="impact-note"><Sparkles size={18}/><div><span>Battle impact</span><p>{shownHero.impact}</p></div></div></div>
        <div className="character-stats"><span><strong>{shownHero.hp}</strong> HP</span><span><strong>{shownHero.speed}</strong> Speed</span><span><strong>10</strong> cards · 3 special</span><span><strong>{shownHero.skill}</strong> Signature</span></div>
        <div className="deck-heading"><div><span className="eyebrow">PERSONAL SKILL DECK</span><strong>Review before you ready up</strong></div><Sparkles size={18}/></div>
        <div className="lobby-skill-deck">{shownDeck.map((card) => <article className={`skill-card effect-${card.effect} ${card.unique ? "hero-unique-card" : "common-skill-card"} ${card.effect === "none" ? "no-effect-card" : ""}`} key={card.id} style={{ "--hero-color": shownHero.color } as React.CSSProperties}>{card.unique && <div className="unique-card-banner"><Crown size={13}/> SPECIAL · {shownHero.name}</div>}<div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><span className="skill-kind">{card.unique ? "Class skill" : card.effect === "none" ? "No-effect common card" : "Common action card"} · {card.type}</span><strong>{card.name}</strong><p>{card.description}</p><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><div className="card-outcome-lines"><p className="card-success-line"><Check size={13}/><span><b>SUCCESS</b>{describeCardSuccess(card)}</span></p><p className="card-failure-line"><X size={13}/><span><b>FAILURE</b>{describeCardFailure(card)}</span></p></div></article>)}</div>
      </> : <div className="no-character"><Sparkles size={28}/><h2>Your character awaits</h2><p>Choose a character to review their special skills.</p></div>}</aside>
    </div>
  </section>;
}
