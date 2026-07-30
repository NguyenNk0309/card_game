import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const gameApp = read("ui/GameApp.tsx");
const lobby = read("ui/components/Lobby.tsx");
const worldEvents = read("ui/components/WorldEventPanels.tsx");
const partyRail = read("ui/components/PartyRail.tsx");
const styles = read("app/globals.css");

const cardSurfaces = [gameApp, lobby, worldEvents].join("\n");
assert.equal((cardSurfaces.match(/<CardDescription\b/g) || []).length, 6, "every card-description surface must use the shared fixed-height component");
assert(!/\b(?:card|entry\.card|inspectedCard)\.description\b/.test(cardSurfaces), "card surfaces must not bypass the shared description component");
assert.match(cardDescription, /className=\{`card-description /, "the shared card description must expose the common style hook");
assert.match(styles, /\.game-shell \.card-description\s*\{[\s\S]*height:\s*8\.7em;[\s\S]*overflow-y:\s*auto;/, "card descriptions must remain exactly six 1.45em lines with overflow scrolling");

assert.equal((cardSurfaces.match(/<Crown size=\{\d+\}\/> SPECIAL/g) || []).length, 3, "all special-card banners must show only SPECIAL");
assert(!/SPECIAL\s*·|SPECIAL CARD|toUpperCase\(\)\}\s*SKILL/.test(cardSurfaces), "special-card headers must not include a character or class name");

assert.match(partyRail, /<em>\{buff\.tooltipValue \?\? buff\.value\}<\/em>\{buff\.durationLabel && <><i aria-hidden="true">-<\/i><b>\{buff\.durationLabel\}<\/b><\/>\}/, "timed status tooltips must show value - full duration");

console.log("Card UI contract passed: shared six-line descriptions, scroll overflow, SPECIAL headers, and normalized status values.");
