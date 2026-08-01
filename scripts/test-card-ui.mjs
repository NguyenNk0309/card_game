import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const cardFace = read("ui/components/CardFace.tsx");
const cardArtworkViewer = read("ui/components/CardArtworkViewer.tsx");
const cardHoverPreview = read("ui/components/CardHoverPreview.tsx");
const cardArtwork = read("ui/cardArtwork.ts");
const cardCatalog = read("backend/game/catalog.ts");
const gameEngine = read("backend/game/engine.ts");
const sharedTypes = read("shared/types.ts");
const pityCost = read("ui/components/PityCost.tsx");
const truncatedEffectText = read("ui/components/TruncatedEffectText.tsx");
const gameApp = read("ui/GameApp.tsx");
const homeScreen = read("ui/components/HomeScreen.tsx");
const lobby = read("ui/components/Lobby.tsx");
const worldEvents = read("ui/components/WorldEventPanels.tsx");
const highlightCardNames = read("ui/components/HighlightCardNames.tsx");
const partyRail = read("ui/components/PartyRail.tsx");
const roomSocket = read("ui/hooks/useRoomSocket.ts");
const gameAudio = read("ui/hooks/useGameAudio.ts");
const cardZoneMotion = read("ui/cardZoneMotion.ts");
const tooltipPosition = read("ui/components/tooltipPosition.ts");
const styles = read("app/globals.css");

