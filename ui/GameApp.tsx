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
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Users,
  Volume2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createAdventure, createPlayerSession, nextStory, resolveAction } from "@/backend/game/engine";
import type { Adventure, PlayerSession, TeamId } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";

type Outcome = { success: boolean; total: number; target: number; label: string } | null;
type GamePhase = "lobby" | "game";

const teamCopy: Record<TeamId, { title: string; objective: string }> = {
  veil: { title: "Veilbound", objective: "Preserve three forbidden truths until the final gate." },
  ember: { title: "Embercourt", objective: "Claim the Warden's crown and end with the most influence." }
};

export default function GameApp() {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<PlayerSession[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [lobbyError, setLobbyError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [adventure, setAdventure] = useState<Adventure>(() => createAdventure("MOON42"));
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [completedTurns, setCompletedTurns] = useState(0);
  const [selectedCard, setSelectedCard] = useState("");
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [mobileParty, setMobileParty] = useState(false);

  const activePlayer = players[activePlayerIndex];
  const activeDeck = activePlayer?.skillDeck ?? [];
  const activeCard = useMemo(
    () => activeDeck.find((card) => card.id === selectedCard) ?? activeDeck[0],
    [activeDeck, selectedCard]
  );
  const maxTurns = adventure.maxChapters * Math.max(1, players.length);
  const remainingTurns = Math.max(0, maxTurns - completedTurns);
  const runComplete = phase === "game" && completedTurns >= maxTurns && outcome !== null;
  const leadingTeam = adventure.veilInfluence === adventure.emberInfluence
    ? null
    : adventure.veilInfluence > adventure.emberInfluence ? "veil" : "ember";

  useEffect(() => {
    const allReady = players.length >= 2 && players.every((player) => player.ready);
    if (phase !== "lobby" || !allReady) return;

    const timer = window.setTimeout(() => {
      const nextAdventure = createAdventure();
      nextAdventure.maxChapters = Math.max(4, Math.ceil(36 / players.length));
      setAdventure(nextAdventure);
      setActivePlayerIndex(0);
      setCompletedTurns(0);
      setSelectedCard(players[0].skillDeck[0].id);
      setRoll(null);
      setOutcome(null);
      setPhase("game");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [phase, players]);

  const joinPlayer = () => {
    const name = playerName.trim();
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

    const veilCount = players.filter((player) => player.hero.team === "veil").length;
    const emberCount = players.length - veilCount;
    const balancedTeamSeat = veilCount <= emberCount ? 0 : 1;
    const session = createPlayerSession(name, balancedTeamSeat, players.map((player) => player.hero.name));
    setPlayers((current) => [...current, session]);
    setSelectedPlayerId(session.id);
    setPlayerName("");
    setLobbyError("");
  };

  const toggleReady = (id: string) => {
    setPlayers((current) => current.map((player) => player.id === id ? { ...player, ready: !player.ready } : player));
  };

  const leaveLobby = (id: string) => {
    setPlayers((current) => current.filter((player) => player.id !== id));
    setSelectedPlayerId((current) => current === id ? null : current);
    setLobbyError("");
  };

  const castDie = () => {
    if (rolling || !activePlayer || !activeCard || runComplete) return;
    setRolling(true);
    setOutcome(null);
    const targetAtRoll = adventure.target;
    let ticks = 0;
    const timer = window.setInterval(() => {
      setRoll(Math.floor(Math.random() * 20) + 1);
      ticks += 1;
      if (ticks >= 9) {
        window.clearInterval(timer);
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        const nextCompletedTurns = completedTurns + 1;
        const completesChapter = nextCompletedTurns % players.length === 0;
        const resolved = resolveAction(adventure, selectedCard, finalRoll, completesChapter, activeDeck);
        setRoll(finalRoll);
        setAdventure(resolved.adventure);
        setCompletedTurns(nextCompletedTurns);
        setOutcome({
          success: resolved.success,
          total: resolved.total,
          target: targetAtRoll,
          label: resolved.success ? `${activePlayer.displayName} prevails` : "The realm takes its due"
        });
        setRolling(false);

        if (nextCompletedTurns < maxTurns) {
          const nextIndex = (activePlayerIndex + 1) % players.length;
          setActivePlayerIndex(nextIndex);
          setSelectedCard(players[nextIndex].skillDeck[0].id);
        }
      }
    }, 85);
  };

  const returnToLobby = () => {
    setPlayers((current) => current.map((player) => ({ ...player, ready: false })));
    setSelectedPlayerId(players[0]?.id ?? null);
    setOutcome(null);
    setRoll(null);
    setPhase("lobby");
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
            <div className="time-left"><Clock3 size={14} /> ~{Math.max(4, Math.ceil(remainingTurns * 1.1))} min</div>
          </nav>
        ) : (
          <div className="lobby-top-status"><Users size={16} /> {players.length}/10 joined · {players.filter((player) => player.ready).length} ready</div>
        )}
        <div className="top-actions">
          <button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label="Toggle sound" title="Toggle sound">
            {soundOn ? <Volume2 size={18} /> : <AudioLines size={18} />}
          </button>
          <button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16} /> How to play</button>
          {phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open party"><Users size={18} /></button>}
        </div>
      </header>

      {phase === "lobby" ? (
        <Lobby
          players={players}
          playerName={playerName}
          error={lobbyError}
          selectedPlayerId={selectedPlayerId}
          onNameChange={(name) => { setPlayerName(name); setLobbyError(""); }}
          onJoin={joinPlayer}
          onSelectPlayer={setSelectedPlayerId}
          onToggleReady={toggleReady}
          onLeave={leaveLobby}
        />
      ) : (
        <div className="game-layout">
          <div className={mobileParty ? "mobile-rail open" : "mobile-rail"}>
            <button className="mobile-close icon-button" onClick={() => setMobileParty(false)} aria-label="Close party"><X size={17} /></button>
            <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} />
          </div>
          <PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} />

          <section className="world-stage">
            <div className="realm-meta">
              <div><span className="eyebrow">{adventure.realm.region} · {adventure.realm.weather}</span><h1>{adventure.realm.name}</h1></div>
              <span className="seed-button">Seed {adventure.seed}</span>
            </div>
            <div className="stage-spacer" />

            <section className="story-card">
              <div className="story-kicker">
                <span><BookOpen size={15} /> CHAPTER {adventure.chapter} · {activePlayer?.displayName.toUpperCase()}&apos;S TURN</span>
                <button className="icon-button" onClick={() => setAdventure(nextStory(adventure))} aria-label="Refresh story event" title="Refresh story event"><RefreshCw size={15} /></button>
              </div>
              <h2>{adventure.event}</h2>
              <p>{adventure.story}</p>
              <button className="story-link" onClick={() => setShowStory(true)}>Read the chronicle <ChevronRight size={15} /></button>
            </section>

            {outcome && (
              <div className={`outcome-toast ${outcome.success ? "success" : "failure"}`}>
                {outcome.success ? <Check size={18} /> : <Skull size={18} />}
                <div><strong>{outcome.label}</strong><span>Total {outcome.total} against {outcome.target}</span></div>
              </div>
            )}

            <div className="encounter-row">
              <section className="objective-card">
                <div className="objective-icon"><LockKeyhole size={22} /></div>
                <div><span className="eyebrow">SHARED OATH</span><strong>{adventure.realm.objective}</strong><small>Every player acts once per chapter. Fail together if doom reaches 100.</small></div>
              </section>
              <DiceRoller roll={roll} rolling={rolling} target={adventure.target} bonus={activeCard?.bonus ?? 0} onRoll={castDie} />
            </div>

            <section className="hand-zone">
              <div className="hand-heading">
                <div><span className="eyebrow">{activePlayer?.displayName.toUpperCase()}&apos;S SKILL DECK</span><strong>Choose one character skill for this turn</strong></div>
                <span><Dices size={14} /> Turn {(completedTurns % players.length) + 1} of {players.length}</span>
              </div>
              <div className="action-hand three-cards">
                {activeDeck.map((card) => (
                  <button className={`action-card ${selectedCard === card.id ? "selected" : ""}`} key={card.id} onClick={() => setSelectedCard(card.id)}>
                    <div className={`card-sigil ${card.type.toLowerCase()}`}>
                      {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                    </div>
                    <span>{card.type} · +{card.bonus}</span><strong>{card.name}</strong><p>{card.description}</p><small>Risk {card.risk || "none"}</small>
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
              <small>Next: {players[(activePlayerIndex + 1) % players.length]?.displayName}</small>
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
              <><span className="eyebrow">THE OATH IS SETTLED</span><h2>{adventure.worldDoom < 100 ? "The realm survives." : "The realm remembers your failure."}</h2><p className="modal-lead">{adventure.veilInfluence === adventure.emberInfluence ? "Neither banner could eclipse the other. For one rare dawn, victory is shared." : `${adventure.veilInfluence > adventure.emberInfluence ? "Veilbound" : "Embercourt"} claims the final word—yet every joined player was needed to reach it.`}</p><button className="primary-button" onClick={returnToLobby}><RefreshCw size={17} /> Return to lobby</button></>
            ) : showGuide ? (
              <><span className="eyebrow">A 30–45 MINUTE ROGUELIKE</span><h2>Join, ready, cooperate, and compete.</h2><div className="guide-grid"><div><Users size={22} /><strong>Join one session each</strong><p>Enter a unique player name. Every joined player receives a random hero and a personal three-card skill deck.</p></div><div><Check size={22} /><strong>Everyone must be ready</strong><p>The adventure starts automatically only after at least two players join and every player presses Ready.</p></div><div><Dices size={22} /><strong>Every player takes a turn</strong><p>A chapter advances after the whole company acts. The chapter count scales to keep each run near 36–40 total turns.</p></div><div><HeartHandshake size={22} /><strong>One survival, two victories</strong><p>Both teams lose if doom reaches 100, but only the banner with the strongest influence claims the final oath.</p></div></div></>
            ) : (
              <><span className="eyebrow">FROM THE COMPANY CHRONICLE</span><h2>{adventure.realm.name}</h2><p className="modal-lead">{adventure.story}</p><div className="chronicle-note"><Eye size={19} /><div><strong>The choice beneath the choice</strong><p>{adventure.realm.threat} is watching the current player. A Wit skill may reveal why.</p></div></div></>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
