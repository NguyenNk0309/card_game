"use client";

import {
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crown,
  Dices,
  Eye,
  Flame,
  HeartHandshake,
  Hand,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Octagon,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Users,
  Volume2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, nextStory, resolveCardTurn } from "@/backend/game/engine";
import type { TeamId } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { useRoomSocket } from "./hooks/useRoomSocket";

const teamCopy: Record<TeamId, { title: string; objective: string }> = {
  veil: { title: "Veilbound", objective: "Preserve three forbidden truths until the final gate." },
  ember: { title: "Embercourt", objective: "Claim the Warden's crown and end with the most influence." }
};

export default function GameApp() {
  const { room, status, error: roomError, sessionId, send, clearError } = useRoomSocket();
  const characterOptions = useMemo(() => getCharacterOptions(), []);
  const [playerName, setPlayerName] = useState("");
  const [selectedHeroName, setSelectedHeroName] = useState(characterOptions[0]?.hero.name ?? "");
  const [lobbyError, setLobbyError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lobbyAdventure] = useState(() => createAdventure("MOON42"));
  const [selectedCard, setSelectedCard] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [animatedRoll, setAnimatedRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [mobileParty, setMobileParty] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const players = room.players;
  const phase = room.phase;
  const game = room.game;
  const adventure = game?.adventure ?? lobbyAdventure;
  const activePlayerIndex = game?.activePlayerIndex ?? 0;
  const completedTurns = game?.completedTurns ?? 0;
  const roll = game?.roll ?? null;
  const outcome = game?.outcome ?? null;
  const activePlayer = players[activePlayerIndex];
  const activeDeck = activePlayer?.skillDeck ?? [];
  const activeRunState = activePlayer ? game?.playerStates[activePlayer.id] : undefined;
  const activeHand = activeRunState?.hand.map((cardId) => activeDeck.find((card) => card.id === cardId)).filter((card): card is NonNullable<typeof card> => Boolean(card)) ?? [];
  const activeCard = useMemo(
    () => activeHand.find((card) => card.id === selectedCard) ?? activeHand[0],
    [activeHand, selectedCard]
  );
  const targetOptions = activeCard && activePlayer ? players.filter((player) => {
    if (activeCard.target === "enemy") return player.hero.team !== activePlayer.hero.team;
    if (activeCard.target === "ally") return player.hero.team === activePlayer.hero.team;
    if (activeCard.target === "self") return player.id === activePlayer.id;
    return true;
  }) : [];
  const maxTurns = game?.maxTurns ?? adventure.maxChapters * Math.max(1, players.length);
  const remainingTurns = Math.max(0, maxTurns - completedTurns);
  const runComplete = phase === "game" && Boolean(game?.ended || completedTurns >= maxTurns);
  const secondsLeft = game?.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - now) / 1000)) : 0;
  const localPlayer = players.find((player) => player.id === sessionId);
  const leadingTeam = adventure.veilInfluence === adventure.emberInfluence
    ? null
    : adventure.veilInfluence > adventure.emberInfluence ? "veil" : "ember";

  useEffect(() => {
    if (activeHand[0]) setSelectedCard(activeHand[0].id);
  }, [activePlayer?.id, game?.completedTurns]);

  useEffect(() => {
    if (!activeCard || !activePlayer) return;
    if (activeCard.target === "self" || activeCard.target === "none") setTargetPlayerId(activePlayer.id);
    else {
      const target = players.find((player) => activeCard.target === "enemy" ? player.hero.team !== activePlayer.hero.team : activeCard.target === "ally" ? player.hero.team === activePlayer.hero.team : true);
      setTargetPlayerId(target?.id ?? activePlayer.id);
    }
  }, [activeCard?.id, activePlayer?.id, players]);

  useEffect(() => {
    if (phase !== "game" || game?.ended) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [phase, game?.ended]);

  useEffect(() => {
    if (!players.length || !localPlayer) {
      setSelectedPlayerId(null);
      return;
    }
    if (!players.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(players.find((player) => player.id === sessionId)?.id ?? players[0].id);
    }
  }, [players, selectedPlayerId, sessionId, localPlayer]);

  const joinPlayer = () => {
    const name = playerName.trim();
    if (status !== "connected" || !sessionId) {
      setLobbyError("The shared room is still connecting. Try again in a moment.");
      return;
    }
    if (players.some((player) => player.id === sessionId)) {
      setLobbyError("This browser already controls a joined player session.");
      return;
    }
    if (players.length >= 10) {
      setLobbyError("This lobby already has 10 players. A player must leave before another session can join.");
      return;
    }
    if (!name) {
      setLobbyError("Enter a player name before pressing Join.");
      return;
    }
    if (players.some((player) => player.displayName.toLowerCase() === name.toLowerCase())) {
      setLobbyError("That player name is already joined. Use a different name for each session.");
      return;
    }
    if (players.some((player) => player.hero.name === selectedHeroName)) {
      setLobbyError("That character has already been chosen. Pick another hero.");
      return;
    }

    const veilCount = players.filter((player) => player.hero.team === "veil").length;
    const emberCount = players.length - veilCount;
    const balancedTeamSeat = veilCount <= emberCount ? 0 : 1;
    const session = createPlayerSession(name, balancedTeamSeat, selectedHeroName, sessionId);
    if (!send({ type: "join", player: session })) return;
    setSelectedPlayerId(session.id);
    setPlayerName("");
    setLobbyError("");
  };

  const toggleReady = (id: string) => {
    const player = players.find((current) => current.id === id);
    send({ type: "ready", sessionId: id, ready: !player?.ready });
  };

  const leaveLobby = (id: string) => {
    send({ type: "leave", sessionId: id });
    setSelectedPlayerId((current) => current === id ? null : current);
    setLobbyError("");
  };

  const enterGame = () => {
    if (players.length < 2 || !players.every((player) => player.ready)) {
      setLobbyError("Every joined player must be ready before the adventure can start.");
      return;
    }
    const nextGame = createInitialGame(players, createAdventure(), 30);
    send({ type: "start", game: nextGame });
  };

  const castDie = () => {
    if (rolling || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || status !== "connected") return;
    setRolling(true);
    let ticks = 0;
    const timer = window.setInterval(() => {
      setAnimatedRoll(Math.floor(Math.random() * 20) + 1);
      ticks += 1;
      if (ticks >= 9) {
        window.clearInterval(timer);
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        const nextGame = resolveCardTurn(game, players, selectedCard, targetPlayerId, finalRoll);
        send({ type: "game:update", game: nextGame });
        setAnimatedRoll(finalRoll);
        setRolling(false);
      }
    }, 85);
  };

  const refreshStory = () => {
    if (!game || activePlayer?.id !== sessionId || status !== "connected") return;
    send({ type: "game:update", game: { ...game, adventure: nextStory(adventure) } });
  };

  const returnToLobby = () => {
    send({ type: "return:lobby" });
  };

  const endGame = () => send({ type: "end-game", sessionId });
  const leaveGame = () => send({ type: "leave-game", sessionId });

  return (
    <main className={`game-shell ${adventure.realm.sceneClass}`}>
      <div className="world-backdrop" />
      <div className="grain" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Crown size={20} /></div>
          <div><strong>SHATTERED OATH</strong><span>Rival hands. One fate.</span></div>
        </div>
        {phase === "game" ? (
          <nav className="run-status" aria-label="Run status">
            <div><span className="eyebrow">CHAPTER</span><strong>{adventure.chapter} <i>/ {adventure.maxChapters}</i></strong></div>
            <div className="chapter-pips">
              {Array.from({ length: adventure.maxChapters }).map((_, index) => <i key={index} className={index < adventure.chapter ? "complete" : ""} />)}
            </div>
            <div className={`turn-clock ${secondsLeft <= 10 ? "urgent" : ""}`}><Clock3 size={14} /> {secondsLeft}s turn</div>
            <div className="time-left">~{Math.max(4, Math.ceil(remainingTurns * 0.55))} min</div>
          </nav>
        ) : (
          <div className="lobby-top-status"><Users size={16} /> {players.length}/10 joined · {players.filter((player) => player.ready).length} ready</div>
        )}
        <div className="top-actions">
          <button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label="Toggle sound" title="Toggle sound">
            {soundOn ? <Volume2 size={18} /> : <AudioLines size={18} />}
          </button>
          <button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16} /> How to play</button>
          {phase === "game" && localPlayer && <button className="text-button leave-game-control" onClick={leaveGame}><LogOut size={16} /> Leave game</button>}
          {phase === "game" && localPlayer && !runComplete && <button className="text-button end-game-control" onClick={endGame}><Octagon size={16} /> End game</button>}
          {phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open party"><Users size={18} /></button>}
        </div>
      </header>

      {phase === "lobby" ? (
        <Lobby
          players={players}
          playerName={playerName}
          error={lobbyError || roomError}
          selectedPlayerId={selectedPlayerId}
          localSessionId={sessionId}
          connectionStatus={status}
          characterOptions={characterOptions}
          selectedHeroName={selectedHeroName}
          onNameChange={(name) => { setPlayerName(name); setLobbyError(""); clearError(); }}
          onJoin={joinPlayer}
          onSelectPlayer={setSelectedPlayerId}
          onToggleReady={toggleReady}
          onLeave={leaveLobby}
          onEnterGame={enterGame}
          onHeroSelect={(heroName) => { setSelectedHeroName(heroName); setLobbyError(""); }}
        />
      ) : (
        <div className="game-layout">
          <div className={mobileParty ? "mobile-rail open" : "mobile-rail"}>
            <button className="mobile-close icon-button" onClick={() => setMobileParty(false)} aria-label="Close party"><X size={17} /></button>
            <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} />
          </div>
          <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} />

          <section className="world-stage">
            <div className="realm-meta">
              <div><span className="eyebrow">{adventure.realm.region} · {adventure.realm.weather}</span><h1>{adventure.realm.name}</h1></div>
              <span className="seed-button">Seed {adventure.seed}</span>
            </div>
            <div className="stage-spacer" />

            <section className="story-card">
              <div className="story-kicker">
                <span><BookOpen size={15} /> CHAPTER {adventure.chapter} · {activePlayer?.displayName.toUpperCase()}&apos;S TURN</span>
                <button className="icon-button" onClick={refreshStory} disabled={activePlayer?.id !== sessionId || status !== "connected"} aria-label="Refresh story event" title="Only the current player can refresh the story"><RefreshCw size={15} /></button>
              </div>
              <h2>{adventure.event}</h2>
              <p>{adventure.story}</p>
              <button className="story-link" onClick={() => setShowStory(true)}>Read the chronicle <ChevronRight size={15} /></button>
            </section>

            {outcome && (
              <div className={`outcome-toast ${outcome.success ? "success" : "failure"}`}>
                {outcome.success ? <Check size={18} /> : <Skull size={18} />}
                <div><strong>{outcome.label}</strong><span>{outcome.detail ?? `Total ${outcome.total} against ${outcome.target}`}</span></div>
              </div>
            )}

            <div className="encounter-row">
              <section className="objective-card">
                <div className="objective-icon"><LockKeyhole size={22} /></div>
                <div><span className="eyebrow">SHARED OATH</span><strong>{adventure.realm.objective}</strong><small>Every player acts once per chapter. Fail together if doom reaches 100.</small></div>
              </section>
              <DiceRoller roll={rolling ? animatedRoll : roll} rolling={rolling} target={adventure.target} bonus={activeCard?.bonus ?? 0} onRoll={castDie} disabled={activePlayer?.id !== sessionId || status !== "connected" || runComplete} disabledLabel={runComplete ? "Adventure ended" : status !== "connected" ? "Reconnecting…" : `Waiting for ${activePlayer?.displayName ?? "player"}`} />
            </div>

            <section className="hand-zone">
              <div className="hand-heading">
                <div><span className="eyebrow">{activePlayer?.displayName.toUpperCase()}&apos;S HAND</span><strong>Play one card, choose a target, then roll</strong></div>
                <span><Hand size={14} /> {activeRunState?.hand.length ?? 0} hand · {activeRunState?.drawPile.length ?? 0} draw · <Trash2 size={14} /> {activeRunState?.discardPile.length ?? 0} graveyard</span>
              </div>
              {activeCard && !["none", "self"].includes(activeCard.target) && <label className="target-picker"><Target size={16} /><span>Choose {activeCard.target} target</span><select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)} disabled={activePlayer?.id !== sessionId}>{targetOptions.map((player) => <option value={player.id} key={player.id}>{player.displayName} · {player.hero.name} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</option>)}</select></label>}
              <div className="action-hand five-cards">
                {activeHand.map((card) => (
                  <button className={`action-card ${selectedCard === card.id ? "selected" : ""}`} key={card.id} onClick={() => setSelectedCard(card.id)} disabled={activePlayer?.id !== sessionId || runComplete}>
                    <div className={`card-sigil ${card.type.toLowerCase()}`}>
                      {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                    </div>
                    <span>{card.unique ? "Unique" : "Common"} · {card.type} · +{card.bonus}</span><strong>{card.name}</strong><p>{card.description}</p><small>{card.effect} {card.value || ""} · {card.target} · Risk {card.risk || "none"}</small>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <aside className="rival-panel">
            <section className="doom-card">
              <div className="doom-title"><span><Skull size={15} /> WORLD DOOM</span><strong>{adventure.worldDoom}%</strong></div>
              <div className="doom-track"><i style={{ width: `${adventure.worldDoom}%` }} /></div><small>The realm falls at 100</small>
            </section>
            <section className="current-turn-card">
              <span className="eyebrow">CURRENT PLAYER</span>
              <div><div className="portrait" style={{ "--hero-color": activePlayer?.hero.color } as React.CSSProperties}>{activePlayer?.hero.initials}</div><div><strong>{activePlayer?.displayName}</strong><span>{activePlayer?.hero.name} · {activePlayer?.hero.role}</span></div></div>
              <small>{secondsLeft}s remaining · Next: {players[(activePlayerIndex + 1) % players.length]?.displayName}</small>
            </section>
            <section className="rivalry">
              <div className="panel-heading"><div><span className="eyebrow">RIVAL OATHS</span><strong>One realm, two winners</strong></div><Shield size={17} /></div>
              {(["veil", "ember"] as TeamId[]).map((team) => {
                const score = team === "veil" ? adventure.veilInfluence : adventure.emberInfluence;
                return (
                  <article className={`faction-card ${team}`} key={team}>
                    <div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18} /> : <Flame size={18} />}</div><div><span>{teamCopy[team].title}</span><strong>{score} influence</strong></div>{leadingTeam === team && <Crown size={15} />}</div>
                    <p>{teamCopy[team].objective}</p><div className="influence-track"><i style={{ width: `${Math.min(100, score * 3)}%` }} /></div>
                  </article>
                );
              })}
            </section>
            <button className="chat-button"><MessageCircle size={17} /> Party council <span>{players.length}</span></button>
          </aside>
        </div>
      )}

      {(showGuide || showStory || runComplete) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <button className="modal-close icon-button" onClick={() => { setShowGuide(false); setShowStory(false); }} aria-label="Close"><X size={18} /></button>
            {runComplete ? (
              <><span className="eyebrow">THE OATH IS SETTLED</span><h2>{adventure.worldDoom < 100 ? "The adventure has ended." : "The realm remembers your failure."}</h2><p className="modal-lead">{game?.endReason ?? (adventure.veilInfluence === adventure.emberInfluence ? "Neither banner could eclipse the other." : `${adventure.veilInfluence > adventure.emberInfluence ? "Veilbound" : "Embercourt"} claims the final word.`)}</p><button className="primary-button" onClick={returnToLobby}><RefreshCw size={17} /> Return to lobby</button></>
            ) : showGuide ? (
              <><span className="eyebrow">A 30–45 MINUTE DECK ROGUELIKE</span><h2>Choose, interact, cooperate, and compete.</h2><div className="guide-grid"><div><Users size={22} /><strong>Choose a unique hero</strong><p>Pick before joining. Every hero has a different 15-card deck: five character cards and ten common actions.</p></div><div><Check size={22} /><strong>Ready, then enter</strong><p>After at least two players join and everyone presses Ready, any player can enter the game.</p></div><div><Dices size={22} /><strong>Play from your hand</strong><p>Choose one of five cards and a target. Played cards enter the graveyard; when the draw pile empties, the graveyard reshuffles.</p></div><div><HeartHandshake size={22} /><strong>Heal, guard, or fight</strong><p>Help allies, attack rival-team heroes, protect anyone with shields, and still keep World Doom below 100. Idle turns auto-pass after 30 seconds.</p></div></div></>
            ) : (
              <><span className="eyebrow">FROM THE COMPANY CHRONICLE</span><h2>{adventure.realm.name}</h2><p className="modal-lead">{adventure.story}</p><div className="chronicle-note"><Eye size={19} /><div><strong>The choice beneath the choice</strong><p>{adventure.realm.threat} is watching the current player. A Wit skill may reveal why.</p></div></div></>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
