import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const gameApp = read("ui/GameApp.tsx");
const lobby = read("ui/components/Lobby.tsx");
const worldEvents = read("ui/components/WorldEventPanels.tsx");
const partyRail = read("ui/components/PartyRail.tsx");
const roomSocket = read("ui/hooks/useRoomSocket.ts");
const gameAudio = read("ui/hooks/useGameAudio.ts");
const styles = read("app/globals.css");

const cardSurfaces = [gameApp, lobby, worldEvents].join("\n");
assert.equal((cardSurfaces.match(/<CardDescription\b/g) || []).length, 6, "every card-description surface must use the shared fixed-height component");
assert(!/\b(?:card|entry\.card|inspectedCard)\.description\b/.test(cardSurfaces), "card surfaces must not bypass the shared description component");
assert.match(cardDescription, /className=\{`card-description /, "the shared card description must expose the common style hook");
assert.match(styles, /\.game-shell \.card-description\s*\{[\s\S]*height:\s*8\.7em;[\s\S]*overflow-y:\s*auto;/, "card descriptions must remain exactly six 1.45em lines with overflow scrolling");

assert.equal((cardSurfaces.match(/<Crown size=\{\d+\}\/> SPECIAL/g) || []).length, 3, "all special-card banners must show only SPECIAL");
assert(!/SPECIAL\s*·|SPECIAL CARD|toUpperCase\(\)\}\s*SKILL/.test(cardSurfaces), "special-card headers must not include a character or class name");

assert.match(partyRail, /<em>\{buff\.tooltipValue \?\? buff\.value\}<\/em>\{buff\.durationLabel && <><i aria-hidden="true">-<\/i><b>\{buff\.durationLabel\}<\/b><\/>\}/, "timed status tooltips must show value - full duration");

assert.match(gameAudio, /GameSoundEffect[\s\S]*"team-join"/, "the audio system must expose the team-join effect");
assert.match(gameAudio, /effect === "team-join"[\s\S]*261\.63[\s\S]*329\.63[\s\S]*392/, "the team-join effect must use its positive entry chime");
assert.match(roomSocket, /previousPlayerTeamsRef = useRef<Map<string, TeamId> \| null>\(null\)/, "team-join detection must skip the initial room snapshot");
assert.match(roomSocket, /payload\.state\.phase === "lobby"[\s\S]*!previousPlayerTeams\.has\(playerId\) \|\| previousPlayerTeams\.get\(playerId\) !== team/, "only new lobby membership or a team switch must trigger the join sound");
assert.match(gameApp, /teamJoinSoundSequence > 0\) playEffect\("team-join"\)/, "confirmed team joins must play the entry chime");

console.log("Card UI contract passed: shared card sizing, normalized status values, and confirmed team-join audio.");
