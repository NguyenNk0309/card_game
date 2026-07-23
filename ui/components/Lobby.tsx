"use client";

import {
  Check,
  Crown,
  DoorOpen,
  Eye,
  Flame,
  Shield,
  Sparkles,
  Swords,
  UserMinus,
  UserPlus,
  Users
} from "lucide-react";
import type { CharacterOption, PlayerSession } from "@/shared/types";

type LobbyProps = {
  players: PlayerSession[];
  playerName: string;
  error: string;
  selectedPlayerId: string | null;
  localSessionId: string;
  connectionStatus: string;
  characterOptions: CharacterOption[];
  selectedHeroName: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  onSelectPlayer: (id: string) => void;
  onToggleReady: (id: string) => void;
  onLeave: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onEnterGame: () => void;
  onHeroSelect: (heroName: string) => void;
};

export function Lobby({
  players,
  playerName,
  error,
  selectedPlayerId,
  localSessionId,
  connectionStatus,
  characterOptions,
  selectedHeroName,
  onNameChange,
  onJoin,
  onSelectPlayer,
  onToggleReady,
  onLeave,
  onRemovePlayer,
  onEnterGame,
  onHeroSelect
}: LobbyProps) {
  const localPlayer = players.find((player) => player.id === localSessionId);
  const selected = localPlayer ? players.find((player) => player.id === selectedPlayerId) ?? localPlayer : undefined;
  const selectedOption = characterOptions.find((option) => option.hero.name === selectedHeroName) ?? characterOptions[0];
  const shownHero = selected?.hero ?? selectedOption?.hero;
  const shownDeck = selected?.skillDeck ?? selectedOption?.skillDeck ?? [];
  const readyCount = players.filter((player) => player.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;
  const takenHeroes = new Set(players.map((player) => player.hero.name));

  return (
    <section className="lobby-stage">
      <div className="lobby-intro">
        <span className="eyebrow">THE OATHBOUND ASSEMBLE</span>
        <h1>Join the company.</h1>
        <p>Choose your hero, review a personal 15-card deck, then join the shared company.</p>
      </div>

      <div className="lobby-grid">
        <section className="join-panel">
          <div className="lobby-panel-heading">
            <div>
              <span className="eyebrow">SINGLE SHARED LOBBY</span>
              <h2>Enter your player name</h2>
            </div>
            <div className="lobby-heading-status">
              <span className={`connection-pill ${connectionStatus}`}>{connectionStatus}</span>
              <div className={players.length >= 10 ? "capacity full" : "capacity"}><Users size={16} /> {players.length}/10</div>
            </div>
          </div>

          {!localPlayer ? <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              onJoin();
            }}
          >
            <label htmlFor="player-name">Player name</label>
            <div>
              <input
                id="player-name"
                value={playerName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Enter a name…"
                maxLength={24}
                autoComplete="off"
              />
              <button className="join-button" type="submit" disabled={!shownHero || takenHeroes.has(shownHero.name)}>
                <UserPlus size={18} /> {players.length >= 10 ? "Lobby full" : "Join"}
              </button>
            </div>
          </form> : (
            <div className="joined-session-note"><Check size={17} /><div><strong>You joined as {localPlayer.displayName}</strong><span>This browser controls only this player session.</span></div></div>
          )}

          {error && <div className="lobby-error" role="alert">{error}</div>}

          <div className="joined-heading">
            <div>
              <span className="eyebrow">JOINED PLAYERS</span>
              <strong>{readyCount} of {players.length} ready</strong>
            </div>
            <span>When everyone is ready, any player may enter the game.</span>
          </div>

          <div className="joined-list">
            {players.length === 0 && (
              <div className="empty-lobby">
                <DoorOpen size={24} />
                <strong>No players have joined yet</strong>
                <span>Enter the first name above to create a session.</span>
              </div>
            )}

            {players.map((player, index) => (
              <article className={`joined-player ${selected?.id === player.id ? "selected" : ""}`} key={player.id}>
                <button className="joined-main" onClick={() => onSelectPlayer(player.id)}>
                  <div className="portrait" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>
                    {player.hero.initials}
                  </div>
                  <div>
                    <div className="joined-name"><strong>{player.displayName}</strong><span>{player.id === localSessionId ? "Your session" : `Session ${index + 1}`}</span></div>
                    <p>{player.hero.name} · {player.hero.role}</p>
                  </div>
                  <span className={`ready-badge ${player.ready ? "is-ready" : ""}`}>
                    {player.ready ? <Check size={13} /> : null}{player.ready ? "Ready" : "Not ready"}
                  </span>
                </button>
                <div className="joined-actions">
                  <button onClick={() => onSelectPlayer(player.id)}><Eye size={14} /> Review deck</button>
                  {player.id === localSessionId ? (
                    <><button className={player.ready ? "unready-button" : "ready-button"} onClick={() => onToggleReady(player.id)}>{player.ready ? "Cancel ready" : "Ready"}</button><button className="leave-button" onClick={() => onLeave(player.id)} aria-label={`Remove ${player.displayName}`} title="Leave lobby"><UserMinus size={15} /></button></>
                  ) : (
                    <>
                      <span className="remote-player-label">Controlled in another browser</span>
                      {localPlayer && <button className="remove-player-button" onClick={() => onRemovePlayer(player.id)} aria-label={`Remove ${player.displayName}`} title={`Remove ${player.displayName} from the room`}><UserMinus size={14} /> Remove</button>}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className={`ready-gate ${allReady ? "all-ready" : ""}`}>
            {allReady ? <Check size={19} /> : <Shield size={19} />}
            <div>
              <strong>{allReady ? "Every oath is sworn" : players.length < 2 ? "Waiting for another player" : "Waiting for every player"}</strong>
              <span>{allReady ? "Anyone may now enter the game." : "All joined players must press Ready before the game can start."}</span>
            </div>
            <button className="enter-game-button" onClick={onEnterGame} disabled={!allReady || connectionStatus !== "connected"}><Swords size={17} /> Enter the game</button>
          </div>
        </section>

        <aside className="character-panel">
          {shownHero ? (
            <>
              {!localPlayer && (
                <div className="hero-picker">
                  <div className="deck-heading"><div><span className="eyebrow">CHOOSE YOUR CHARACTER</span><strong>Each hero may be claimed once</strong></div><Users size={18} /></div>
                  <div className="hero-picker-grid">
                    {characterOptions.map((option) => {
                      const taken = takenHeroes.has(option.hero.name);
                      return <button key={option.hero.name} className={selectedHeroName === option.hero.name ? "selected" : ""} disabled={taken} onClick={() => onHeroSelect(option.hero.name)}><span style={{ "--hero-color": option.hero.color } as React.CSSProperties}>{option.hero.initials}</span><strong>{option.hero.name}</strong><small>{taken ? "Chosen" : option.hero.role}</small></button>;
                    })}
                  </div>
                </div>
              )}
              <div className="character-banner">
                <div className="large-portrait" style={{ "--hero-color": shownHero.color } as React.CSSProperties}>
                  {shownHero.initials}
                </div>
                <div>
                  <span className="eyebrow">{selected ? `${selected.displayName}'S CHARACTER` : "YOUR CHARACTER PICK"}</span>
                  <h2>{shownHero.name}</h2>
                  <p>{shownHero.title} · {shownHero.role}</p>
                </div>
                {selected ? <div className={`team-chip ${shownHero.team}`}>{shownHero.team === "veil" ? <Eye size={15} /> : <Flame size={15} />}{shownHero.team === "veil" ? "Veilbound" : "Embercourt"}</div> : <span className="team-pending">Team assigned on join</span>}
              </div>

              <div className="character-stats">
                <span><strong>{shownHero.hp}</strong> Health</span>
                <span><strong>15</strong> Cards · 5 unique</span>
                <span><strong>{shownHero.skill}</strong> Signature</span>
              </div>

              <div className="deck-heading">
                <div><span className="eyebrow">PERSONAL SKILL DECK</span><strong>Review before you ready</strong></div>
                <Sparkles size={18} />
              </div>

              <div className="lobby-skill-deck">
                {shownDeck.map((card) => (
                  <article className={`skill-card ${card.unique ? "hero-unique-card" : "common-skill-card"}`} key={card.id} style={{ "--hero-color": shownHero.color } as React.CSSProperties}>
                    {card.unique && <div className="unique-card-banner"><Crown size={13} /> {shownHero.name} special</div>}
                    <div className={`card-sigil ${card.type.toLowerCase()}`}>
                      {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                    </div>
                    <span className="skill-kind">{card.unique ? "Character skill" : "Common card"} · {card.type} · +{card.bonus}</span>
                    <strong>{card.name}</strong>
                    <p>{card.description}</p>
                    <small>{card.effect} · {card.target} · Risk {card.risk || "none"}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="no-character">
              <Sparkles size={28} />
              <h2>Your hero is waiting</h2>
              <p>Choose a character to inspect their unique skill cards.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
