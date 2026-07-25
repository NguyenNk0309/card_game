"use client";

import { AudioLines, Check, ChevronRight, CircleHelp, Clock3, Crown, Dices, Eye, Flame, Hand, Heart, History, LogOut, Octagon, RefreshCw, Shield, Skull, Sparkles, Swords, Target, Trash2, Users, Volume2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, resolveCardTurn } from "@/backend/game/engine";
import { describeCardImpact, getCardEffectLabel, getCardTargetLabel } from "@/shared/cardRules";
import type { TeamId } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { useRoomSocket } from "./hooks/useRoomSocket";

const teamName: Record<TeamId, string> = { veil: "Veilbound", ember: "Embercourt" };
const typeName = { Might: "Sức mạnh", Wit: "Mưu trí", Spirit: "Tinh thần" } as const;

export default function GameApp() {
  const { room, status, error: roomError, sessionId, send, clearError } = useRoomSocket();
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
  const [dismissedWorldEventId, setDismissedWorldEventId] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [mobileParty, setMobileParty] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { players, phase, game } = room;
  const adventure = game?.adventure ?? lobbyAdventure;
  const queuedActiveId = game?.turnOrder?.[0];
  const activePlayerIndex = queuedActiveId ? Math.max(0, players.findIndex((player) => player.id === queuedActiveId)) : game?.activePlayerIndex ?? 0;
  const activePlayer = players[activePlayerIndex];
  const activeState = activePlayer ? game?.playerStates[activePlayer.id] : undefined;
  const activeHand = activeState?.hand.map((id) => activePlayer.skillDeck.find((card) => card.id === id)).filter((card): card is NonNullable<typeof card> => Boolean(card)) ?? [];
  const activeCard = useMemo(() => activeHand.find((card) => card.id === selectedCard) ?? activeHand[0], [activeHand, selectedCard]);
  const localPlayer = players.find((player) => player.id === sessionId);
  const localState = localPlayer ? game?.playerStates[localPlayer.id] : undefined;
  const runComplete = phase === "game" && Boolean(game?.ended);
  const secondsLeft = game?.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - now) / 1000)) : 0;
  const outcome = game?.outcome ?? null;
  const outcomeKey = outcome ? `${game?.turnStartedAt ?? 0}-${outcome.label}` : "";
  const showOutcome = Boolean(outcome?.kind === "card" && outcome.actorName === localPlayer?.displayName && outcomeKey !== dismissedOutcomeKey && !runComplete);
  const showWorldEvent = Boolean(game?.worldEvent && game.worldEvent.id !== dismissedWorldEventId && !runComplete);
  const modalOpen = showGuide || showWorldEvent || showOutcome || runComplete;
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

  const targetOptions = activeCard && activePlayer ? players.filter((player) => {
    const hp = game?.playerStates[player.id]?.hp ?? player.hero.hp;
    if (hp <= 0) return false;
    if (activeCard.target === "enemy") return player.hero.team !== activePlayer.hero.team;
    if (activeCard.target === "ally") return player.hero.team === activePlayer.hero.team && (activeCard.supportType !== "advance-ally" || player.id !== activePlayer.id);
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

  useEffect(() => { if (activeHand[0]) setSelectedCard(activeHand[0].id); }, [activePlayer?.id, game?.completedTurns]);
  useEffect(() => {
    if (!activeCard || !activePlayer) return;
    if (activeCard.target === "self" || activeCard.target === "all-allies" || activeCard.target === "all-enemies") setTargetPlayerId(activePlayer.id);
    else setTargetPlayerId(targetOptions[0]?.id ?? "");
  }, [activeCard?.id, activePlayer?.id, game?.completedTurns]);
  useEffect(() => { if (phase !== "game" || game?.ended) return; const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, [phase, game?.ended]);
  useEffect(() => {
    if (!players.length || !localPlayer) return setSelectedPlayerId(null);
    if (!players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(localPlayer.id);
  }, [players, selectedPlayerId, localPlayer]);

  const joinPlayer = () => {
    const name = playerName.trim();
    if (status !== "connected" || !sessionId) return setLobbyError("Phòng chung vẫn đang kết nối. Vui lòng thử lại sau giây lát.");
    if (localPlayer) return setLobbyError("Trình duyệt này đã điều khiển một người chơi.");
    if (players.length >= 10) return setLobbyError("Phòng đã đủ 10 người chơi.");
    if (!name) return setLobbyError("Hãy nhập tên trước khi nhấn Tham gia.");
    if (players.some((player) => player.displayName.toLowerCase() === name.toLowerCase())) return setLobbyError("Tên này đã được dùng. Hãy chọn tên khác.");
    if (players.some((player) => player.hero.name === selectedHeroName)) return setLobbyError("Nhân vật này đã được chọn.");
    const veilCount = players.filter((player) => player.hero.team === "veil").length;
    const session = createPlayerSession(name, veilCount <= players.length - veilCount ? 0 : 1, selectedHeroName, sessionId);
    if (send({ type: "join", player: session })) { setSelectedPlayerId(session.id); setPlayerName(""); setLobbyError(""); }
  };
  const toggleReady = (id: string) => send({ type: "ready", sessionId: id, ready: !players.find((player) => player.id === id)?.ready });
  const leaveLobby = (id: string) => { send({ type: "leave", sessionId: id }); setSelectedPlayerId(null); setLobbyError(""); };
  const enterGame = () => {
    if (players.length < 2 || !players.every((player) => player.ready)) return setLobbyError("Tất cả người chơi phải sẵn sàng trước khi bắt đầu.");
    send({ type: "start", game: createInitialGame(players, createAdventure(), 30) });
  };
  const castDie = () => {
    if (rolling || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    setRolling(true); let ticks = 0;
    const timer = window.setInterval(() => { setAnimatedRoll(Math.floor(Math.random() * 20) + 1); ticks += 1; if (ticks >= 9) { window.clearInterval(timer); const finalRoll = Math.floor(Math.random() * 20) + 1; send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, finalRoll) }); setAnimatedRoll(finalRoll); setRolling(false); } }, 85);
  };
  const removePlayer = (targetSessionId: string) => {
    const target = players.find((player) => player.id === targetSessionId);
    if (!localPlayer || !target || targetSessionId === sessionId || !window.confirm(`Xóa ${target.displayName} khỏi trận?`)) return;
    send({ type: "remove-player", sessionId, targetSessionId });
  };
  const closeModal = () => {
    if (showGuide) return setShowGuide(false);
    if (showWorldEvent && game?.worldEvent) return setDismissedWorldEventId(game.worldEvent.id);
    if (showOutcome) setDismissedOutcomeKey(outcomeKey);
  };

  return <main className="game-shell arena-focus"><div className="grain"/>
    <header className="topbar"><div className="brand"><div className="brand-mark"><Crown size={20}/></div><div><strong>SHATTERED OATH</strong><span>Hai đội. Một đội chiến thắng.</span></div></div>
      {phase === "game" ? <nav className="run-status" aria-label="Trạng thái trận"><div><span className="eyebrow">LƯỢT</span><strong>{game?.completedTurns ?? 0} <i>/ 30</i></strong></div><div className="chapter-pips">{Array.from({ length: 30 }).map((_, index) => <i key={index} className={index < (game?.completedTurns ?? 0) ? "complete" : index === (game?.completedTurns ?? 0) ? "current" : ""}/>)}</div><div className={`turn-clock ${secondsLeft <= 10 ? "urgent" : ""}`}><Clock3 size={14}/> {secondsLeft} giây</div></nav> : <div className="lobby-top-status"><Users size={16}/> {players.length}/10 người · {players.filter((player) => player.ready).length} sẵn sàng</div>}
      <div className="top-actions"><button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label="Bật tắt âm thanh">{soundOn ? <Volume2 size={18}/> : <AudioLines size={18}/>}</button><button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16}/> Hướng dẫn</button>{phase === "game" && localPlayer && <button className="text-button leave-game-control" onClick={() => send({ type: "leave-game", sessionId })}><LogOut size={16}/> Rời trận</button>}{phase === "game" && localPlayer && !runComplete && <button className="text-button end-game-control" onClick={() => send({ type: "end-game", sessionId })}><Octagon size={16}/> Kết thúc</button>}{phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Mở danh sách"><Users size={18}/></button>}</div>
    </header>
    {phase === "lobby" ? <Lobby players={players} playerName={playerName} error={lobbyError || roomError} selectedPlayerId={selectedPlayerId} localSessionId={sessionId} connectionStatus={status} characterOptions={characterOptions} selectedHeroName={selectedHeroName} onNameChange={(name) => { setPlayerName(name); setLobbyError(""); clearError(); }} onJoin={joinPlayer} onSelectPlayer={setSelectedPlayerId} onToggleReady={toggleReady} onLeave={leaveLobby} onRemovePlayer={removePlayer} onEnterGame={enterGame} onHeroSelect={(name) => { setSelectedHeroName(name); setLobbyError(""); }}/> :
      <div className="game-layout"><div className={mobileParty ? "mobile-rail open" : "mobile-rail"}><button className="mobile-close icon-button" onClick={() => setMobileParty(false)}><X size={17}/></button><PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer}/></div><PartyRail players={players} activePlayerId={activePlayer?.id ?? ""} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer}/>
        <section className="world-stage combat-stage"><div className="realm-meta"><div><span className="eyebrow">ĐẤU TRƯỜNG ĐỐI KHÁNG · TRẬN 30 LƯỢT</span><h1>Loại toàn bộ đội đối phương</h1></div><span className="seed-button">Mục tiêu d20: {adventure.target}</span></div>
          <section className="combat-banner"><Swords size={24}/><div><strong>{activePlayer?.displayName ? `Lượt của ${activePlayer.displayName}` : "Đang chờ người chơi"}</strong><p>Hạ tất cả đối thủ để thắng ngay. Nếu hết lượt 30, đội có tổng HP cao hơn chiến thắng.</p></div></section>
          <div className="encounter-row"><section className="objective-card"><div className="objective-icon"><Target size={22}/></div><div><span className="eyebrow">MỤC TIÊU LƯỢT NÀY</span><strong>Đổ d20 + điểm lá bài ≥ {adventure.target}</strong><small>Mặt d20 bạn vừa đổ sẽ trở thành mục tiêu của người chơi kế tiếp.</small></div></section><DiceRoller roll={rolling ? animatedRoll : game?.roll ?? null} rolling={rolling} target={adventure.target} bonus={activeCard?.bonus ?? 0} diceBuff={activeState?.diceBuff ?? 0} dicePenalty={activeState?.dicePenalty ?? 0} onRoll={castDie} disabled={activePlayer?.id !== sessionId || status !== "connected" || runComplete || (localState?.hp ?? 1) <= 0} disabledLabel={(localState?.hp ?? 1) <= 0 ? "Bạn đã bị hạ" : runComplete ? "Trận đã kết thúc" : status !== "connected" ? "Đang kết nối lại…" : `Đang chờ ${activePlayer?.displayName ?? "người chơi"}`}/></div>
          <section className="hand-zone"><div className="hand-heading"><div><span className="eyebrow">BÀI TRÊN TAY CỦA {activePlayer?.displayName?.toUpperCase()}</span><strong>Chọn một lá, chọn mục tiêu nếu cần, rồi đổ xúc xắc</strong></div><span><Hand size={14}/> {activeState?.hand.length ?? 0} trên tay · {activeState?.drawPile.length ?? 0} chồng rút · <Trash2 size={14}/> {activeState?.discardPile.length ?? 0} nghĩa địa</span></div>
            {activeCard?.target === "enemy" || activeCard?.target === "ally" ? <label className="target-picker"><Target size={16}/><span>Chọn {getCardTargetLabel(activeCard).toLowerCase()}</span><select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)} disabled={activePlayer?.id !== sessionId}>{targetOptions.map((player) => <option value={player.id} key={player.id}>{player.displayName} · {player.hero.name} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</option>)}</select></label> : null}
            <div className="action-hand four-cards">{activeHand.map((card) => <button className={`action-card ${card.unique ? "hero-special-card" : "common-action-card"} ${selectedCard === card.id ? "selected" : ""}`} style={{ "--hero-color": activePlayer?.hero.color } as React.CSSProperties} key={card.id} onClick={() => setSelectedCard(card.id)} disabled={activePlayer?.id !== sessionId || runComplete || (activeState?.hp ?? 0) <= 0}>{card.unique && <span className="special-skill-banner"><Crown size={12}/> KỸ NĂNG {activePlayer?.hero.className.toUpperCase()}</span>}<div className={`card-sigil ${card.type.toLowerCase()}`}>{card.type === "Might" ? <Swords size={18}/> : card.type === "Wit" ? <Eye size={18}/> : <Sparkles size={18}/>}</div><span>{card.unique ? "Lá đặc biệt" : "Lá chung"} · {typeName[card.type]} · +{card.bonus}</span><strong>{card.name}</strong><p>{card.description}</p><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><p className="card-impact">{describeCardImpact(card)}</p></button>)}</div>
          </section>
        </section>
        <aside className="rival-panel"><section className="current-turn-card"><span className="eyebrow">NGƯỜI ĐANG HÀNH ĐỘNG</span><div><div className="portrait" style={{ "--hero-color": activePlayer?.hero.color } as React.CSSProperties}>{activePlayer?.hero.initials}</div><div><strong>{activePlayer?.displayName}</strong><span>{activePlayer?.hero.name} · {activePlayer?.hero.className}</span></div></div><small>{secondsLeft} giây còn lại · Mục tiêu {adventure.target}</small></section>
          <section className="turn-queue-card"><div className="panel-heading"><div><span className="eyebrow">THỨ TỰ HÀNH ĐỘNG</span><strong>Lượt hiện tại và sắp tới</strong></div><Clock3 size={17}/></div><div className="turn-queue-list">{visibleTurnOrder.map((player, index) => <article className={`turn-queue-item ${index === 0 ? "current" : "future"}`} key={player.id}><b>{index === 0 ? "ĐANG ĐÁNH" : index + 1}</b><div className="portrait mini" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>{player.hero.initials}</div><div><strong>{player.displayName}</strong><span>{player.hero.name} · {teamName[player.hero.team]}</span></div></article>)}</div></section>
          <section className="rivalry"><div className="panel-heading"><div><span className="eyebrow">TÌNH TRẠNG HAI ĐỘI</span><strong>Chỉ một đội thắng</strong></div><Shield size={17}/></div>{(["veil", "ember"] as TeamId[]).map((team) => { const data = team === "veil" ? veil : ember; return <article className={`faction-card ${team}`} key={team}><div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18}/> : <Flame size={18}/>}</div><div><span>{teamName[team]}</span><strong>{data.hp}/{data.maxHp} tổng HP</strong></div></div><p>{data.alive}/{data.total} còn sống · {data.shield} tổng khiên</p><div className="influence-track"><i style={{ width: `${data.maxHp ? data.hp / data.maxHp * 100 : 0}%` }}/></div></article>; })}</section>
          <section className="history-panel"><div className="panel-heading"><div><span className="eyebrow">LỊCH SỬ HÀNH ĐỘNG</span><strong>Ai đã làm gì</strong></div><History size={17}/></div><div className="history-list">{!game?.history?.length && <p className="empty-history">Chưa có hành động.</p>}{[...(game?.history ?? [])].reverse().map((entry) => <article className={`history-entry ${entry.kind} ${entry.success ? "success" : "failure"}`} key={entry.id}><span>Lượt {entry.turn}</span><p>{entry.message}</p>{entry.diceRoll != null && <div className="history-dice"><span>d20: {entry.diceRoll}</span><span>Thưởng: +{entry.diceBonus ?? 0}</span>{Boolean(entry.dicePenalty) && <span>Phạt: -{entry.dicePenalty}</span>}<strong>Tổng {entry.diceTotal} / mục tiêu {entry.diceTarget}</strong></div>}</article>)}</div></section>
        </aside>
      </div>}
    {modalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><section className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${(showOutcome || showWorldEvent) && !showGuide ? "resolution-card" : ""}`}><button className="modal-close icon-button" onClick={closeModal} aria-label="Đóng"><X size={18}/></button>
      {showGuide ? <div className="tutorial-scroll"><span className="eyebrow">HƯỚNG DẪN ĐẦY ĐỦ</span><h2>Cách chiến thắng Shattered Oath</h2><p className="modal-lead">Hai đội luân phiên dùng thẻ và d20. Hạ toàn bộ đội đối phương trước hoặc giữ tổng HP cao hơn sau lượt 30.</p><section className="tutorial-section"><h3><Users size={20}/> Chuẩn bị</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Chọn lớp</strong><p>Mỗi lớp có nội tại riêng, 3 lá đặc biệt và đúng 5 lá chung: 2 Tấn công, 2 Tự tạo khiên, 1 Tự hồi máu. Một nhân vật chỉ có một người được chọn.</p></div></article><article><b>2</b><div><strong>Tham gia và sẵn sàng</strong><p>Mỗi trình duyệt điều khiển một phiên. Tất cả cùng vào một phòng và phải nhấn Sẵn sàng.</p></div></article></div></section><section className="tutorial-section"><h3><Dices size={20}/> Một lượt chơi</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Chọn thẻ và mục tiêu</strong><p>Tấn công chọn đối thủ; AOE đánh mọi đối thủ; Hồi máu và Phòng thủ đặc biệt có thể chọn đồng minh. Năm lá chung hồi máu/tạo khiên chỉ tác dụng lên bản thân.</p></div></article><article><b>2</b><div><strong>Đổ d20</strong><p>d20 + bonus lá bài + buff đồng minh - hiệu ứng của địch phải đạt mục tiêu. Lịch sử ghi rõ mặt xúc xắc, thưởng, phạt, tổng và mục tiêu. Mặt d20 vừa đổ trở thành mục tiêu của người chơi sau.</p></div></article><article><b>3</b><div><strong>Rút lại bài</strong><p>Lá đã dùng vào nghĩa địa. Khi chồng rút hết, nghĩa địa được xáo lại thành chồng rút mới.</p></div></article></div></section><section className="tutorial-section"><h3><Zap size={20}/> Hỗ trợ, rủi ro và biến cố</h3><p>Hỗ trợ có thể tăng sát thương hoặc d20 cho đồng minh, giảm d20 của địch, đưa đồng minh lên lượt kế, đẩy địch xuống cuối hàng hoặc xóa buff/khiên. Lá càng mạnh càng có hậu quả nặng nếu không đạt mục tiêu. Người có 0 HP không thể hành động. Cứ mỗi 5 lượt có một biến cố bất ngờ với cường độ tăng dần.</p></section><section className="tutorial-section warning-section"><h3><Clock3 size={20}/> Hết giờ và phân định thắng</h3><p>Mỗi lượt có 30 giây; hết giờ sẽ tự bỏ lượt, không hiện popup riêng cho người khác và được ghi vào lịch sử. Hạ hết một đội là thắng ngay. Nếu cả hai còn người sau lượt 30, so tổng HP, rồi số người sống, tổng khiên và tổng sát thương để luôn có đúng một đội thắng.</p></section></div> :
      showWorldEvent && game?.worldEvent ? <div className="resolution-content world-event-resolution"><div className="resolution-hero world"><Zap size={34}/></div><span className="eyebrow">BIẾN CỐ THẾ GIỚI · CẤP {game.worldEvent.level}</span><h2>{game.worldEvent.title}</h2><p className="modal-lead">{game.worldEvent.description}</p><div className="resolution-metrics"><div><span>Xảy ra ở lượt</span><strong>{game.worldEvent.turn}</strong></div><div><span>Lần tiếp theo</span><strong>{game.worldEvent.turn < 30 ? game.worldEvent.turn + 5 : "Không còn"}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedWorldEventId(game.worldEvent!.id)}>Tiếp tục <ChevronRight size={17}/></button></div> :
      runComplete ? <><span className="eyebrow">TRẬN ĐẤU KẾT THÚC</span><h2>{game?.winnerTeam ? `${teamName[game.winnerTeam]} chiến thắng!` : "Trận đấu đã được kết thúc."}</h2><p className="modal-lead">{game?.endReason}</p><div className="resolution-metrics"><div><span>Veilbound</span><strong>{veil.hp} HP</strong></div><div><span>Embercourt</span><strong>{ember.hp} HP</strong></div></div><button className="primary-button" onClick={() => send({ type: "return:lobby" })}><RefreshCw size={17}/> Trở về sảnh</button></> :
      showOutcome && outcome ? <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">HÀNH ĐỘNG CỦA BẠN</span><h2>{outcome.actorName} dùng {outcome.cardName}</h2><div className="resolution-chips">{outcome.effect && <span>{outcome.effect}</span>}{outcome.targetName && <span>Mục tiêu: {outcome.targetName}</span>}</div><div className="resolution-equation"><span><small>d20</small><strong>{outcome.roll ?? 0}</strong></span><i>+</i><span><small>tổng thưởng</small><strong>{outcome.bonus ?? 0}</strong></span>{Boolean(outcome.dicePenalty) && <><i>−</i><span className="failure"><small>phạt của địch</small><strong>{outcome.dicePenalty}</strong></span></>}<i>=</i><span className={outcome.success ? "success" : "failure"}><small>so với {outcome.target}</small><strong>{outcome.total}</strong></span></div><strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "THÀNH CÔNG" : "THẤT BẠI"}</strong><p className="modal-lead">{outcome.detail}</p>{outcome.failureDetail && <p className="negative-card-effect"><Skull size={16}/> {outcome.failureDetail}</p>}<div className="resolution-metrics"><div><span>Hiệu lực</span><strong>{outcome.amount ?? 0}</strong></div><div><span>Mục tiêu lượt kế</span><strong>{outcome.nextTarget ?? adventure.target}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Tiếp tục <ChevronRight size={17}/></button></div> : null}
    </section></div>}
  </main>;
}
