import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const gameApp = read("ui/GameApp.tsx");
const homeScreen = read("ui/components/HomeScreen.tsx");
const lobby = read("ui/components/Lobby.tsx");
const worldEvents = read("ui/components/WorldEventPanels.tsx");
const partyRail = read("ui/components/PartyRail.tsx");
const roomSocket = read("ui/hooks/useRoomSocket.ts");
const gameAudio = read("ui/hooks/useGameAudio.ts");
const cardZoneMotion = read("ui/cardZoneMotion.ts");
const styles = read("app/globals.css");

const compiledCardZoneMotion = ts.transpileModule(cardZoneMotion, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { getCardZoneChanges } = await import(`data:text/javascript;base64,${Buffer.from(compiledCardZoneMotion).toString("base64")}`);

const cardSurfaces = [gameApp, lobby, worldEvents].join("\n");
assert.equal((cardSurfaces.match(/<CardDescription\b/g) || []).length, 6, "every card-description surface must use the shared fixed-height component");
assert(!/\b(?:card|entry\.card|inspectedCard)\.description\b/.test(cardSurfaces), "card surfaces must not bypass the shared description component");
assert.match(cardDescription, /className=\{`card-description /, "the shared card description must expose the common style hook");
assert.match(styles, /\.game-shell \.card-description\s*\{[\s\S]*height:\s*8\.7em;[\s\S]*overflow-y:\s*auto;/, "card descriptions must remain exactly six 1.45em lines with overflow scrolling");

assert.equal((cardSurfaces.match(/<Crown size=\{\d+\}\/> SPECIAL/g) || []).length, 3, "all special-card banners must show only SPECIAL");
assert(!/SPECIAL\s*·|SPECIAL CARD|toUpperCase\(\)\}\s*SKILL/.test(cardSurfaces), "special-card headers must not include a character or class name");
assert.match(gameApp, /className="history-penalty-cell"><HighlightPlayerNames text=\{presentation\.penalty \|\| "—"\}/, "empty expanded-history penalties must display the same dash placeholder as other empty columns");

assert.match(partyRail, /<em>\{buff\.tooltipValue \?\? buff\.value\}<\/em>\{buff\.durationLabel && <><i aria-hidden="true">-<\/i><b>\{buff\.durationLabel\}<\/b><\/>\}/, "timed status tooltips must show value - full duration");
assert.match(partyRail, /<span>\{hero\.name\}<\/span>/, "battle roster subtitles must show only the character name");
assert(!/rail-remove-player|onRemovePlayer|UserMinus/.test(partyRail), "the battle roster must not expose player-removal controls");

assert.match(gameAudio, /GameSoundEffect[\s\S]*"team-join"/, "the audio system must expose the team-join effect");
assert.match(gameAudio, /effect === "team-join"[\s\S]*261\.63[\s\S]*329\.63[\s\S]*392/, "the team-join effect must use its positive entry chime");
assert.match(roomSocket, /previousPlayerTeamsRef = useRef<Map<string, TeamId> \| null>\(null\)/, "team-join detection must skip the initial room snapshot");
assert.match(roomSocket, /payload\.state\.phase === "lobby"[\s\S]*!previousPlayerTeams\.has\(playerId\) \|\| previousPlayerTeams\.get\(playerId\) !== team/, "only new lobby membership or a team switch must trigger the join sound");
assert.match(gameApp, /teamJoinSoundSequence > 0\) playEffect\("team-join"\)/, "confirmed team joins must play the entry chime");

assert.match(homeScreen, /Play game[\s\S]*placeholder="Enter room ID"[\s\S]*> Join<[\s\S]*Create a new room/, "the home screen must reveal join and create room actions from Play game");
assert(!/home-oath-card|Stand together|Fall remembered/.test(homeScreen), "the home screen must omit the decorative oath quote card");
assert.match(gameApp, /activeRoomId[\s\S]*<RoomGame roomId=\{activeRoomId\}[\s\S]*<HomeScreen/, "the bare app must enter through the home screen before rendering a room");
assert.match(roomSocket, /\/api\/room\?\$\{query\.toString\(\)\}/, "room polling must include the selected room ID");
assert.match(roomSocket, /\/ws\?roomId=\$\{encodeURIComponent\(roomId\)\}/, "room WebSockets must include the selected room ID");
assert.match(lobby, /navigator\.clipboard\.writeText\(roomId\)[\s\S]*className=\{`lobby-room-id/, "the entire lobby room ID control must copy the room ID");
assert.match(lobby, /className="lobby-home-button" onClick=\{onReturnHome\}/, "the lobby must provide a return-to-home button");
assert.match(lobby, /Room <strong>\{roomId\}<\/strong>/, "the lobby must display its room ID");
assert.match(styles, /\.lobby-room-id strong\s*\{[\s\S]*font-size:\s*14px;/, "the lobby room ID must be visually prominent");
assert.match(styles, /\.home-screen\s*\{[\s\S]*min-height:\s*100dvh;[\s\S]*@media \(max-height: 820px\) and \(min-width: 901px\)/, "the themed home screen must include a compact 720p desktop layout");

assert.match(lobby, /className="joined-main" onClick=\{\(\) => onSelectPlayer\(player\.id\)\}/, "clicking a joined player card must still review that player's character and deck");
assert(!/Review deck|Character pending/.test(lobby), "joined player cards must omit the redundant review action and random-character pending copy");
assert.match(lobby, /<UserCheck className="local-session-icon"[\s\S]*aria-label="Your session"\/>/, "the local player card must identify the current session with an icon");
assert(!/shownHero\.(?:title|summary|impact)/.test(lobby), "lobby character previews must omit title/class subtitles, summary copy, and battle impact");
assert(!/inspectedPlayer\.hero\.(?:title|summary|impact)/.test(gameApp), "battle character previews must omit title/class subtitles, summary copy, and battle impact");
assert.match(lobby, /className="joined-actions local-player-actions"[\s\S]*className="out-team-button"[\s\S]*Out team[\s\S]*onToggleReady/, "the local player action row must expose Out team and Ready controls");
assert.match(lobby, /className="joined-actions remote-player-actions"[\s\S]*className="remove-player-button"[\s\S]*Remove/, "another player's action row must expose the expanded Remove control");
assert.match(styles, /@media \(min-width: 721px\) \{[\s\S]*\.team-slot-player,\s*\.empty-team-slot \{\s*height: 118px;\s*min-height: 118px;/, "joined players and empty slots must keep equal desktop heights");
assert.match(styles, /@media \(min-width: 721px\) \{[\s\S]*\.team-slot-player \{\s*display: grid;\s*grid-template-rows: minmax\(0, 1fr\) auto;/, "joined desktop slots must reserve the action row so its bottom padding is not clipped");

assert.deepEqual(
  getCardZoneChanges(["first", "second", "third", "fourth"], ["draw-one", "second", "draw-two", "fourth"]),
  [
    { slotIndex: 0, discardedId: "first", drawnId: "draw-one" },
    { slotIndex: 2, discardedId: "third", drawnId: "draw-two" },
  ],
  "two replaced hand positions must each animate their discarded and drawn card"
);
assert.deepEqual(
  getCardZoneChanges(["first", "second", "third", "fourth"], ["draw-one", "second", "fourth"]),
  [
    { slotIndex: 0, discardedId: "first", drawnId: "draw-one" },
    { slotIndex: 2, discardedId: "third", drawnId: undefined },
  ],
  "partial refills must animate every discard and only the available draw"
);
assert.deepEqual(
  getCardZoneChanges(["first", "second", "third", "fourth"], ["third", "fourth", "first", "second"]),
  [
    { slotIndex: 0, discardedId: "first", drawnId: "third" },
    { slotIndex: 1, discardedId: "second", drawnId: "fourth" },
    { slotIndex: 2, discardedId: "third", drawnId: "first" },
    { slotIndex: 3, discardedId: "fourth", drawnId: "second" },
  ],
  "a multi-card redraw must animate every changed hand position"
);
assert.match(gameApp, /motion\.items\.flatMap/, "the replacement VFX must render every changed card slot");
assert.match(gameApp, /selectedHandMotions = cardIds\.flatMap/, "multi-card World Event choices must preserve every selected hand slot");
assert.match(styles, /\.card-motion\.hand-from-zone\s*\{[^}]*animation:\s*hand-card-fade-out 1\.05s ease-in-out both;/, "every outgoing card must retain the discard animation");
assert.match(styles, /\.card-motion\.hand-to-zone\s*\{[^}]*animation:\s*hand-card-fade-in 1\.18s ease-in-out 1\.1s both;/, "every drawn card must retain the delayed draw animation");

console.log("Card UI contract passed: shared card sizing, normalized status values, multi-card zone animation, and confirmed team-join audio.");
