import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const cardFace = read("ui/components/CardFace.tsx");
const cardArtwork = read("ui/cardArtwork.ts");
const pityCost = read("ui/components/PityCost.tsx");
const truncatedEffectText = read("ui/components/TruncatedEffectText.tsx");
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
assert.equal((cardSurfaces.match(/<CardFace\b/g) || []).length, 6, "every production card surface must use the universal card face");
assert(!/\b(?:card|entry\.card|inspectedCard)\.description\b/.test(cardSurfaces), "card surfaces must not bypass the shared card-content pipeline");
assert.match(cardFace, /<CardDescription card=\{card\}\/>/, "the universal card face must own the shared description component");
assert.match(cardFace, /defaultRows[\s\S]*describeCardSuccess\(card\)[\s\S]*describeCardFailure\(card\)/, "the universal card face must keep repository-backed success and failure rows");
assert.match(cardDescription, /maxLines=\{4\}[\s\S]*text=\{card\.description\}/, "main descriptions must use the shared four-line truncator");
assert.match(cardFace, /className="gothic-card-result-text" maxLines=\{2\}/, "result text must use the shared two-line truncator");
assert(!/gothic-card-type/.test(cardFace), "card faces must omit the redundant Common or Special type strip");
assert.match(cardFace, /className="gothic-card-copy">[\s\S]*gothic-card-action-icon[\s\S]*gothic-card-title/, "the compact action icon must occupy the former type-strip row below the artwork");
assert(!/>PITY</.test(pityCost), "the pity badge must show its number without a redundant PITY caption");
assert.match(truncatedEffectText, /trimEnd\(\)\}\.\.\./, "truncation must use exactly three ASCII periods");
assert(!truncatedEffectText.includes("…"), "truncation must never use the single ellipsis character");
assert.match(styles, /\.gothic-card\s*\{[\s\S]*aspect-ratio:\s*2\s*\/\s*3;/, "all cards must reserve the approved 2:3 aspect ratio");
assert.match(styles, /\.game-shell \.gothic-card \.card-description\s*\{[\s\S]*height:\s*4\.88em\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/, "card descriptions must remain a fixed four-line box without scrolling");
assert.match(styles, /\.gothic-card-result-text\s*\{[\s\S]*height:\s*2\.44em;[\s\S]*overflow:\s*hidden;/, "result text must remain a fixed two-line box");
assert.match(styles, /\.game-shell \.gothic-card \.card-description\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*align-items:\s*center;/, "short main descriptions must be vertically centered in the fixed four-line box");
assert.match(styles, /\.gothic-card-result-text\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/, "short success and failure copy must be vertically centered in its fixed two-line box");
assert(!/gothic-card-sprite-crop|gothic-card-targets/.test(cardFace), "special-card artwork must render as one integrated scene rather than layered sprites");
assert.match(styles, /\.gothic-card-action-icon\s*\{[\s\S]*width:\s*8cqw;/, "the action icon must stay compact in the former type-strip row");
assert.match(styles, /\.gothic-card-result-row\s*\{[\s\S]*grid-template-columns:\s*9cqw 29%/, "success and failure icons must use the smaller result column");
assert.match(styles, /\.gothic-card:hover:not\(:disabled\)\s*\{[\s\S]*transform:\s*translateY\(-\.4cqw\)\s*!important;[\s\S]*box-shadow:/, "enabled cards should retain a reduced hover lift and glow");
assert.match(styles, /\.action-hand\s*\{[\s\S]*--hand-card-gap:\s*16px;[\s\S]*--hand-card-width:\s*min\(260px, calc\(\(100% - 48px\) \/ 4\)\)/, "battle-hand cards must use a wider gap and an adaptive desktop cap");
assert.match(styles, /\.action-hand\s*\{[\s\S]*padding:\s*20px 10px 22px;/, "the battle hand must reserve vertical room for card hover effects");
assert.match(styles, /\.action-hand > \.gothic-card\.selected,\s*\.action-hand > \.gothic-card\.selected:not\(:disabled\):hover,\s*\.world-event-choice-card\.gothic-card\.selected,\s*\.world-event-choice-card\.gothic-card\.selected:hover:not\(:disabled\)\s*\{[\s\S]*transform:\s*none\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/, "hand and Phase 3 selection must not move, scale, or cast a neighboring-card shadow");
assert.match(styles, /\.card-motion\.hand-from-zone\.gothic-card\.selected\s*\{[\s\S]*outline:\s*0\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/, "an outgoing selected card must suppress the obsolete gold highlight without overriding its discard animation transform");
assert.match(styles, /\.action-hand > \.gothic-card\.selected::before,\s*\.world-event-choice-card\.gothic-card\.selected::before,\s*\.card-motion\.hand-from-zone\.gothic-card\.selected::before\s*\{[\s\S]*inset:\s*\.5cqw;[\s\S]*pointer-events:\s*none;[\s\S]*border:\s*1\.4cqw solid #e14b3f;/, "hand, Phase 3, and outgoing selected cards must share the thick red outer-edge highlight without affecting layout");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 282px\)\)\s*!important;/, "1080p card galleries must use two larger adaptive columns");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*padding-block:\s*18px 22px;[\s\S]*scroll-padding-block:\s*18px 22px;/, "card-preview galleries must reserve top and bottom hover room");
assert.match(styles, /\.character-deck-panel \.public-character-deck > div:last-child\s*\{[\s\S]*padding-top:\s*24px;[\s\S]*scroll-padding-top:\s*24px;/, "the in-battle character-deck preview must reserve top clearance for card hover and focus effects");
assert.match(styles, /@media \(min-width: 2200px\) and \(min-height: 1200px\)\s*\{[\s\S]*\.lobby-skill-deck\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 260px\)\)/, "1440p card galleries must use three larger columns");
assert.match(styles, /\.history-card-detail\.gothic-card\s*\{[\s\S]*width:\s*min\(360px,/, "inspected history cards must use the larger preview size");
assert.match(styles, /\.gothic-card:disabled \.gothic-card-face\s*\{[\s\S]*grayscale/, "disabled cards should retain a clear unavailable state");
const specialSceneIds = [...cardArtwork.matchAll(/specialScene\("([^"]+)"/g)].map((match) => match[1]);
assert.equal(specialSceneIds.length, 30, "every character-specific special card must have an explicit integrated-scene mapping");
for (const id of specialSceneIds) assert(existsSync(new URL(`../public/art/cards/special/${id}.webp`, import.meta.url)), `${id} must have a project-bound integrated-scene asset`);
assert(!/kind:\s*"sprite"|spriteColumn|spriteRow|\/characters\//.test(cardArtwork), "special-card artwork must not retain sprite-sheet rendering data");
assert(!/gothic-card-sprite-crop|gothic-card-targets/.test(styles), "obsolete sprite and synthetic-target composition styles must stay removed");
const cardAssetRoot = new URL("../public/art/cards/", import.meta.url);
assert.deepEqual(readdirSync(cardAssetRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), ["common", "special"], "the card-art directory must contain only active integrated-scene groups");
const commonSceneIds = [...cardArtwork.matchAll(/\bscene\("([^"]+)"/g)].map((match) => match[1]).sort();
const listedCardAssets = (group) => readdirSync(new URL(`${group}/`, cardAssetRoot)).filter((name) => name.endsWith(".webp")).map((name) => name.replace(/\.webp$/, "")).sort();
assert.deepEqual(listedCardAssets("common"), commonSceneIds, "common artwork must not retain unused image files");
assert.deepEqual(listedCardAssets("special"), [...specialSceneIds].sort(), "special artwork must not retain unused image files");
assert.match(cardArtwork, /"lost momentum"[\s\S]*"broken plan"[\s\S]*"empty gesture"/, "the three approved reference cards must have explicit artwork mappings");
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
assert(!/UserCheck|local-session-icon|Your session/.test(lobby), "joined player cards must omit the local-session icon");
assert.match(lobby, /className=\{`ready-badge[\s\S]*aria-label=\{player\.ready \? "Ready" : "Not ready"\}[\s\S]*player\.ready \? <Check size=\{14\}\/> : <Clock3 size=\{14\}\/>/, "joined-player readiness must use compact ready and waiting icons with accessible labels");
assert(!/shownHero\.(?:title|summary|impact)/.test(lobby), "lobby character previews must omit title/class subtitles, summary copy, and battle impact");
assert(!/inspectedPlayer\.hero\.(?:title|summary|impact)/.test(gameApp), "battle character previews must omit title/class subtitles, summary copy, and battle impact");
assert.match(lobby, /className="joined-actions local-player-actions"[\s\S]*className="out-team-button"[\s\S]*Out team[\s\S]*onToggleReady/, "the local player action row must expose Out team and Ready controls");
assert.match(lobby, /className="joined-actions remote-player-actions"[\s\S]*className="remove-player-button"[\s\S]*Remove/, "another player's action row must expose the expanded Remove control");
assert.match(styles, /@media \(min-width: 721px\) \{[\s\S]*\.team-slot-player,\s*\.empty-team-slot \{\s*height: 118px;\s*min-height: 118px;/, "joined players and empty slots must keep equal desktop heights");
assert.match(styles, /@media \(min-width: 721px\) \{[\s\S]*\.team-slot-player \{\s*display: grid;\s*grid-template-rows: minmax\(0, 1fr\) auto;/, "joined desktop slots must reserve the action row so its bottom padding is not clipped");
assert.match(styles, /@media \(min-width: 1360px\) and \(max-height: 1100px\) \{[\s\S]*\.team-slot-player \.joined-actions \{\s*padding: 3px 7px 5px;[\s\S]*\.team-slot-player \.joined-actions button \{\s*min-height: 28px;/, "compact desktop player slots must fit their profile and action rows without overlap");

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