const compiledCardZoneMotion = ts.transpileModule(cardZoneMotion, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { getCardZoneChanges } = await import(`data:text/javascript;base64,${Buffer.from(compiledCardZoneMotion).toString("base64")}`);
const compiledTooltipPosition = ts.transpileModule(tooltipPosition, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { fitCardTooltipToViewport, fitTooltipToViewport } = await import(`data:text/javascript;base64,${Buffer.from(compiledTooltipPosition).toString("base64")}`);

const cardSurfaces = [gameApp, lobby, worldEvents].join("\n");
assert.equal((cardSurfaces.match(/<CardFace\b/g) || []).length, 6, "every production card surface must use the universal card face");
assert(!/\b(?:card|entry\.card|inspectedCard)\.description\b/.test(cardSurfaces), "card surfaces must not bypass the shared card-content pipeline");
assert.match(cardFace, /<CardDescription card=\{card\}\/>/, "the universal card face must own the shared description component");
assert.match(cardFace, /defaultRows[\s\S]*describeCardSuccess\(card\)[\s\S]*describeCardFailure\(card\)/, "the universal card face must keep repository-backed success and failure rows");
assert.match(cardFace, /previewTrigger = "click"[\s\S]*<CardArtworkViewer artwork=\{artwork\} cardName=\{card\.name\} open=\{artworkViewerOpen\} onOpenChange=\{changeArtworkViewer\}\/>[\s\S]*<CardHoverPreview anchorRef=\{faceRef\} artwork=\{artwork\} card=\{card\} pityCostOverride=\{pityCostOverride\} rows=\{rows\} suspended=\{artworkViewerOpen\} trigger=\{previewTrigger\}\/>/, "universal card faces must include an artwork viewer and default to click-triggered full-content previews");
assert.match(cardArtworkViewer, /onClickCapture=\{openViewer\}[\s\S]*onKeyDownCapture=\{openWithKeyboard\}/, "the View Image control must intercept pointer and keyboard activation before the containing card");
assert.match(cardArtworkViewer, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*onOpenChange\(true\)/, "opening artwork must not trigger card selection or its detail tooltip");
assert.match(cardArtworkViewer, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*className="card-artwork-viewer-image" src=\{artwork\.scene\}/, "View Image must open the original illustration in an accessible modal panel");
assert.match(gameApp, /function HandCardContents[\s\S]*<CardFace card=\{card\} pityCostOverride=\{pityCostOverride\} previewTrigger="hover"\/>/, "cards in hand must retain hover-triggered full-content previews");
assert.match(cardHoverPreview, /trigger === "hover"[\s\S]*addEventListener\("mouseenter", show\)[\s\S]*addEventListener\("mouseleave", hide\)[\s\S]*addEventListener\("click", toggle\)/, "only hover-mode cards should use mouse entry while other cards toggle their preview on click");
assert.match(cardHoverPreview, /document\.addEventListener\("click", closeOutside\)[\s\S]*document\.addEventListener\("keydown", closeWithEscape\)/, "click-triggered card previews must close on outside click or Escape");
assert.match(styles, /\.gothic-card\.card-preview-click-trigger:not\(:disabled\)\s*\{\s*cursor:\s*pointer;/, "cards with click-triggered previews must show a pointer cursor");
assert(!/setPortalRoot|useState<HTMLElement \| null>/.test(cardHoverPreview), "closed card previews must not schedule an extra layout-time portal render for every mounted card");
assert.match(cardHoverPreview, /classList\.contains\("history-card-detail"\) \? "right" : "top"/, "history-detail card previews must place their tooltip to the right while other cards prefer the top");
assert.match(cardHoverPreview, /card\.unique \? "Special" : "Common"[\s\S]*Pity points[\s\S]*getCardEffectLabel\(card\)[\s\S]*EffectText text=\{card\.description\}[\s\S]*rows\.map/, "the hover preview must include rarity, pity, action type, full description, and every result row");
assert.match(cardHoverPreview, /<small>\{getCardEffectLabel\(card\)\}<\/small>/, "the hover preview identity must show only the meaningful action label");
assert(!/\bcardType\b|card\.type|\btype:\s*["']/.test([cardCatalog, gameEngine, sharedTypes, cardHoverPreview].join("\n")), "the obsolete card-type field must stay removed from data, outcomes, shared types, and UI");
assert.match(cardDescription, /maxLines=\{4\}[\s\S]*text=\{card\.description\}/, "main descriptions must use the shared four-line truncator");
assert.match(cardFace, /className="gothic-card-result-text" maxLines=\{2\}/, "result text must use the shared two-line truncator");
assert(!/gothic-card-type/.test(cardFace), "card faces must omit the redundant Common or Special type strip");
assert.match(cardFace, /className="gothic-card-copy">[\s\S]*gothic-card-action-icon[\s\S]*gothic-card-title/, "the compact action icon must occupy the former type-strip row below the artwork");
assert.match(cardFace, /className="gothic-card-gem" aria-hidden="true"/, "card faces must retain the static divider diamond");
assert.match(styles, /\.gothic-card-gem\s*\{[^}]*box-shadow:\s*inset 0 0 0 \.4cqw #1a0b08;[^}]*transform:\s*rotate\(45deg\);/, "the divider diamond must retain only its static inset edge");
assert(!/\.gothic-card-gem::(?:before|after)/.test(styles), "the divider diamond must not render flickering flare rays");
assert(!/>PITY</.test(pityCost), "the pity badge must show its number without a redundant PITY caption");
assert.match(truncatedEffectText, /trimEnd\(\)\}\.\.\./, "truncation must use exactly three ASCII periods");
assert(!truncatedEffectText.includes("…"), "truncation must never use the single ellipsis character");
assert.match(styles, /\.gothic-card\s*\{[\s\S]*aspect-ratio:\s*2\s*\/\s*3;/, "all cards must reserve the approved 2:3 aspect ratio");
assert.match(styles, /\.game-shell \.gothic-card \.card-description\s*\{[\s\S]*height:\s*4\.88em\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/, "card descriptions must remain a fixed four-line box without scrolling");
assert.match(styles, /\.gothic-card-result-text\s*\{[\s\S]*height:\s*2\.44em;[\s\S]*overflow:\s*hidden;/, "result text must remain a fixed two-line box");
assert.match(styles, /\.gothic-card-results\s*\{[\s\S]*top:\s*76\.8%;[\s\S]*height:\s*15%;/, "card result rows must end before the dedicated image-button footer");
assert.match(styles, /\.gothic-card-view-image\s*\{[\s\S]*top:\s*92\.4%;[\s\S]*left:\s*3\.4%;[\s\S]*width:\s*93\.2%;[\s\S]*height:\s*5\.3%;[\s\S]*padding:\s*3px 2cqw;[\s\S]*white-space:\s*nowrap;[\s\S]*pointer-events:\s*auto;[\s\S]*cursor:\s*pointer;/, "the View Image control must occupy the full inner-card width with three-pixel vertical padding in its own single-line footer below every card result");
assert.match(styles, /\.card-artwork-viewer-image\s*\{[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*calc\(100dvh - 142px\);[\s\S]*object-fit:\s*contain;/, "the artwork panel must show the complete original illustration within the viewport");
assert.match(styles, /\.game-shell \.gothic-card \.card-description\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*align-items:\s*center;/, "short main descriptions must be vertically centered in the fixed four-line box");
assert.match(styles, /\.gothic-card-result-text\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/, "short success and failure copy must be vertically centered in its fixed two-line box");
assert(!/gothic-card-sprite-crop|gothic-card-targets/.test(cardFace), "special-card artwork must render as one integrated scene rather than layered sprites");
assert.match(styles, /\.gothic-card-action-icon\s*\{[\s\S]*width:\s*8cqw;/, "the action icon must stay compact in the former type-strip row");
assert.match(styles, /\.gothic-card-result-row\s*\{[\s\S]*grid-template-columns:\s*9cqw 29%/, "success and failure icons must use the smaller result column");
assert.match(styles, /\.card-hover-tooltip\s*\{[\s\S]*width:\s*min\(460px, calc\(100vw - 24px\)\);[\s\S]*max-height:\s*calc\(100dvh - 24px\);[\s\S]*pointer-events:\s*none;/, "the large hover preview must remain viewport-bound and disappear without intercepting the mouse");
assert.match(styles, /\.card-hover-tooltip-art\s*\{[\s\S]*background-size:\s*cover;[\s\S]*filter:\s*blur\(11px\) brightness\(\.48\) contrast\(1\.12\)/, "the card illustration must fill and blur behind the hover-preview content");
assert.match(styles, /\.card-hover-tooltip::after\s*\{[\s\S]*linear-gradient[\s\S]*rgba\(6, 7, 9, \.95\)/, "the hover preview must place a dark contrast wash over its illustration");
assert.match(styles, /\.gothic-card-action-icon\.effect-support\s*\{\s*color:\s*#a7abb0;\s*\}/, "support-card action icons must use the approved neutral gray on every universal card face");
assert.match(styles, /\.card-hover-tooltip\.effect-support,\s*\.card-tooltip-arrow\.effect-support\s*\{\s*--card-tooltip-accent:\s*#a7abb0;\s*\}/, "support-card hover previews and arrows must use the approved neutral gray accent");
assert.match(gameApp, /className="phase-event-tooltip" role="tooltip"><span className="tooltip-arrow phase-tooltip-arrow"/, "World Event tooltips must render the shared trigger arrow");
assert.match(partyRail, /role="tooltip"[\s\S]*tooltip-arrow roster-tooltip-arrow placement-/, "roster-effect tooltips must render a viewport-aware trigger arrow");
assert.match(cardHoverPreview, /role="tooltip"[\s\S]*tooltip-arrow card-tooltip-arrow[\s\S]*placement-/, "card-preview tooltips must render a placement-aware trigger arrow");
assert.match(cardHoverPreview, /const card = anchorRef\.current\?\.closest<HTMLElement>\("\.gothic-card"\);[\s\S]*const anchorRect = anchorRef\.current\.getBoundingClientRect\(\);[\s\S]*card\.classList\.contains\("history-card-detail"\)/, "card-preview tooltips and arrows must anchor to the visible card face while retaining history-panel placement");
assert.match(styles, /\.roster-tooltip-arrow\.placement-right[\s\S]*border-right:[^;]+;[\s\S]*\.roster-tooltip-arrow\.placement-left[\s\S]*border-left:[^;]+;/, "roster tooltip arrows must point toward triggers on either side");
assert.match(styles, /\.card-tooltip-arrow\.placement-top[\s\S]*border-top:[^;]+;[\s\S]*\.card-tooltip-arrow\.placement-right[\s\S]*border-right:[^;]+;/, "card tooltip arrows must point toward top and right card triggers");
assert.match(styles, /\.card-tooltip-arrow\.placement-right\s*\{[^}]*border-right:\s*10px solid var\(--card-tooltip-accent\);[^}]*transform:\s*translate\(-100%, -50%\);/, "right-side card-preview arrows must sit fully outside the tooltip border");
assert.match(styles, /\.gothic-card:hover:not\(:disabled\)\s*\{[\s\S]*transform:\s*translateY\(-\.4cqw\)\s*!important;[\s\S]*box-shadow:/, "enabled cards should retain a reduced hover lift and glow");
assert.match(styles, /\.action-hand\s*\{[\s\S]*--hand-card-gap:\s*16px;[\s\S]*--hand-card-width:\s*min\(260px, calc\(\(100% - 48px\) \/ 4\)\)/, "battle-hand cards must use a wider gap and an adaptive desktop cap");
assert.match(styles, /\.action-hand\s*\{[\s\S]*padding:\s*20px 10px 22px;/, "the battle hand must reserve vertical room for card hover effects");
assert.match(styles, /\.action-hand > \.gothic-card\.selected,\s*\.action-hand > \.gothic-card\.selected:not\(:disabled\):hover,\s*\.world-event-choice-card\.gothic-card\.selected,\s*\.world-event-choice-card\.gothic-card\.selected:hover:not\(:disabled\)\s*\{[\s\S]*transform:\s*none\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/, "hand and Phase 3 selection must not move, scale, or cast a neighboring-card shadow");
assert.match(styles, /\.card-motion\.hand-from-zone\.gothic-card\.selected\s*\{[\s\S]*outline:\s*0\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/, "an outgoing selected card must suppress the obsolete gold highlight without overriding its discard animation transform");
assert.match(styles, /\.action-hand > \.gothic-card\.selected::before,\s*\.world-event-choice-card\.gothic-card\.selected::before,\s*\.card-motion\.hand-from-zone\.gothic-card\.selected::before\s*\{[\s\S]*inset:\s*\.5cqw;[\s\S]*pointer-events:\s*none;[\s\S]*border:\s*1\.4cqw solid #e14b3f;/, "hand, Phase 3, and outgoing selected cards must share the thick red outer-edge highlight without affecting layout");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 282px\)\)\s*!important;/, "baseline desktop card galleries must keep two adaptive columns");
assert.match(styles, /@media \(min-width: 1600px\) and \(min-height: 900px\)\s*\{[\s\S]*--hand-card-width:\s*min\(300px,[\s\S]*\.lobby-skill-deck\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 310px\)\)/, "1080p layouts must render taller 300px hand cards and larger 310px gallery cards");
assert.match(styles, /@media \(min-width: 1600px\) and \(min-height: 900px\)\s*\{\s*\.character-review-layout\s*\{\s*grid-template-columns:\s*minmax\(300px, \.72fr\) minmax\(0, 1\.28fr\);/, "1080p and 1440p lobby previews must reserve a wider character-status column");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*padding-block:\s*18px 22px;[\s\S]*scroll-padding-block:\s*18px 22px;/, "card-preview galleries must reserve top and bottom hover room");
assert.match(styles, /\.character-deck-panel \.public-character-deck > div:last-child\s*\{[\s\S]*padding-top:\s*24px;[\s\S]*scroll-padding-top:\s*24px;/, "the in-battle character-deck preview must reserve top clearance for card hover and focus effects");
assert.match(styles, /@media \(min-width: 2200px\) and \(min-height: 1200px\)\s*\{[\s\S]*--hand-card-width:\s*min\(330px,[\s\S]*\.lobby-skill-deck\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 324px\)\)/, "1440p layouts must render taller 330px hand cards and three larger 324px gallery columns");
assert.match(styles, /\.history-card-detail\.gothic-card\s*\{[\s\S]*width:\s*min\(360px,/, "inspected history cards must use the larger preview size");
assert.match(styles, /\.gothic-card:disabled \.gothic-card-face\s*\{[\s\S]*grayscale/, "disabled cards should retain a clear unavailable state");
assert.deepEqual(
  fitCardTooltipToViewport(
    { left: 400, right: 600, top: 500, width: 200, height: 300 },
    { width: 460, height: 300 },
    { width: 1280, height: 720 }
  ),
  { left: 270, top: 186 },
  "ordinary card tooltips must center above their hovered card"
);
assert.deepEqual(
  fitCardTooltipToViewport(
    { left: 300, right: 660, top: 80, width: 360, height: 540 },
    { width: 400, height: 320 },
    { width: 1280, height: 720 },
    "right"
  ),
  { left: 674, top: 190 },
  "history-detail tooltips must anchor to the card's right edge"
);
assert.deepEqual(
  fitCardTooltipToViewport(
    { left: 10, right: 210, top: 20, width: 200, height: 300 },
    { width: 460, height: 350 },
    { width: 600, height: 500 }
  ),
  { left: 12, top: 12 },
  "card tooltips must clamp to the viewport gutter at compact resolutions"
);
assert.deepEqual(
  fitTooltipToViewport(
    { left: 1100, right: 1120, top: 100, height: 20 },
    { width: 300, height: 100 },
    { width: 1280, height: 720 }
  ),
  { left: 791, placement: "left", top: 60 },
  "roster tooltips and their arrows must move to the trigger's left when the right side cannot fit"
);
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
assert.match(cardArtwork, /preloadCardArtwork[\s\S]*preloadedCardArtwork\.has\(source\)[\s\S]*image\.decoding = "async"[\s\S]*image\.decode\(\)/, "lobby artwork warming must deduplicate static assets and decode them asynchronously");
assert.match(lobby, /useDeferredValue\(selectedHeroName\)[\s\S]*preloadCardArtwork\(visibleCharacterOptions\.flatMap[\s\S]*onPointerEnter=\{\(\) => preloadCardArtwork\(option\.skillDeck\)\}/, "character selection must acknowledge immediately while visible and hovered deck artwork warms before first use");
assert(!/SPECIAL\s*·|SPECIAL CARD|toUpperCase\(\)\}\s*SKILL/.test(cardSurfaces), "special-card headers must not include a character or class name");
assert.match(gameApp, /className="history-penalty-cell"><HighlightPlayerNames text=\{presentation\.penalty \|\| "—"\}[^>]*useActualNames/, "expanded-history penalties must use real player names and display the standard empty placeholder");
assert.match(gameApp, /function HistoryMessage[\s\S]*useActualNames/, "history details must preserve real player names");
assert.match(gameApp, /presentation\.actor[\s\S]*useActualNames[\s\S]*presentation\.target[\s\S]*useActualNames/, "expanded-history actor and target cells must preserve real player names");
assert.match(highlightCardNames, /className="history-card-link"[\s\S]*aria-label=\{`View \$\{cardName\} card`\}[\s\S]*onClick=\{\(\) => onInspectCard\(cardName\)\}/, "panel card names must reuse the highlighted history link and open the same card inspector");
assert.match(highlightCardNames, /names\.map\(escapePattern\)[\s\S]*\\p\{L\}[\s\S]*\\p\{N\}/, "card-name matching must be escaped and bounded so partial words are not highlighted");
assert.match(styles, /\.history-card-link\s*\{[^}]*font-size:\s*1em\s*!important;[^}]*line-height:\s*inherit\s*!important;/, "interactive card names must match the surrounding sentence text size and line height in every panel");
assert.match(styles, /\.resolution-content h2 \.history-card-link\s*\{[^}]*font-family:\s*inherit\s*!important;[^}]*font-size:\s*inherit\s*!important;[^}]*font-weight:\s*inherit\s*!important;[^}]*letter-spacing:\s*inherit\s*!important;/, "action-result card names must inherit the complete verdict-title typography");
assert.match(styles, /\.resolution-chips > span\s*\{[\s\S]*\.resolution-chips > span \.inline-player-name\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*font:\s*inherit;/, "action-result target names must stay inside the same chip as the Target label");
assert.match(styles, /\.resolution-verdict\s*\{[^}]*padding:\s*5px 10px 6px;/, "action SUCCESS and FAILURE verdicts must have readable inner padding");
assert.match(gameApp, /function LocalTurnActionPanel[\s\S]*presentation\.title[\s\S]*HighlightInteractiveNames[\s\S]*presentation\.detail[\s\S]*HighlightInteractiveNames/, "discard and skip panels must render interactive card names");
assert.match(gameApp, /showOutcome && outcome && outcomePresentation \?[^\n]*outcomePresentation\.title[^\n]*cardNames=\{panelCardNames\}[^\n]*outcomePresentation\.detail[^\n]*cardNames=\{panelCardNames\}[^\n]*outcome\.failureDetail[^\n]*onInspectCard=\{inspectCard\}/, "local action panels must link card names in titles, details, and failure effects");
assert.match(gameApp, /showTurnSummary && outcome && outcomePresentation \?[^\n]*outcomePresentation\.title[^\n]*cardNames=\{panelCardNames\}[^\n]*outcomePresentation\.detail[^\n]*cardNames=\{panelCardNames\}/, "turn-summary panels must link visible card names");
assert.match(gameApp, /showLifeEvent && activeLifeEvent && activeLifePresentation \?[^\n]*activeLifePresentation\.title[^\n]*cardNames=\{panelCardNames\}[^\n]*activeLifePresentation\.detail[^\n]*cardNames=\{panelCardNames\}/, "defeat and revival panels must link card names in their explanations");
assert.match(gameApp, /showRunComplete \?[^\n]*<HighlightInteractiveNames[^\n]*cardNames=\{panelCardNames\}[^\n]*onInspectCard=\{inspectCard\}/, "battle-result panels must preserve interactive card names if the end reason names a card");
assert.match(worldEvents, /WorldEventLibrary[\s\S]*HighlightCardNames text=\{event\.fullDescription\}[\s\S]*ShatteredTributeChoicePanel[\s\S]*HighlightCardNames text=\{fullRule\}[\s\S]*ResolvedWorldEventPanel[\s\S]*HighlightCardNames text=\{formatViewpointText\(localResult\.privateSummary/, "World Event reference, choice, and result panels must link visible card names");

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
