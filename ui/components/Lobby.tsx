"use client";

import {
  Check,
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
import type { PlayerSession } from "@/shared/types";

type LobbyProps = {
  players: PlayerSession[];
  playerName: string;
  error: string;
  selectedPlayerId: string | null;
  localSessionId: string;
  connectionStatus: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  onSelectPlayer: (id: string) => void;
  onToggleReady: (id: string) => void;
  onLeave: (id: string) => void;
  onEnterGame: () => void;
};

export function Lobby({
  players,
  playerName,
  error,
  selectedPlayerId,
  localSessionId,
  connectionStatus,
  onNameChange,
  onJoin,
  onSelectPlayer,
  onToggleReady,
  onLeave,
  onEnterGame
}: LobbyProps) {
  const selected = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const readyCount = players.filter((player) => player.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;
  const localPlayer = players.find((player) => player.id === localSessionId);

  return (
    <section className="lobby-stage">
      <div className="lobby-intro">
        <span className="eyebrow">THE OATHBOUND ASSEMBLE</span>
        <h1>Join the company.</h1>
        <p>Every name creates one player session, a random hero, and a personal deck of three unique skill cards.</p>
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
              <button className="join-button" type="submit">
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
                  ) : <span className="remote-player-label">Controlled in another browser</span>}
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
          {selected ? (
            <>
              <div className="character-banner">
                <div className="large-portrait" style={{ "--hero-color": selected.hero.color } as React.CSSProperties}>
                  {selected.hero.initials}
                </div>
                <div>
                  <span className="eyebrow">{selected.displayName}&apos;S CHARACTER</span>
                  <h2>{selected.hero.name}</h2>
                  <p>{selected.hero.title} · {selected.hero.role}</p>
                </div>
                <div className={`team-chip ${selected.hero.team}`}>
                  {selected.hero.team === "veil" ? <Eye size={15} /> : <Flame size={15} />}
                  {selected.hero.team === "veil" ? "Veilbound" : "Embercourt"}
                </div>
              </div>

              <div className="character-stats">
                <span><strong>{selected.hero.hp}</strong> Health</span>
                <span><strong>3</strong> Skill cards</span>
                <span><strong>{selected.hero.skill}</strong> Signature</span>
              </div>

              <div className="deck-heading">
                <div><span className="eyebrow">PERSONAL SKILL DECK</span><strong>Review before you ready</strong></div>
                <Sparkles size={18} />
              </div>

              <div className="lobby-skill-deck">
                {selected.skillDeck.map((card) => (
                  <article className="skill-card" key={card.id}>
                    <div className={`card-sigil ${card.type.toLowerCase()}`}>
                      {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                    </div>
                    <span>{card.type} · +{card.bonus}</span>
                    <strong>{card.name}</strong>
                    <p>{card.description}</p>
                    <small>Risk {card.risk || "none"}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="no-character">
              <Sparkles size={28} />
              <h2>Your hero is waiting</h2>
              <p>Join the lobby to receive a random character and skill-card deck.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
