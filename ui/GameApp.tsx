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
  const [dismissedOutcomeKey, setDismissedOutcomeKey] = useState("");
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
  const outcomeKey = outcome ? `${game?.turnStartedAt ?? 0}-${outcome.kind ?? "legacy"}-${outcome.label}` : "";
  const showOutcomePanel = Boolean(
    outcome
    && (outcome.kind === "card" || outcome.kind === "timeout")
    && outcomeKey !== dismissedOutcomeKey
    && !runComplete
  );
  const nextPlayer = players[activePlayerIndex];
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
  const removePlayer = (targetSessionId: string) => {
    const target = players.find((player) => player.id === targetSessionId);
    if (!localPlayer || !target || targetSessionId === sessionId) return;
    if (!window.confirm(`Remove ${target.displayName} from the ${phase === "game" ? "game" : "lobby"}?`)) return;
    send({ type: "remove-player", sessionId, targetSessionId });
    setSelectedPlayerId((current) => current === targetSessionId ? null : current);
  };

  const closeModal = () => {
    if (showGuide) {
      setShowGuide(false);
      return;
    }
    if (showStory) {
      setShowStory(false);
      return;
    }
    if (showOutcomePanel) setDismissedOutcomeKey(outcomeKey);
  };

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
          onRemovePlayer={removePlayer}
          onEnterGame={enterGame}
          onHeroSelect={(heroName) => { setSelectedHeroName(heroName); setLobbyError(""); }}
        />
      ) : (
        <div className="game-layout">
          <div className={mobileParty ? "mobile-rail open" : "mobile-rail"}>
            <button className="mobile-close icon-button" onClick={() => setMobileParty(false)} aria-label="Close party"><X size={17} /></button>
            <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} />
          </div>
          <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} />

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
                  <button className={`action-card ${card.unique ? "hero-special-card" : "common-action-card"} ${selectedCard === card.id ? "selected" : ""}`} style={{ "--hero-color": activePlayer?.hero.color } as React.CSSProperties} key={card.id} onClick={() => setSelectedCard(card.id)} disabled={activePlayer?.id !== sessionId || runComplete}>
                    {card.unique && <span className="special-skill-banner"><Crown size={12} /> {activePlayer?.hero.name} special</span>}
                    <div className={`card-sigil ${card.type.toLowerCase()}`}>
                      {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                    </div>
                    <span>{card.unique ? "Character skill" : "Common card"} · {card.type} · +{card.bonus}</span><strong>{card.name}</strong><p>{card.description}</p><small>{card.effect} {card.value || ""} · {card.target} · Risk {card.risk || "none"}</small>
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

      {(showGuide || showStory || runComplete || showOutcomePanel) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${showOutcomePanel && !showGuide && !showStory ? "resolution-card" : ""}`}>
            <button className="modal-close icon-button" onClick={closeModal} aria-label="Close"><X size={18} /></button>
            {runComplete ? (
              <><span className="eyebrow">THE OATH IS SETTLED</span><h2>{adventure.worldDoom < 100 ? "The adventure has ended." : "The realm remembers your failure."}</h2><p className="modal-lead">{game?.endReason ?? (adventure.veilInfluence === adventure.emberInfluence ? "Neither banner could eclipse the other." : `${adventure.veilInfluence > adventure.emberInfluence ? "Veilbound" : "Embercourt"} claims the final word.`)}</p><button className="primary-button" onClick={returnToLobby}><RefreshCw size={17} /> Return to lobby</button></>
            ) : showGuide ? (
              <div className="tutorial-scroll">
                <span className="eyebrow">A 30–45 MINUTE DECK ROGUELIKE</span>
                <h2>How to survive the Shattered Oath</h2>
                <p className="modal-lead">Two rival teams share one endangered realm. Cooperate to keep World Doom below 100, but earn more Influence than the other banner to claim the final victory.</p>

                <section className="tutorial-section">
                  <h3><Users size={20} /> Before the adventure</h3>
                  <div className="tutorial-steps">
                    <article><b>1</b><div><strong>Choose a hero</strong><p>Every hero may be claimed once. Read their role, strength, weakness, party impact, and five gold character cards before joining.</p></div></article>
                    <article><b>2</b><div><strong>Join and ready</strong><p>Enter a name and press Join. The game needs at least two players; when everyone is Ready, any joined player can press Enter the game.</p></div></article>
                    <article><b>3</b><div><strong>Learn your banner</strong><p>Heroes are assigned to Veilbound or Embercourt. Rival players can attack each other, but every team loses if World Doom reaches 100.</p></div></article>
                  </div>
                </section>

                <section className="tutorial-section">
                  <h3><Dices size={20} /> What happens on your turn</h3>
                  <div className="tutorial-steps">
                    <article><b>1</b><div><strong>Choose one card</strong><p>Your hand holds five cards. Gold cards are unique to your hero; dark cards are common actions shared by every deck.</p></div></article>
                    <article><b>2</b><div><strong>Choose a legal target</strong><p>Heal and guard your team, damage an enemy, or play a check/support card on the world. The target selector shows who the card can affect.</p></div></article>
                    <article><b>3</b><div><strong>Roll the d20</strong><p>Your result is d20 + the card bonus. Meet or beat the encounter Target to succeed. A detailed result panel then explains the card, target, roll, Doom, and Influence changes.</p></div></article>
                    <article><b>4</b><div><strong>Draw a replacement</strong><p>The played card enters your graveyard and a new one is drawn. When the draw pile is empty, the graveyard reshuffles so every card can return.</p></div></article>
                  </div>
                </section>

                <section className="tutorial-section">
                  <h3><Target size={20} /> Read a card</h3>
                  <div className="stat-guide">
                    <article className="might"><Swords size={20} /><strong>Might</strong><p>Physical pressure: damage, challenges, and sturdy protection. Might does not grant a hidden team bonus.</p></article>
                    <article className="wit"><Eye size={20} /><strong>Wit</strong><p>Precision and control: safer checks, scouting, tricks, and shield-piercing attacks.</p></article>
                    <article className="spirit"><Sparkles size={20} /><strong>Spirit</strong><p>Resolve and fellowship: healing, guarding allies, reducing Doom, and supporting the company.</p></article>
                  </div>
                  <div className="card-rules">
                    <p><strong>Bonus</strong> is added to the d20. Higher is more reliable.</p>
                    <p><strong>Risk</strong> controls how much extra Doom a failed card creates. Risk does nothing when the roll succeeds.</p>
                    <p><strong>Effect and value</strong> show whether the card heals, guards, damages, supports, or makes a world check—and how powerful it is.</p>
                  </div>
                </section>

                <section className="tutorial-section warning-section">
                  <h3><Clock3 size={20} /> The 30-second turn clock</h3>
                  <p>If a player does not act before the clock reaches zero, their turn is automatically passed, World Doom rises by 3, and everyone sees a timeout panel before the next player continues.</p>
                </section>
              </div>
            ) : showStory ? (
              <><span className="eyebrow">FROM THE COMPANY CHRONICLE</span><h2>{adventure.realm.name}</h2><p className="modal-lead">{adventure.story}</p><div className="chronicle-note"><Eye size={19} /><div><strong>The choice beneath the choice</strong><p>{adventure.realm.threat} is watching the current player. A Wit skill may reveal why.</p></div></div></>
            ) : outcome?.kind === "timeout" ? (
              <div className="resolution-content timeout-resolution">
                <div className="resolution-hero timeout"><Clock3 size={34} /></div>
                <span className="eyebrow">TURN EXPIRED</span>
                <h2>{outcome.actorName ?? "A player"}&apos;s turn was passed</h2>
                <p className="modal-lead">{outcome.detail}</p>
                <div className="resolution-metrics">
                  <div><span>World Doom</span><strong className="negative">+{outcome.doomChange ?? 3}</strong></div>
                  <div><span>Next player</span><strong>{nextPlayer?.displayName ?? "—"}</strong></div>
                </div>
                <button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue adventure <ChevronRight size={17} /></button>
              </div>
            ) : outcome ? (
              <div className="resolution-content">
                <div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34} /> : <Skull size={34} />}</div>
                <span className="eyebrow">ACTION RESOLVED</span>
                <h2>{outcome.actorName ?? "A hero"} played {outcome.cardName ?? "a card"}</h2>
                <div className="resolution-chips">
                  {outcome.cardType && <span>{outcome.cardType}</span>}
                  {outcome.effect && <span>{outcome.effect}</span>}
                  {outcome.targetName && <span>Target: {outcome.targetName}</span>}
                </div>
                <div className="resolution-equation">
                  <span><small>d20</small><strong>{outcome.roll ?? 0}</strong></span>
                  <i>+</i>
                  <span><small>card bonus</small><strong>{outcome.bonus ?? 0}</strong></span>
                  <i>=</i>
                  <span className={outcome.success ? "success" : "failure"}><small>total vs {outcome.target}</small><strong>{outcome.total}</strong></span>
                </div>
                <strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "Success" : `Failed — Risk ${outcome.risk ?? 0}`}</strong>
                <p className="modal-lead">{outcome.detail}</p>
                <div className="resolution-metrics">
                  <div><span>World Doom</span><strong className={(outcome.doomChange ?? 0) > 0 ? "negative" : "positive"}>{(outcome.doomChange ?? 0) > 0 ? "+" : ""}{outcome.doomChange ?? 0}</strong></div>
                  <div><span>Team Influence</span><strong className="positive">+{outcome.influenceChange ?? 0}</strong></div>
                  <div><span>Next player</span><strong>{nextPlayer?.displayName ?? "—"}</strong></div>
                </div>
                <button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue adventure <ChevronRight size={17} /></button>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
