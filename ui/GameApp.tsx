"use client";

import {
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Crown,
  Dices,
  Eye,
  Flame,
  HeartHandshake,
  LockKeyhole,
  Menu,
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
import { useMemo, useState } from "react";
import { ACTION_CARDS } from "@/backend/game/catalog";
import { createAdventure, createParty, nextStory, resolveAction } from "@/backend/game/engine";
import type { Adventure, Hero, TeamId } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { PartyRail } from "./components/PartyRail";

type Outcome = { success: boolean; total: number; label: string } | null;

const teamCopy: Record<TeamId, { title: string; objective: string }> = {
  veil: { title: "Veilbound", objective: "Preserve three forbidden truths until the final gate." },
  ember: { title: "Embercourt", objective: "Claim the Warden's crown and end with the most influence." }
};

export default function GameApp() {
  const [adventure, setAdventure] = useState<Adventure>(() => createAdventure("MOON42"));
  const [heroes, setHeroes] = useState<Hero[]>(() => createParty(6));
  const [selectedCard, setSelectedCard] = useState(ACTION_CARDS[0].id);
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [mobileParty, setMobileParty] = useState(false);

  const activeCard = useMemo(
    () => ACTION_CARDS.find((card) => card.id === selectedCard) ?? ACTION_CARDS[0],
    [selectedCard]
  );
  const leadingTeam = adventure.veilInfluence === adventure.emberInfluence
    ? null
    : adventure.veilInfluence > adventure.emberInfluence ? "veil" : "ember";
  const runComplete = adventure.chapter === adventure.maxChapters && outcome !== null;

  const addHero = () => {
    if (heroes.length < 10) setHeroes(createParty(heroes.length + 1));
  };

  const copyRoom = async () => {
    await navigator.clipboard?.writeText(`SHATTERED OATH · ROOM ${adventure.seed}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const refreshAdventure = async () => {
    setOutcome(null);
    setRoll(null);
    try {
      const response = await fetch("/api/adventure", { cache: "no-store" });
      const data = await response.json();
      setAdventure(data.adventure);
      setHeroes(data.party);
    } catch {
      setAdventure(createAdventure());
      setHeroes(createParty(6));
    }
  };

  const castDie = () => {
    if (rolling) return;
    setRolling(true);
    setOutcome(null);
    let ticks = 0;
    const timer = window.setInterval(() => {
      setRoll(Math.floor(Math.random() * 20) + 1);
      ticks += 1;
      if (ticks >= 9) {
        window.clearInterval(timer);
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        const resolved = resolveAction(adventure, selectedCard, finalRoll);
        setRoll(finalRoll);
        setAdventure(resolved.adventure);
        setOutcome({
          success: resolved.success,
          total: resolved.total,
          label: resolved.success ? "The company prevails" : "The realm takes its due"
        });
        setRolling(false);
      }
    }, 85);
  };

  const restartRun = () => {
    setAdventure(createAdventure());
    setHeroes(createParty(6 + Math.floor(Math.random() * 3)));
    setOutcome(null);
    setRoll(null);
    setSelectedCard(ACTION_CARDS[Math.floor(Math.random() * ACTION_CARDS.length)].id);
  };

  return (
    <main className={`game-shell ${adventure.realm.sceneClass}`}>
      <div className="world-backdrop" />
      <div className="grain" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Crown size={20} /></div>
          <div>
            <strong>SHATTERED OATH</strong>
            <span>Rival hands. One fate.</span>
          </div>
        </div>
        <nav className="run-status" aria-label="Run status">
          <div>
            <span className="eyebrow">CHAPTER</span>
            <strong>{adventure.chapter} <i>/ {adventure.maxChapters}</i></strong>
          </div>
          <div className="chapter-pips">
            {Array.from({ length: adventure.maxChapters }).map((_, index) => (
              <i key={index} className={index < adventure.chapter ? "complete" : ""} />
            ))}
          </div>
          <div className="time-left"><Clock3 size={14} /> ~{Math.max(6, 38 - adventure.chapter * 6)} min</div>
        </nav>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label="Toggle sound" title="Toggle sound">
            {soundOn ? <Volume2 size={18} /> : <AudioLines size={18} />}
          </button>
          <button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16} /> How to play</button>
          <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open party"><Users size={18} /></button>
        </div>
      </header>

      <div className="game-layout">
        <div className={mobileParty ? "mobile-rail open" : "mobile-rail"}>
          <button className="mobile-close icon-button" onClick={() => setMobileParty(false)} aria-label="Close party"><X size={17} /></button>
          <PartyRail heroes={heroes} onAdd={addHero} />
        </div>
        <PartyRail heroes={heroes} onAdd={addHero} />

        <section className="world-stage">
          <div className="realm-meta">
            <div>
              <span className="eyebrow">{adventure.realm.region} · {adventure.realm.weather}</span>
              <h1>{adventure.realm.name}</h1>
            </div>
            <button className="seed-button" onClick={refreshAdventure} title="Generate a new realm">
              <RefreshCw size={15} />
              Seed {adventure.seed}
            </button>
          </div>

          <div className="stage-spacer" />

          <section className="story-card">
            <div className="story-kicker">
              <span><BookOpen size={15} /> CHAPTER {adventure.chapter} · THE CROSSING</span>
              <button className="icon-button" onClick={() => setAdventure(nextStory(adventure))} aria-label="Refresh story event" title="Refresh story event"><RefreshCw size={15} /></button>
            </div>
            <h2>{adventure.event}</h2>
            <p>{adventure.story}</p>
            <button className="story-link" onClick={() => setShowStory(true)}>
              Read the chronicle <ChevronRight size={15} />
            </button>
          </section>

          {outcome && (
            <div className={`outcome-toast ${outcome.success ? "success" : "failure"}`}>
              {outcome.success ? <Check size={18} /> : <Skull size={18} />}
              <div><strong>{outcome.label}</strong><span>Total {outcome.total} against {adventure.target}</span></div>
            </div>
          )}

          <div className="encounter-row">
            <section className="objective-card">
              <div className="objective-icon"><LockKeyhole size={22} /></div>
              <div>
                <span className="eyebrow">SHARED OATH</span>
                <strong>{adventure.realm.objective}</strong>
                <small>Fail together if doom reaches 100.</small>
              </div>
            </section>
            <DiceRoller roll={roll} rolling={rolling} target={adventure.target} bonus={activeCard.bonus} onRoll={castDie} />
          </div>

          <section className="hand-zone">
            <div className="hand-heading">
              <div>
                <span className="eyebrow">CHOOSE YOUR APPROACH</span>
                <strong>Your card shapes both teams&apos; fate</strong>
              </div>
              <span><Dices size={14} /> Select one, then cast</span>
            </div>
            <div className="action-hand">
              {ACTION_CARDS.slice(0, 4).map((card) => (
                <button
                  className={`action-card ${selectedCard === card.id ? "selected" : ""}`}
                  key={card.id}
                  onClick={() => setSelectedCard(card.id)}
                >
                  <div className={`card-sigil ${card.type.toLowerCase()}`}>
                    {card.type === "Might" ? <Swords size={18} /> : card.type === "Wit" ? <Eye size={18} /> : <Sparkles size={18} />}
                  </div>
                  <span>{card.type} · +{card.bonus}</span>
                  <strong>{card.name}</strong>
                  <p>{card.description}</p>
                  <small>Risk {card.risk || "none"}</small>
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="rival-panel">
          <section className="doom-card">
            <div className="doom-title"><span><Skull size={15} /> WORLD DOOM</span><strong>{adventure.worldDoom}%</strong></div>
            <div className="doom-track"><i style={{ width: `${adventure.worldDoom}%` }} /></div>
            <small>The realm falls at 100</small>
          </section>

          <section className="rivalry">
            <div className="panel-heading">
              <div><span className="eyebrow">RIVAL OATHS</span><strong>One realm, two winners</strong></div>
              <Shield size={17} />
            </div>
            {(["veil", "ember"] as TeamId[]).map((team) => {
              const score = team === "veil" ? adventure.veilInfluence : adventure.emberInfluence;
              return (
                <article className={`faction-card ${team}`} key={team}>
                  <div className="faction-title">
                    <div className="faction-seal">{team === "veil" ? <Eye size={18} /> : <Flame size={18} />}</div>
                    <div><span>{teamCopy[team].title}</span><strong>{score} influence</strong></div>
                    {leadingTeam === team && <Crown size={15} />}
                  </div>
                  <p>{teamCopy[team].objective}</p>
                  <div className="influence-track"><i style={{ width: `${Math.min(100, score * 7)}%` }} /></div>
                </article>
              );
            })}
          </section>

          <section className="room-card">
            <div>
              <span className="eyebrow">PRIVATE ROOM</span>
              <strong>{adventure.seed}</strong>
            </div>
            <button className="icon-button" onClick={copyRoom} aria-label="Copy room code" title="Copy room code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <small>{copied ? "Copied to your banner" : "Invite up to 10 oathbound"}</small>
          </section>

          <button className="chat-button"><MessageCircle size={17} /> Party council <span>3</span></button>
        </aside>
      </div>

      {(showGuide || showStory || runComplete) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <button className="modal-close icon-button" onClick={() => { setShowGuide(false); setShowStory(false); }} aria-label="Close"><X size={18} /></button>
            {runComplete ? (
              <>
                <span className="eyebrow">THE OATH IS SETTLED</span>
                <h2>{adventure.worldDoom < 100 ? "The realm survives." : "The realm remembers your failure."}</h2>
                <p className="modal-lead">
                  {adventure.veilInfluence === adventure.emberInfluence
                    ? "Neither banner could eclipse the other. For one rare dawn, victory is shared."
                    : `${adventure.veilInfluence > adventure.emberInfluence ? "Veilbound" : "Embercourt"} claims the final word—yet every hero was needed to reach it.`}
                </p>
                <button className="primary-button" onClick={restartRun}><RefreshCw size={17} /> Begin a different adventure</button>
              </>
            ) : showGuide ? (
              <>
                <span className="eyebrow">A FIVE-CHAPTER ROGUELIKE</span>
                <h2>Cooperate to survive. Compete to be remembered.</h2>
                <div className="guide-grid">
                  <div><HeartHandshake size={22} /><strong>Survive together</strong><p>All players lose if World Doom reaches 100. Share skills and choose safer cards when the realm is close to breaking.</p></div>
                  <div><Swords size={22} /><strong>Win for your banner</strong><p>Veilbound and Embercourt pursue different hidden goals. Successful choices create influence for both—but some favor one team.</p></div>
                  <div><Dices size={22} /><strong>Cards shape the roll</strong><p>Choose an approach, combine its bonus with a d20 roll, and beat the chapter target. Bigger rewards carry greater risk.</p></div>
                  <div><RefreshCw size={22} /><strong>No run repeats</strong><p>Realm, heroes, weather, events, skills and objectives reroll whenever a new oath begins.</p></div>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">FROM IONE MIRE&apos;S CHRONICLE</span>
                <h2>{adventure.realm.name}</h2>
                <p className="modal-lead">{adventure.story}</p>
                <div className="chronicle-note">
                  <Eye size={19} />
                  <div><strong>The choice beneath the choice</strong><p>{adventure.realm.threat} is watching the party&apos;s strongest hero. A Wit action may reveal why.</p></div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
