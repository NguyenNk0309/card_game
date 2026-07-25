"use client";

import { Check, Crown, DoorOpen, Eye, Flame, Shield, Sparkles, Swords, UserMinus, UserPlus, Users } from "lucide-react";
import { describeCardImpact, getCardEffectLabel, getCardTargetLabel } from "@/shared/cardRules";
import type { CharacterOption, PlayerSession } from "@/shared/types";

type Props = {
  players: PlayerSession[]; playerName: string; error: string; selectedPlayerId: string | null;
  localSessionId: string; connectionStatus: string; characterOptions: CharacterOption[]; selectedHeroName: string;
  onNameChange: (name: string) => void; onJoin: () => void; onSelectPlayer: (id: string) => void;
  onToggleReady: (id: string) => void; onLeave: (id: string) => void; onRemovePlayer: (id: string) => void;
  onEnterGame: () => void; onHeroSelect: (heroName: string) => void;
};

const statusText: Record<string, string> = { connecting: "ĐANG KẾT NỐI", connected: "ĐÃ KẾT NỐI", reconnecting: "ĐANG KẾT NỐI LẠI", offline: "MẤT KẾT NỐI" };

export function Lobby({ players, playerName, error, selectedPlayerId, localSessionId, connectionStatus, characterOptions, selectedHeroName, onNameChange, onJoin, onSelectPlayer, onToggleReady, onLeave, onRemovePlayer, onEnterGame, onHeroSelect }: Props) {
  const localPlayer = players.find((player) => player.id === localSessionId);
  const selected = localPlayer ? players.find((player) => player.id === selectedPlayerId) ?? localPlayer : undefined;
  const selectedOption = characterOptions.find((option) => option.hero.name === selectedHeroName) ?? characterOptions[0];
  const shownHero = selected?.hero ?? selectedOption?.hero;
  const shownDeck = selected?.skillDeck ?? selectedOption?.skillDeck ?? [];
  const readyCount = players.filter((player) => player.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;
  const takenHeroes = new Set(players.map((player) => player.hero.name));

  return <section className="lobby-stage">
    <div className="lobby-intro"><span className="eyebrow">ĐẤU TRƯỜNG ĐANG CHỜ</span><h1>Gia nhập trận chiến.</h1><p>Chọn một trong 10 lớp nhân vật, xem bộ bài 8 lá gồm 3 lá đặc biệt và 5 lá chung, rồi sẵn sàng cùng đội.</p></div>
    <div className="lobby-grid">
      <section className="join-panel">
        <div className="lobby-panel-heading"><div><span className="eyebrow">PHÒNG CHƠI CHUNG</span><h2>Nhập tên người chơi</h2></div><div className="lobby-heading-status"><span className={`connection-pill ${connectionStatus}`}>{statusText[connectionStatus] ?? connectionStatus}</span><div className={players.length >= 10 ? "capacity full" : "capacity"}><Users size={16} /> {players.length}/10</div></div></div>
        {!localPlayer ? <form className="join-form" onSubmit={(event) => { event.preventDefault(); onJoin(); }}><label htmlFor="player-name">Tên người chơi</label><div><input id="player-name" value={playerName} onChange={(event) => onNameChange(event.target.value)} placeholder="Nhập tên…" maxLength={24} autoComplete="off"/><button className="join-button" type="submit" disabled={!shownHero || takenHeroes.has(shownHero.name)}><UserPlus size={18} /> {players.length >= 10 ? "Phòng đã đầy" : "Tham gia"}</button></div></form> : <div className="joined-session-note"><Check size={17}/><div><strong>Bạn đã tham gia với tên {localPlayer.displayName}</strong><span>Trình duyệt này chỉ điều khiển phiên người chơi của bạn.</span></div></div>}
        {error && <div className="lobby-error" role="alert">{error}</div>}
        <div className="joined-heading"><div><span className="eyebrow">NGƯỜI CHƠI ĐÃ THAM GIA</span><strong>{readyCount}/{players.length} đã sẵn sàng</strong></div><span>Khi mọi người sẵn sàng, bất kỳ ai cũng có thể bắt đầu.</span></div>
        <div className="joined-list">
          {!players.length && <div className="empty-lobby"><DoorOpen size={24}/><strong>Chưa có người chơi</strong><span>Nhập tên và nhấn Tham gia để tạo phiên đầu tiên.</span></div>}
          {players.map((player, index) => <article className={`joined-player ${selected?.id === player.id ? "selected" : ""}`} key={player.id}>
            <button className="joined-main" onClick={() => onSelectPlayer(player.id)}><div className="portrait" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>{player.hero.initials}</div><div><div className="joined-name"><strong>{player.displayName}</strong><span>{player.id === localSessionId ? "Phiên của bạn" : `Phiên ${index + 1}`}</span></div><p>{player.hero.name} · {player.hero.className}</p></div><span className={`ready-badge ${player.ready ? "is-ready" : ""}`}>{player.ready && <Check size={13}/>} {player.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}</span></button>
            <div className="joined-actions"><button onClick={() => onSelectPlayer(player.id)}><Eye size={14}/> Xem bộ bài</button>{player.id === localSessionId ? <><button className={player.ready ? "unready-button" : "ready-button"} onClick={() => onToggleReady(player.id)}>{player.ready ? "Hủy sẵn sàng" : "Sẵn sàng"}</button><button className="leave-button" onClick={() => onLeave(player.id)} aria-label={`Rời phòng với ${player.displayName}`} title="Rời phòng"><UserMinus size={15}/></button></> : <><span className="remote-player-label">Được điều khiển ở trình duyệt khác</span>{localPlayer && <button className="remove-player-button" onClick={() => onRemovePlayer(player.id)}><UserMinus size={14}/> Xóa</button>}</>}</div>
          </article>)}
        </div>
        <div className={`ready-gate ${allReady ? "all-ready" : ""}`}>{allReady ? <Check size={19}/> : <Shield size={19}/>}<div><strong>{allReady ? "Tất cả đã sẵn sàng" : players.length < 2 ? "Đang chờ thêm người chơi" : "Đang chờ mọi người"}</strong><span>{allReady ? "Bất kỳ người chơi nào cũng có thể bắt đầu." : "Tất cả người chơi phải nhấn Sẵn sàng trước khi bắt đầu."}</span></div><button className="enter-game-button" onClick={onEnterGame} disabled={!allReady || connectionStatus !== "connected"}><Swords size={17}/> Vào trận</button></div>
      </section>
      <aside className="character-panel">{shownHero ? <>
        {!localPlayer && <div className="hero-picker"><div className="deck-heading"><div><span className="eyebrow">CHỌN NHÂN VẬT</span><strong>Mỗi nhân vật chỉ có một người được chọn</strong></div><Users size={18}/></div><div className="hero-picker-grid">{characterOptions.map((option) => { const taken = takenHeroes.has(option.hero.name); return <button key={option.hero.name} className={selectedHeroName === option.hero.name ? "selected" : ""} disabled={taken} onClick={() => onHeroSelect(option.hero.name)} title={option.hero.summary}><span style={{ "--hero-color": option.hero.color } as React.CSSProperties}>{option.hero.initials}</span><strong>{option.hero.name}</strong><small>{taken ? "Đã được chọn" : option.hero.className}</small></button>; })}</div></div>}
        <div className="character-banner"><div className="large-portrait" style={{ "--hero-color": shownHero.color } as React.CSSProperties}>{shownHero.initials}</div><div><span className="eyebrow">{selected ? `NHÂN VẬT CỦA ${selected.displayName.toUpperCase()}` : "NHÂN VẬT BẠN ĐANG CHỌN"}</span><h2>{shownHero.name}</h2><p>{shownHero.title} · {shownHero.className}</p></div>{selected ? <div className={`team-chip ${shownHero.team}`}>{shownHero.team === "veil" ? <Eye size={15}/> : <Flame size={15}/>} {shownHero.team === "veil" ? "Veilbound" : "Embercourt"}</div> : <span className="team-pending">Đội được cân bằng khi tham gia</span>}</div>
        <div className="character-profile"><p>{shownHero.summary}</p><div className="passive-callout"><Crown size={18}/><div><span>NỘI TẠI · {shownHero.passiveName}</span><strong>{shownHero.passiveText}</strong></div></div><div className="character-impact-grid"><div className="character-trait strength"><span>Điểm mạnh</span><strong>{shownHero.strength}</strong></div><div className="character-trait weakness"><span>Điểm yếu</span><strong>{shownHero.weakness}</strong></div></div><div className="impact-note"><Sparkles size={18}/><div><span>Tác động lên trận đấu</span><p>{shownHero.impact}</p></div></div></div>
        <div className="character-stats"><span><strong>{shownHero.hp}</strong> HP</span><span><strong>8</strong> lá · 3 đặc biệt</span><span><strong>{shownHero.skill}</strong> Kỹ năng tiêu biểu</span></div>
        <div className="deck-heading"><div><span className="eyebrow">BỘ BÀI CÁ NHÂN</span><strong>Xem kỹ trước khi sẵn sàng</strong></div><Sparkles size={18}/></div>
        <div className="lobby-skill-deck">{shownDeck.map((card) => <article className={`skill-card ${card.unique ? "hero-unique-card" : "common-skill-card"}`} key={card.id} style={{ "--hero-color": shownHero.color } as React.CSSProperties}>{card.unique && <div className="unique-card-banner"><Crown size={13}/> ĐẶC BIỆT · {shownHero.name}</div>}<div className={`card-sigil ${card.type.toLowerCase()}`}>{card.type === "Might" ? <Swords size={18}/> : card.type === "Wit" ? <Eye size={18}/> : <Sparkles size={18}/>}</div><span className="skill-kind">{card.unique ? "Kỹ năng lớp" : "Lá chung"} · {card.type} · +{card.bonus}</span><strong>{card.name}</strong><p>{card.description}</p><small>{getCardEffectLabel(card)} · {getCardTargetLabel(card)}</small><p className="card-impact">{describeCardImpact(card)}</p></article>)}</div>
      </> : <div className="no-character"><Sparkles size={28}/><h2>Nhân vật đang chờ bạn</h2><p>Chọn nhân vật để xem kỹ năng đặc biệt.</p></div>}</aside>
    </div>
  </section>;
}
