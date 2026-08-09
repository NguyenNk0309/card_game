import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cardDescription = read("ui/components/CardDescription.tsx");
const cardFace = read("ui/components/CardFace.tsx");
const cardArtworkViewer = read("ui/components/CardArtworkViewer.tsx");
const cardHoverPreview = read("ui/components/CardHoverPreview.tsx");
const characterAvatar = read("ui/components/CharacterAvatar.tsx");
const cardArtwork = read("ui/cardArtwork.ts");
const cardCatalog = read("backend/game/catalog.ts");
const gameEngine = read("backend/game/engine.ts");
const nodeServer = read("backend/server.mjs");
const realtimeWorker = read("backend/realtime-worker.js");
const sharedTypes = read("shared/types.ts");
const sharedViewpoint = read("shared/viewpoint.mjs");
const lioraRules = read("shared/lioraVenn.mjs");
const diceRoller = read("ui/components/DiceRoller.tsx");
const pityCost = read("ui/components/PityCost.tsx");
const truncatedEffectText = read("ui/components/TruncatedEffectText.tsx");
const effectText = read("ui/components/EffectText.tsx");
const gameApp = read("ui/GameApp.tsx");
const homeScreen = read("ui/components/HomeScreen.tsx");
const lobby = read("ui/components/Lobby.tsx");
const worldEvents = read("ui/components/WorldEventPanels.tsx");
const shopPanel = read("ui/components/ShopPanel.tsx");
const sharedShop = read("shared/shop.mjs");
const highlightCardNames = read("ui/components/HighlightCardNames.tsx");
const partyRail = read("ui/components/PartyRail.tsx");
const battlePhases = read("shared/battlePhases.mjs");
const roomSocket = read("ui/hooks/useRoomSocket.ts");
const gameAudio = read("ui/hooks/useGameAudio.ts");
const autoPanelVfx = read("ui/components/AutoPanelVfx.tsx");
const gameMotionProvider = read("ui/motion/GameMotionProvider.tsx");
const motionPresets = read("ui/motion/presets.ts");
const tooltipPosition = read("ui/components/tooltipPosition.ts");
const deviceSupportGate = read("ui/components/DeviceSupportGate.tsx");
const homePage = read("app/page.tsx");
const styles = read("app/globals.css");
const panelTitleSources = [gameApp, lobby, worldEvents, cardArtworkViewer];
const stackedPanelTitleLabel = /<(?:span className="eyebrow"|small)>[\s\S]*?<\/(?:span|small)>\s*<h[12]\b/;
for (const source of panelTitleSources) {
  assert(!stackedPanelTitleLabel.test(source), "panel titles must not render a small overline label above the main heading");
}
const pityHoverRules = [...styles.matchAll(/\.pity-button:hover:not\(:disabled\)\s*\{([^}]*)\}/g)];
assert.match(pityHoverRules.at(-1)?.[1] ?? "", /background:\s*var\(--effect-pity\);/, "the final Play Pity hover rule must use the canonical pity color");
assert.match(pityHoverRules.at(-1)?.[1] ?? "", /border-color:\s*var\(--effect-pity\)/, "the final Play Pity hover border must use the canonical pity color");

const characterAvatars = [
  ["Elara Voss", "elara-voss.webp"],
  ["Thorne Vale", "thorne-vale.webp"],
  ["Mira Ash", "mira-ash.webp"],
  ["Brother Orren", "brother-orren.webp"],
  ["Liora Venn", "liora-venn.webp"],
  ["Nyx Calder", "nyx-calder.webp"],
  ["Bram Coalhand", "bram-coalhand.webp"],
  ["Sable Fen", "sable-fen.webp"],
  ["Kael Rook", "kael-rook.webp"],
  ["Ione Mire", "ione-mire.webp"],
  ["Dagan Flint", "dagan-flint.webp"]
];
for (const [heroName, fileName] of characterAvatars) {
  assert(characterAvatar.includes(`"${heroName}": "/art/characters/${fileName}"`), `${heroName} must have a unique avatar mapping`);
  assert(existsSync(new URL(`../public/art/characters/${fileName}`, import.meta.url)), `${heroName}'s avatar asset must exist`);
}
assert.match(characterAvatar, /showImage \? <span className="avatar-image-motion"><Image[\s\S]*onError=\{\(\) => setFailedSource\(avatar\)\}[\s\S]*: <span className="avatar-fallback">\{hero\.initials\}/, "native character avatars must retain initials as a safe fallback when an image is missing or fails");
assert.match(characterAvatar, /preloadCharacterAvatars[\s\S]*preloadedCharacterAvatars\.get\(source\)[\s\S]*image\.decoding = "async"[\s\S]*image\.decode\(\)/, "character portraits must be deduplicated and decoded off the interaction path");
assert.match(gameApp, /canPayLioraVennHealthCost\(activeCard, localState\?\.hp\)[\s\S]*canPlaySelectedCard=\{activeCardCanBePlayed\}[\s\S]*selectedCardBlockReason=\{activeCardBlockReason\}/, "low-HP blood cards must disable Roll and Pity through the shared health-cost rule");
assert.match(gameApp, /Requires at least \$\{LIORA_VENN_MINIMUM_HP\} HP to play; discarding remains available\./, "low-HP blood cards must remain selectable for discarding with a clear explanation");
assert.match(diceRoller, /className="roll-button"[\s\S]*!canPlaySelectedCard[\s\S]*className="pity-button"[\s\S]*!canPlaySelectedCard[\s\S]*className="discard-card-button"[\s\S]*disabled=\{rolling \|\| disabled \|\| !hasSelectedCard\}/, "the health requirement blocks Roll and Pity without blocking the existing discard action");
assert.doesNotMatch(diceRoller, /<small>d20|Marshal's Fortune|Precision Order|omen\/hex/, "the action check must not render the removed d20 modifier sentence");
assert.match(diceRoller, /className="dice-target">Target <b>\{target\}<\/b>[\s\S]*className="dice-total-modifier">Total modifier:[\s\S]*className="dice-modifier-value"[\s\S]*role="tooltip"/, "the action check must keep an enlarged target and one focusable modifier value with a tooltip");
assert.match(diceRoller, /from passive of \$\{passiveName\}[\s\S]*from buff[\s\S]*from debuff[\s\S]*from potion\/item[\s\S]*from Marked Target/, "the modifier tooltip must itemize every live roll source");
assert.match(diceRoller, /from Marked Target", tone: "marked"[\s\S]*dice-modifier-detail \$\{detail\.tone \?\? "dice"\}/, "Marked Target must keep its magenta modifier row while other d20 modifiers remain violet");
assert.match(gameApp, /diceBuff=\{visibleDiceModifier\(activeState\?\.diceBuff[\s\S]*shopDiceBonus=\{visibleDiceModifier\(activeState\?\.shopDiceBonus[\s\S]*markedTargetBonus=\{visibleDiceModifier\(markedTargetDiceBonus/, "ordinary buffs, Shop bonuses, and Marked Target must remain distinct tooltip sources");
assert(!/ACTIVE EFFECTS|No active effects|localStatusPresentations/.test(gameApp), "the private hand must replace the temporary-effects strip with the character passive");
assert.match(gameApp, /className="active-passive-strip"[\s\S]*ACTIVE PASSIVE[\s\S]*active-passive-effect[\s\S]*localPlayer\.hero\.passiveText/, "the Active Passive row must render the local character's passive effect in the right-hand box");
for (const passiveCondition of ["thorneDeadeyeCharge", "sanguineRecompense", "passiveReviveUsed", "state.shield <= 0", "state.hp <= state.maxHp / 2"]) {
  assert(gameApp.includes(passiveCondition), `the Active Passive state must reflect the gameplay condition for ${passiveCondition}`);
}
assert.match(styles, /\.active-passive-strip\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\);[\s\S]*\.active-passive-effect\.is-active\s*\{[^}]*background:\s*#17351e;/, "an active passive must turn only its right-hand effect box green");
assert.match(diceRoller, /className="dice-action-check"[\s\S]*className=\{`d20[\s\S]*className="dice-copy"/, "the d20 and modifier copy must form one Action Check block");
assert.match(styles, /@media \(min-width: 1280px\) and \(max-width: 2199px\) and \(min-height: 720px\) and \(max-height: 1199px\)[\s\S]*\.dice-panel\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-template-rows:\s*auto minmax\(58px, auto\) minmax\(52px, auto\);[\s\S]*\.dice-panel \.dice-action-check\s*\{[^}]*grid-column:\s*1 \/ -1;[\s\S]*\.dice-panel \.turn-action-buttons\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/, "below-1440p desktop controls must place Action Check first and the four buttons below it in equal two-button rows");
assert.match(styles, /\.dice-panel \.roll-button,[\s\S]*\.dice-panel \.pity-button\s*\{[^}]*height:\s*100%;[\s\S]*\.dice-panel \.turn-action-buttons \.skip-turn-button,[\s\S]*\.dice-panel \.turn-action-buttons \.discard-card-button\s*\{[^}]*height:\s*100%;/, "both buttons in each sub-1440 action row must always stretch to the same height");
assert.match(styles, /\.dice-copy > strong\s*\{[^}]*font:\s*700 20px[\s\S]*\.dice-copy > strong b\s*\{[^}]*font-size:\s*28px/, "the action-check target must use the larger approved typography");
assert.match(styles, /\.dice-modifier-value\s*\{[^}]*border:\s*1px solid #9e5bc4;[\s\S]*\.dice-modifier-anchor:hover \.dice-modifier-tooltip,[\s\S]*\.dice-modifier-anchor:focus-within \.dice-modifier-tooltip[\s\S]*\.dice-modifier-value,[\s\S]*color:\s*var\(--effect-dice\)/, "the violet boxed modifier must reveal its detail tooltip on hover or keyboard focus");
assert.match(sharedTypes, /cardBonus\?: number;[\s\S]*passiveBonus\?: number;[\s\S]*shopDiceBonus\?: number;[\s\S]*markedTargetBonus\?: number;[\s\S]*effectBreakdowns\?: OutcomeEffectBreakdown\[\];/, "card outcomes must retain roll and resolved-effect source details");
assert.match(gameEngine, /cardDiceBonus[\s\S]*totalBonus = cardDiceBonus \+ diceBuff \+ passiveDiceBonus \+ shopDiceBonus \+ markedRollBonus[\s\S]*cardBonus: usePity \? undefined : cardDiceBonus[\s\S]*passiveBonus: usePity \? undefined : passiveDiceBonus[\s\S]*shopDiceBonus: usePity \? undefined : shopDiceBonus[\s\S]*markedTargetBonus: usePity \? undefined : markedRollBonus/, "the authoritative outcome must snapshot every d20 modifier before one-use effects are consumed");
assert.match(gameEngine, /effectBreakdowns[\s\S]*from .* card[\s\S]*from attack buff[\s\S]*from Warflame Tonic potion[\s\S]*passive[\s\S]*blocked by normal Shield[\s\S]*limited by maximum HP[\s\S]*failure backlash[\s\S]*from a successful card action/, "the authoritative outcome must itemize damage, Shield, healing limits, failure effects, and Gold sources");
const rollEquationSource = gameApp.slice(gameApp.indexOf("function OutcomeRollEquation"), gameApp.indexOf("function conciseEffectSource"));
assert.match(rollEquationSource, /total modifier[\s\S]*'s total[\s\S]*dice target/, "the local action result must keep only the core d20 equation values");
assert.doesNotMatch(rollEquationSource, /resolution-value-detail|Raw d20 result|Meet or exceed|No active modifiers/, "the local action result must omit explanatory text beneath the d20 equation");
assert.match(gameApp, /showOutcome && outcome && outcomePresentation \?[\s\S]*<OutcomeRollEquation outcome=\{outcome\}[\s\S]*<OutcomeEffectSummary outcome=\{outcome\}/, "every player's card Action Result must render the core roll equation and concise effect summary");
assert.match(gameApp, /className=\{`effect-\$\{getCardEffectTone\(\{ effect: outcome\.effect, supportType: outcome\.supportType \}\)\}`\}/, "Action Result effect chips must use the card's semantic color");
const detailedActionResultLine = gameApp.split(/\r?\n/).find((line) => line.includes("showOutcome && outcome && outcomePresentation")) ?? "";
const actionOutcomePanelSource = gameApp.slice(gameApp.indexOf("function ActionOutcomePanel"), gameApp.indexOf("function HistoryMessage"));
assert(detailedActionResultLine.includes("OutcomeRollEquation"), "card Action Results must expose their core roll values to every player");
assert.match(gameApp, /function OutcomeEffectSummary[\s\S]*!breakdown\.id\.startsWith\("gold-"\)[\s\S]*withoutAutomaticGold[\s\S]*const tone =[\s\S]*"healing-support"[\s\S]*"heal"[\s\S]*"dispel"[\s\S]*"marked"[\s\S]*"attack"[\s\S]*"shield"[\s\S]*"damage"[\s\S]*"dice"[\s\S]*"speed"[\s\S]*"cards"[\s\S]*"support"[\s\S]*"none"[\s\S]*className=\{tone \?[\s\S]*effect-number[\s\S]*partTone[\s\S]*<OutcomeEffectSummary outcome=\{outcome\}/, "card Action Results must render concise semantic effect math while hiding automatic Gold gain");
assert.match(gameApp, /function conciseEffectSource[\s\S]*from Shield[\s\S]*from item[\s\S]*from buff[\s\S]*from passive[\s\S]*base/, "effect sources must collapse to short player-facing labels");
for (const [token, hex] of Object.entries({ damage: "#e5484d", heal: "#35b96f", shield: "#3b82f6", attack: "#f26a3d", "healing-support": "#84cc5a", dice: "#8b5cf6", marked: "#d946a8", turn: "#f5a524", cards: "#22b8cf", dispel: "#14b8a6", support: "#eabf32", none: "#8b9098", pity: "#f06292" })) {
  assert(styles.includes(`--effect-${token}: ${hex};`), `${token} must retain its approved canonical color ${hex}`);
}
assert.match(styles, /Canonical semantic effect palette[\s\S]*\.effect-number\.damage[\s\S]*var\(--effect-damage\)[\s\S]*\.effect-number\.healing-support[\s\S]*var\(--effect-healing-support\)[\s\S]*\.effect-number\.dispel[\s\S]*var\(--effect-dispel\)[\s\S]*\.effect-number\.pity[\s\S]*var\(--effect-pity\)/, "Action Result values must use the complete canonical semantic effect palette");
assert.match(styles, /\.automatic-success-notice,[\s\S]*\.history-dice\.automatic[\s\S]*color:\s*var\(--effect-pity\)\s*!important;/, "zero-pity automatic-success surfaces must use the approved pink");
assert.match(styles, /\.outcome-effect-summary\s*\{[^}]*width:\s*min\(620px, 100%\);[^}]*text-align:\s*center;[\s\S]*\.outcome-effect-summary p\s*\{[^}]*font-size:\s*clamp\(15px, 2vw, 18px\);/, "effect sentences must remain responsive");
assert.doesNotMatch(styles, /\.outcome-effect-number/, "Action Result values must not override semantic colors with one universal color");
assert.match(actionOutcomePanelSource, /separatesActionLabel = outcome\.kind === "discard" \|\| outcome\.kind === "skip" \|\| outcome\.kind === "timeout"[\s\S]*<h2>\{separatesActionLabel \? "Action Outcome"[\s\S]*className="action-outcome-event"/, "discard, manual skip, and timeout labels must render below the Action Outcome header");
assert(actionOutcomePanelSource.includes("presentation.detail &&") && !actionOutcomePanelSource.includes("OutcomeRollEquation"), "compact Action Outcome panels must omit empty details and detailed roll math");
assert(!sharedViewpoint.includes("Time expired; no card played or discarded.") && !sharedViewpoint.includes("turn timed out."), "the redundant timeout explanation must stay removed");
assert.match(styles, /\.action-outcome-event\s*\{[^}]*font-size:\s*clamp\(18px, 2\.8vw, 24px\);[^}]*text-transform:\s*uppercase;/, "the action label row must remain smaller than the panel header without losing emphasis");
assert.match(styles, /\.resolution-card\s*\{[^}]*container-type:\s*inline-size;[\s\S]*\.resolution-equation\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:[^}]*minmax\(170px, 1\.6fr\)[\s\S]*\.outcome-effect-summary p\s*\{[^}]*font-size:\s*clamp\(15px, 2vw, 18px\)[\s\S]*@container \(max-width: 640px\)[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, "concise card Action Result values must grow responsively without overflowing the modal");
for (const authority of [nodeServer, realtimeWorker]) {
  assert.match(authority, /normalizeLioraVennCards[\s\S]*reconcileLioraVennImpact[\s\S]*sanguineRecompense/, "each realtime authority must normalize Liora's cards and reconcile her passive state");
}
assert.match(lioraRules, /LIORA_VENN_MINIMUM_HP = 4[\s\S]*LIORA_VENN_HEALTH_COST = 3|LIORA_VENN_HEALTH_COST = 3[\s\S]*LIORA_VENN_MINIMUM_HP = 4/, "the shared Liora rules must retain the approved 4 HP requirement and 3 HP cost");
assert.match(lobby, /hero-picker-grid[\s\S]*<CharacterAvatar hero=\{option\.hero\}[\s\S]*character-banner[\s\S]*<CharacterAvatar hero=\{shownHero\}/, "lobby character selection and review must show the unique avatars");
assert.match(lobby, /character-profile"><CharacterAvatar hero=\{shownHero\} className="large-portrait lobby-character-avatar" loading="eager" sizes="\(min-height: 1200px\) 216px, \(min-height: 900px\) 162px, 112px"\/><div className="passive-callout">/, "the selected character's responsive lobby avatar must appear above the character information section and load eagerly");
assert.match(styles, /\.lobby-character-avatar\s*\{[^}]*width:\s*min\(100%, clamp\(112px, 15vh, 216px\)\);[^}]*height:\s*auto;[^}]*aspect-ratio:\s*1;[^}]*margin:\s*0 auto;/, "the lobby character avatar must scale continuously above its information from 720p through 1440p layouts");
assert.match(gameApp, /turn-queue-list[\s\S]*<CharacterAvatar hero=\{player\.hero\}[\s\S]*character-detail-modal[\s\S]*<CharacterAvatar hero=\{inspectedPlayer\.hero\}/, "turn order and character detail must show the unique avatars");
assert.match(partyRail, /function RosterAvatar[\s\S]*onMouseEnter=\{showTooltip\}[\s\S]*onFocus=\{showTooltip\}[\s\S]*className="battle-avatar-tooltip"[\s\S]*<CharacterAvatar hero=\{hero\} className="large-portrait battle-avatar-tooltip-image" sizes="180px"/, "battle roster avatars must show a larger tooltip on hover and keyboard focus");
assert.match(partyRail, /<RosterAvatar hero=\{hero\} playerName=\{player\.displayName\} onInspect=\{\(\) => onInspectPlayer\?\.\(player\.id\)\}\/?>/, "battle roster avatar previews must retain the full character-detail click action");
assert.match(styles, /\.hero-row > \.portrait-button\s*\{[^}]*align-self:\s*start;/, "battle roster avatar hover targets must stay aligned to the visible avatar instead of stretching across the row");
assert.match(styles, /\.battle-avatar-tooltip\s*\{[^}]*position:\s*fixed;[^}]*width:\s*min\(196px, calc\(100vw - 24px\)\);[^}]*pointer-events:\s*none;/, "battle avatar tooltips must be viewport-safe and must not intercept the pointer");
assert.match(styles, /\.battle-avatar-tooltip-image\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*aspect-ratio:\s*1;/, "battle avatar tooltip images must preserve their larger square geometry");
assert(!/\b(?:strength|weakness)\s*:|character-(?:impact-grid|trait)|>Strength<|>Weakness</i.test([cardCatalog, sharedTypes, gameApp, lobby, styles].join("\n")), "Strength and Weakness data, sections, and styles must stay fully removed");

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
assert.match(cardArtworkViewer, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*className="card-artwork-viewer-image"[\s\S]*src=\{artwork\.scene\}/, "View Image must open the original illustration in an accessible Motion modal panel");
assert.match(gameApp, /HandCardContents = memo[\s\S]*<CardFace card=\{card\} pityCostOverride=\{pityCostOverride\} previewTrigger="hover" imageLoading="eager" imagePriority="high"\/>/, "cards in hand must retain hover-triggered previews while loading visible artwork eagerly");
assert.match(cardHoverPreview, /trigger === "hover"[\s\S]*addEventListener\("mouseenter", show\)[\s\S]*addEventListener\("mouseleave", hide\)[\s\S]*addEventListener\("click", toggle\)/, "only hover-mode cards should use mouse entry while other cards toggle their preview on click");
assert.match(cardHoverPreview, /document\.addEventListener\("click", closeOutside\)[\s\S]*document\.addEventListener\("keydown", closeWithEscape\)/, "click-triggered card previews must close on outside click or Escape");
assert.match(styles, /\.gothic-card\.card-preview-click-trigger:not\(:disabled\)\s*\{\s*cursor:\s*pointer;/, "cards with click-triggered previews must show a pointer cursor");
assert(!/setPortalRoot|useState<HTMLElement \| null>/.test(cardHoverPreview), "closed card previews must not schedule an extra layout-time portal render for every mounted card");
assert.match(cardHoverPreview, /classList\.contains\("history-card-detail"\) \? "right" : "top"/, "history-detail card previews must place their tooltip to the right while other cards prefer the top");
assert.match(cardHoverPreview, /getCardRarityLabel\(card\)[\s\S]*Pity points[\s\S]*getCardEffectLabel\(card\)[\s\S]*EffectText text=\{card\.description\}[\s\S]*rows\.map/, "the hover preview must include derived Common, Special, or External rarity plus pity, action type, description, and results");
assert.match(cardHoverPreview, /<small>\{getCardEffectLabel\(card\)\}<\/small>/, "the hover preview identity must show only the meaningful action label");
assert(!/\bcardType\b|card\.type|\btype:\s*["']/.test([cardCatalog, gameEngine, sharedTypes, cardHoverPreview].join("\n")), "the obsolete card-type field must stay removed from data, outcomes, shared types, and UI");
assert.match(cardFace, /const rarity = getCardRarity\(card\)[\s\S]*data-rarity=\{rarity\}[\s\S]*rarity === "special" && <Crown\/>[\s\S]*rarity\.toUpperCase\(\)/, "External cards must override the Common and Special labels on the universal card face");
assert(!/contextLabel=/.test(cardSurfaces), "card surfaces must not place small context labels over card artwork");
assert(!/contextLabel|gothic-card-context/.test(cardFace), "the universal card face must not expose or render an in-card context label");
assert(!/\.gothic-card-context/.test(styles), "obsolete in-card context-label styling must stay removed");
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
assert.match(effectText, /function getCardEffectTone[\s\S]*"attack"[\s\S]*"healing-support"[\s\S]*"dice"[\s\S]*"marked"[\s\S]*"speed"[\s\S]*"cards"[\s\S]*"dispel"[\s\S]*"heal"[\s\S]*"pity"[\s\S]*"shield"[\s\S]*"support"/, "support-card values must map to every approved semantic color family");
assert.match(cardFace, /const effectTone = getCardEffectTone\(card\)[\s\S]*gothic-card-effect-wash effect-\$\{effectTone\}[\s\S]*gothic-card-action-icon effect-\$\{effectTone\}/, "card washes and action icons must use each support subtype's semantic color");
assert.match(cardHoverPreview, /const effectTone = getCardEffectTone\(card\)[\s\S]*card-hover-tooltip effect-\$\{effectTone\}[\s\S]*card-tooltip-arrow effect-\$\{effectTone\}/, "card previews and arrows must use each support subtype's semantic color");
assert.match(effectText, /phrase === "attack damage bonus" \? "attack"/, "attack damage bonus copy must use the orange-red attack treatment");
assert.match(partyRail, /buff\.kind === "attackBuff"[\s\S]*\? "attack"[\s\S]*buff\.kind === "markedTarget" \? "marked"[\s\S]*buff\.kind === "zeroPity"[\s\S]*\? "pity"/, "roster effects must receive their semantic attack, marked-target, and pity treatments");
assert.match(partyRail, /buff\.kind === "shield" \|\| buff\.kind === "goldenShield" \? "shield"/, "normal and Golden Shield statuses must use the canonical Shield blue");
assert.match(styles, /\.roster-buff-indicator\.effect-attack,[\s\S]*color:\s*var\(--effect-attack\)\s*!important;/, "roster attack bonus values must render in orange-red");
assert.match(cardFace, /effectTone\?: "damage" \| "shield" \| "none"[\s\S]*failureEffect === "self-damage"[\s\S]*\? "damage"[\s\S]*failureEffect === "lose-shield"[\s\S]*\? "shield"/, "card failures must distinguish damage red, Shield blue, and no-effect gray");
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
assert.match(styles, /:is\(\.card-sigil, \.gothic-card-action-icon\)\.effect-support\s*\{\s*color:\s*var\(--effect-support\)/, "support-card action icons must use the approved soft yellow on every universal card face");
assert.match(styles, /\.card-hover-tooltip\.effect-support,\s*\.card-tooltip-arrow\.effect-support\s*\{\s*--card-tooltip-accent:\s*var\(--effect-support\);\s*\}/, "support-card hover previews and arrows must use the approved soft-yellow accent");
assert.match(shopPanel, /function offerTone[\s\S]*"shield"[\s\S]*"attack"[\s\S]*"dice"[\s\S]*"pity"[\s\S]*"heal"[\s\S]*"marked"[\s\S]*"cards"[\s\S]*effect-\$\{offerTone\(offer\.id\)\}/, "Shop offers and inventory items must use their semantic effect colors");
assert.match(styles, /\.shop-offer\[class\*="effect-"\] \.shop-offer-icon\s*\{\s*color:\s*var\(--semantic-effect-color\)/, "Shop offer icons must render with the canonical semantic palette");
assert.match(styles, /\.action-outcome-discard \.action-outcome-event,[\s\S]*var\(--effect-cards\)[\s\S]*\.action-outcome-skip \.action-outcome-event,[\s\S]*var\(--effect-turn\)/, "discard and skipped Action Outcome rows must use cyan and amber respectively");
assert.match(gameApp, /className="phase-event-tooltip" role="tooltip"><span className="tooltip-arrow phase-tooltip-arrow"/, "World Event tooltips must render the shared trigger arrow");
assert.match(partyRail, /role="tooltip"[\s\S]*tooltip-arrow roster-tooltip-arrow placement-/, "roster-effect tooltips must render a viewport-aware trigger arrow");
assert.match(cardHoverPreview, /role="tooltip"[\s\S]*tooltip-arrow card-tooltip-arrow[\s\S]*placement-/, "card-preview tooltips must render a placement-aware trigger arrow");
assert.match(cardHoverPreview, /const card = anchorRef\.current\?\.closest<HTMLElement>\("\.gothic-card"\);[\s\S]*const anchorRect = anchorRef\.current\.getBoundingClientRect\(\);[\s\S]*card\.classList\.contains\("history-card-detail"\)/, "card-preview tooltips and arrows must anchor to the visible card face while retaining history-panel placement");
assert.match(styles, /\.roster-tooltip-arrow\.placement-right[\s\S]*border-right:[^;]+;[\s\S]*\.roster-tooltip-arrow\.placement-left[\s\S]*border-left:[^;]+;/, "roster tooltip arrows must point toward triggers on either side");
assert.match(styles, /\.card-tooltip-arrow\.placement-top[\s\S]*border-top:[^;]+;[\s\S]*\.card-tooltip-arrow\.placement-right[\s\S]*border-right:[^;]+;/, "card tooltip arrows must point toward top and right card triggers");
assert.match(styles, /\.card-tooltip-arrow\.placement-right\s*\{[^}]*border-right:\s*10px solid var\(--card-tooltip-accent\);[^}]*transform:\s*translate\(-100%, -50%\);/, "right-side card-preview arrows must sit fully outside the tooltip border");
assert.match(gameApp, /function HandCardItem[\s\S]*whileHover=\{playable \? \{ y: selected \? -5 : -3, scale: selected \? 1\.02 : 1\.01 \}/, "enabled hand cards must use the faster Motion hover lift");
assert.match(styles, /\.action-hand\s*\{[\s\S]*--hand-card-gap:\s*16px;[\s\S]*--hand-card-width:\s*min\(260px, calc\(\(100% - 48px\) \/ 4\)\)/, "battle-hand cards must use a wider gap and an adaptive desktop cap");
assert.match(styles, /\.action-hand\s*\{[\s\S]*padding:\s*20px 10px 22px;/, "the battle hand must reserve vertical room for card hover effects");
assert.match(styles, /\.action-hand > \.hand-card-slot > \.gothic-card\.selected,[\s\S]*\.world-event-choice-card\.gothic-card\.selected[\s\S]*transform:\s*none\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/, "Motion hand selection and World Event selection must not add a second inner-card transform or shadow");
assert.match(styles, /\.action-hand > \.hand-card-slot\.selected > \.gothic-card::before,\s*\.world-event-choice-card\.gothic-card\.selected::before\s*\{[\s\S]*inset:\s*\.5cqw;[\s\S]*pointer-events:\s*none;[\s\S]*border:\s*1\.4cqw solid #e14b3f;/, "hand and World Event selected cards must share the thick red outer-edge highlight without affecting layout");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 282px\)\)\s*!important;/, "baseline desktop card galleries must keep two adaptive columns");
assert.match(styles, /@media \(min-width: 1600px\) and \(min-height: 900px\)\s*\{[\s\S]*--hand-card-width:\s*min\(300px,[\s\S]*\.lobby-skill-deck\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 310px\)\)/, "1080p layouts must render taller 300px hand cards and larger 310px gallery cards");
assert.match(styles, /@media \(min-width: 1600px\) and \(min-height: 900px\)\s*\{\s*\.character-review-layout\s*\{\s*grid-template-columns:\s*minmax\(300px, \.72fr\) minmax\(0, 1\.28fr\);/, "1080p and 1440p lobby previews must reserve a wider character-status column");
assert.match(styles, /\.lobby-skill-deck\s*\{[\s\S]*padding-block:\s*18px 22px;[\s\S]*scroll-padding-block:\s*18px 22px;/, "card-preview galleries must reserve top and bottom hover room");
assert.match(styles, /\.character-deck-panel \.public-character-deck > div:last-child\s*\{[\s\S]*padding-top:\s*24px;[\s\S]*scroll-padding-top:\s*24px;/, "the in-battle character-deck preview must reserve top clearance for card hover and focus effects");
assert.match(styles, /\.public-character-deck > div:last-child\s*\{[^}]*column-gap:\s*14px;[^}]*row-gap:\s*clamp\(26px, 1\.5vw, 34px\);[\s\S]*\.pile-card-grid\s*\{[^}]*column-gap:\s*14px;[^}]*row-gap:\s*clamp\(26px, 1\.5vw, 34px\);/, "hand and private pile galleries must share a consistent card-row gap");
assert.match(styles, /\.pile-card-slot\s*\{[^}]*position:\s*relative;[^}]*aspect-ratio:\s*2\s*\/\s*3;[^}]*\}[\s\S]*\.pile-card-slot > \.pile-review-card\.gothic-card\s*\{[^}]*position:\s*absolute\s*!important;[^}]*height:\s*100%\s*!important;/, "private pile cards must reserve their full visual height in the grid");
assert.match(styles, /\.action-hand > \.hand-card-slot > \.gothic-card:hover:not\(:disabled\),\s*\.pile-card-slot > \.gothic-card:hover:not\(:disabled\),\s*\.public-character-deck > div:last-child > \.gothic-card:hover:not\(:disabled\)\s*\{\s*transform:\s*none\s*!important;/, "nested Motion hand cards and private pile cards must not shift row spacing through an inner CSS transform");
assert.match(styles, /@media \(min-width: 2200px\) and \(min-height: 1200px\)\s*\{[\s\S]*--hand-card-width:\s*min\(330px,[\s\S]*\.lobby-skill-deck\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, min\(486px, calc\(\(100% - 28px\) \/ 2\)\)\)/, "1440p layouts must enlarge lobby cards by up to 50 percent without changing battle-hand sizing");
assert.match(styles, /\.history-card-detail\.gothic-card\s*\{[\s\S]*width:\s*min\(360px,/, "inspected history cards must use the larger preview size");
assert.match(styles, /\.gothic-card:disabled \.gothic-card-face\s*\{\s*opacity:\s*\.76;\s*\}[\s\S]*\.action-hand \.gothic-card:disabled\s*\{\s*filter:\s*none;\s*opacity:\s*\.68;/, "disabled cards should retain a clear unavailable state without an expensive moving filter");
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
assert.equal(specialSceneIds.length, 33, "every character-specific special card must have an explicit integrated-scene mapping");
for (const id of specialSceneIds) assert(existsSync(new URL(`../public/art/cards/special/${id}.webp`, import.meta.url)), `${id} must have a project-bound integrated-scene asset`);
const externalSceneIds = [...cardArtwork.matchAll(/externalScene\("([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(externalSceneIds, ["bad-luck", "control-cards", "marked-target", "piercing-attack", "shield-break", "steal-gold"], "all six Shop External Cards must have explicit integrated-scene mappings");
for (const id of externalSceneIds) assert(existsSync(new URL(`../public/art/cards/external/${id}.webp`, import.meta.url)), `${id} must have a project-bound External Card illustration`);
assert(!/kind:\s*"sprite"|spriteColumn|spriteRow|\/characters\//.test(cardArtwork), "special-card artwork must not retain sprite-sheet rendering data");
assert(!/gothic-card-sprite-crop|gothic-card-targets/.test(styles), "obsolete sprite and synthetic-target composition styles must stay removed");
const cardAssetRoot = new URL("../public/art/cards/", import.meta.url);
assert.deepEqual(readdirSync(cardAssetRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), ["common", "external", "preview", "special"], "the card-art directory must contain only original and optimized integrated-scene groups");
const commonSceneIds = [...cardArtwork.matchAll(/\bscene\("([^"]+)"/g)].map((match) => match[1]).sort();
const listedCardAssets = (group) => readdirSync(new URL(`${group}/`, cardAssetRoot)).filter((name) => name.endsWith(".webp")).map((name) => name.replace(/\.webp$/, "")).sort();
assert.deepEqual(listedCardAssets("common"), commonSceneIds, "common artwork must not retain unused image files");
assert.deepEqual(listedCardAssets("external"), externalSceneIds, "External artwork must not retain unused image files");
assert.deepEqual(listedCardAssets("special"), [...specialSceneIds].sort(), "special artwork must not retain unused image files");
assert.deepEqual(listedCardAssets("preview/common"), commonSceneIds, "every common card must have an optimized display preview");
assert.deepEqual(listedCardAssets("preview/external"), externalSceneIds, "every External Card must have an optimized display preview");
assert.deepEqual(listedCardAssets("preview/special"), [...specialSceneIds].sort(), "every special card must have an optimized display preview");
for (const group of ["common", "external", "special"]) {
  for (const asset of readdirSync(new URL(`${group}/`, cardAssetRoot)).filter((name) => name.endsWith(".webp"))) {
    assert(statSync(new URL(`preview/${group}/${asset}`, cardAssetRoot)).size < statSync(new URL(`${group}/${asset}`, cardAssetRoot)).size, `${group}/${asset} preview must remain smaller than its full illustration`);
  }
}
assert.match(cardArtwork, /"lost momentum"[\s\S]*"broken plan"[\s\S]*"empty gesture"/, "the three approved reference cards must have explicit artwork mappings");
assert.match(cardArtwork, /previewSource[\s\S]*preloadCardArtwork[\s\S]*artwork\.preview \?\? artwork\.scene[\s\S]*preloadedCardArtwork\.get\(source\)[\s\S]*image\.decoding = "async"[\s\S]*image\.decode\(\)/, "lobby artwork warming must deduplicate and decode optimized previews instead of full illustrations");
assert.match(cardFace, /const artworkSource = artwork\.preview \?\? artwork\.scene[\s\S]*<div className="gothic-card-art-backdrop"\/>[\s\S]*<img className="gothic-card-scene"[\s\S]*loading=\{imageLoading\}[\s\S]*fetchPriority=\{imagePriority\}[\s\S]*decoding="async"/, "card faces must render optimized artwork through a stable, priority-aware native image layer");
assert.doesNotMatch(cardFace, /loadedArtwork|revealCachedArtwork|onLoad=/, "card faces must not schedule React state updates merely to reveal browser-decoded artwork");
assert.doesNotMatch(cardFace, /<m\.img className="gothic-card-scene"|gothic-card-scene[\s\S]{0,300}animate=\{\{ opacity:/, "card artwork must not create a nested Motion compositor layer that can disappear during card overlap");
assert.match(cardHoverPreview, /backgroundImage: `url\("\$\{artwork\.preview \?\? artwork\.scene\}"\)`/, "card hover previews must reuse optimized display artwork");
assert.match(cardArtworkViewer, /className=\{`card-artwork-viewer-frame[\s\S]*aria-busy[\s\S]*src=\{artwork\.scene\}[\s\S]*Loading full illustration/, "the full-resolution artwork viewer must retain the original source and expose a stable loading state");
assert.match(cardArtworkViewer, /revealCachedScene[\s\S]*image\?\.complete && image\.naturalWidth > 0[\s\S]*ref=\{revealCachedScene\}/, "the full-art viewer must reveal an already-cached illustration without waiting for another load event");
assert.match(lobby, /useDeferredValue\(selectedHeroName\)[\s\S]*requestIdleCallback\(warmPortraits[\s\S]*onPointerEnter=\{\(\) => warmCharacterGroup\(group\.id\)\}[\s\S]*onPointerEnter=\{\(\) => preloadCardArtwork\(option\.skillDeck, "high"\)\}/, "character selection must acknowledge immediately while portrait and selected-deck previews warm around user intent");
assert(!/preloadCardArtwork\(visibleCharacterOptions\.flatMap/.test(lobby), "switching classes must not download every character's full deck before selection");
assert.match(lobby, /const CharacterSkillDeck = memo[\s\S]*<CharacterSkillDeck cards=\{shownDeck\}/, "socket and roster updates must not repaint an unchanged ten-card lobby deck");
assert.doesNotMatch(characterAvatar, /motion\/react|motion\/react-m|animate=/, "portrait loading must not create per-image Motion subscriptions or animation loops");
assert.doesNotMatch(cardFace, /motion\/react|motion\/react-m|repeat:\s*Infinity/, "card loading must not create per-card Motion subscriptions or animation loops");
const arenaBackground = new URL("../public/art/moonfall-citadel.webp", import.meta.url);
assert(existsSync(arenaBackground) && statSync(arenaBackground).size < 200_000, "the shared arena background must remain a compact WebP under 200 KB");
assert.match(styles, /moonfall-citadel\.webp/);
assert.doesNotMatch(styles, /moonfall-citadel\.png/, "runtime styles must not request the multi-megabyte PNG background");
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
assert.match(gameApp, /showOutcome && outcome && outcomePresentation \?[^\n]*outcomePresentation\.title[^\n]*cardNames=\{panelCardNames\}[^\n]*OutcomeEffectSummary[^\n]*fallbackDetail=\{outcomePresentation\.detail\}[^\n]*onInspectCard=\{inspectCard\}/, "local action panels must link card names in titles and concise fallback details");
assert.match(gameApp, /function ActionOutcomePanel[\s\S]*presentation\.title[\s\S]*cardNames=\{cardNames\}[\s\S]*presentation\.detail[\s\S]*cardNames=\{cardNames\}/, "Action Outcome panels must link visible card names");
assert.match(gameApp, /showLifeEvent && activeLifeEvent && activeLifePresentation \?[^\n]*activeLifePresentation\.title[^\n]*cardNames=\{panelCardNames\}[^\n]*activeLifePresentation\.detail[^\n]*cardNames=\{panelCardNames\}/, "defeat and revival panels must link card names in their explanations");
assert.match(gameApp, /showRunComplete \?[^\n]*<HighlightInteractiveNames[^\n]*cardNames=\{panelCardNames\}[^\n]*onInspectCard=\{inspectCard\}/, "battle-result panels must preserve interactive card names if the end reason names a card");
assert.match(worldEvents, /WorldEventLibrary[\s\S]*HighlightCardNames text=\{event\.fullDescription\}[\s\S]*ShatteredTributeChoicePanel[\s\S]*HighlightCardNames text=\{fullRule\}[\s\S]*ResolvedWorldEventPanel[\s\S]*HighlightCardNames text=\{formatViewpointText\(localResult\.privateSummary/, "World Event reference, choice, and result panels must link visible card names");
assert(sharedViewpoint.includes("return 'ACTION OUTCOME';"), "other-player actions must use the Action Outcome panel category");
assert(!sharedViewpoint.includes("TURN SUMMARY"), "the removed Turn Summary category must stay absent");
assert(sharedViewpoint.includes("useActualNames: true"), "outcome panels must preserve stored player names");
assert(worldEvents.includes("localPlayer.displayName") && worldEvents.includes("useActualNames: true"), "World Event panels must use real player names for local status, private controls, and private results");
assert(shopPanel.includes("player.displayName") && shopPanel.includes("&apos;S GOLD") && shopPanel.includes("&apos;s Inventory"), "the Shop panel must name the player who owns the Gold and Inventory");
assert(shopPanel.includes("panelError") && worldEvents.includes("panelConnectionError") && lobby.includes("panelError"), "panel errors must replace second-person references with the local player's real name");
assert.match(sharedTypes, /kind:\s*"card-transform" \| "phase-start" \| "shop-use";[\s\S]*actorId\?: string;[\s\S]*shopOfferId\?: string;/, "Shop-use notices must carry stable actor and catalog identities");
assert.match(sharedShop, /function appendShopUseNotice[\s\S]*kind: 'shop-use'[\s\S]*actorId: player\.id[\s\S]*shopOfferId: offer\.id[\s\S]*if \(offer\.category === 'potion'\) appendShopUseNotice[\s\S]*export function useShopItem[\s\S]*appendShopUseNotice\(game, player, offer, now\)/, "Potions must toast on immediate activation and Items only when used");
assert.match(gameApp, /GAME_NOTICE_DURATION_MS = 10_000[\s\S]*\["card-transform", "phase-start", "shop-use"\][\s\S]*GAME_NOTICE_DURATION_MS/, "all supported battle toasts must remain visible for ten seconds");
assert.match(gameApp, /function GameNoticeTitle[\s\S]*actor\.displayName[\s\S]*shop-notice-offer[\s\S]*offer\.name[\s\S]*<GameNoticeTitle notice=\{notice\}[\s\S]*HighlightPlayerNames text=\{notice\.detail\}[^>]*useActualNames/, "toasts must preserve real player names and color the activated Potion or Item name separately");
assert.match(gameApp, /<AnimatePresence>\{visibleNotices\.length > 0[\s\S]*variants=\{noticePresence\}[\s\S]*exit="exit"/, "battle notices must enter and exit through Motion presence");
assert.match(styles, /\.shop-notice-offer\.potion\s*\{[^}]*color:[^}]*\}[\s\S]*\.shop-notice-offer\.item\s*\{[^}]*color:/, "Potion and Item notice highlights must retain distinct colors");

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
assert.match(battlePhases, /PHASE_TIMELINE_LENGTH = 30[\s\S]*UNLIMITED_BATTLE_PHASES = 0[\s\S]*LAST_WORLD_EVENT_PHASE = 30/, "shared phase rules separate the frozen 30-cell visualization from the unlimited battle duration and World Event cutoff");
assert.match(gameApp, /getCurrentBattlePhase\(completedPhases\)[\s\S]*getVisualizedCompletedPhases\(completedPhases\)[\s\S]*getPhaseCountDenominator\(currentPhase\)[\s\S]*Array\.from\(\{ length: PHASE_TIMELINE_LENGTH \}\)/, "battle status keeps counting after phase 30 while rendering only the fixed timeline");
assert.match(gameApp, /<h1>Eliminate the opposing team<\/h1>[\s\S]*Defeat the enemy team, or press End battle to settle the current result\./, "battle UI retains its main objective and ending guidance after removing title overlines");
assert.doesNotMatch([gameApp, homeScreen, cardCatalog].join("\n"), /lead in HP after phase 30|30-PHASE MATCH|Survive thirty phases|Defeat the enemy team by phase 30/, "player-facing UI and catalog copy must not advertise the removed phase-30 ending");
assert.match(gameApp, /activeRoomId[\s\S]*<RoomGame roomId=\{activeRoomId\}[\s\S]*<HomeScreen/, "the bare app must enter through the home screen before rendering a room");
assert.match(homePage, /<GameMotionProvider><DeviceSupportGate><GameApp\/><\/DeviceSupportGate><\/GameMotionProvider>/, "the entire supported game must run inside the shared Motion provider");
assert.match(deviceSupportGate, /\(min-width: 1280px\) and \(min-height: 720px\)[\s\S]*MOBILE_DEVICE_PATTERN[\s\S]*userAgentData\?\.mobile === true[\s\S]*deviceQuery\.matches && !isMobileDevice\(\)[\s\S]*supported[\s\S]*key="supported"[\s\S]*\{children\}[\s\S]*key="unsupported"[\s\S]*<UnsupportedDevice\/>/, "only non-mobile viewports at or above 1280 by 720 may mount the Motion-wrapped app");
assert.match(deviceSupportGate, /App currently does not support this device\./, "unsupported devices must receive the requested static message");
assert.match(styles, /\.unsupported-device\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100dvh;[^}]*place-items:\s*center;[^}]*moonfall-citadel\.webp[^}]*\}/, "the unsupported-device message must fill a compact static themed background");
assert.doesNotMatch([gameApp, styles].join("\n"), /mobileParty|setMobileParty|mobile-party|mobile-rail|mobile-close/, "the removed mobile party drawer must not leave code or styles behind");
const viewportMediaConditions = [...styles.matchAll(/@media\s+([^\{]+)\{/g)].map((match) => match[1].replace(/\s+/g, " ").trim());
for (const condition of viewportMediaConditions.filter((value) => /(?:min|max)-(?:width|height):/.test(value))) {
  const minimumWidth = [...condition.matchAll(/min-width:\s*(\d+)px/g)].map((match) => Number(match[1]));
  const maximumWidth = [...condition.matchAll(/max-width:\s*(\d+)px/g)].map((match) => Number(match[1]));
  const maximumHeight = [...condition.matchAll(/max-height:\s*(\d+)px/g)].map((match) => Number(match[1]));
  assert(minimumWidth.length > 0 && minimumWidth.every((width) => width >= 1280), `viewport media query must not target widths below 1280px: ${condition}`);
  assert(maximumWidth.every((width) => width >= 1280), `viewport media query must not target widths below 1280px: ${condition}`);
  assert(maximumHeight.every((height) => height >= 720), `viewport media query must not target heights below 720px: ${condition}`);
}
assert.match(roomSocket, /\/api\/room\?\$\{query\.toString\(\)\}/, "room polling must include the selected room ID");
assert.match(roomSocket, /\/ws\?roomId=\$\{encodeURIComponent\(roomId\)\}/, "room WebSockets must include the selected room ID");
assert.match(lobby, /navigator\.clipboard\.writeText\(roomId\)[\s\S]*className=\{`lobby-room-id/, "the entire lobby room ID control must copy the room ID");
assert.match(lobby, /className="lobby-home-button" onClick=\{onReturnHome\}/, "the lobby must provide a return-to-home button");
assert.match(lobby, /Room <strong>\{roomId\}<\/strong>/, "the lobby must display its room ID");
assert.match(styles, /\.lobby-room-id strong\s*\{[\s\S]*font-size:\s*14px;/, "the lobby room ID must be visually prominent");
assert.match(styles, /\.home-screen\s*\{[\s\S]*min-height:\s*100dvh;[\s\S]*@media \(min-width: 1280px\) and \(min-height: 720px\) and \(max-height: 820px\)/, "the themed home screen must include a compact supported 720p desktop layout");
assert.match(shopPanel, /<header className="shop-heading">\s*<h2>BATTLE SHOP<\/h2>\s*<p>Rolled success \+1 Gold · rolled failure \+0\.5 Gold · Skip or Discard \+0\.5 Gold<\/p>\s*<\/header>/, "the Shop must use the full-size requested header and exact Gold reward summary");
assert.doesNotMatch(shopPanel, /Spend Gold without ending your turn/, "the removed Shop headline must stay absent");
assert.match(shopPanel, /<section className="shop-exchange-bar">[\s\S]*className="shop-exchange-actions">[\s\S]*className="shop-wallet"/, "the Gold wallet must sit below the header beside the pity exchange controls");
assert.doesNotMatch(shopPanel, /Repeat price increased/, "the Shop must not show repeat-price helper text");
assert.match(styles, /\.shop-tab-viewport\s*\{[^}]*height:\s*414px;[^}]*min-height:\s*414px;[^}]*overflow:\s*hidden;/, "every Shop tab must retain the same fixed content height");
assert.match(styles, /\.shop-offer-grid\s*\{[^}]*height:\s*100%;[^}]*grid-auto-rows:\s*minmax\(190px, auto\);[^}]*overflow-y:\s*auto;/, "the Shop catalog must hold two item rows and scroll additional offers internally");
assert.match(styles, /\.shop-inventory-view\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;[\s\S]*\.shop-inventory-view > \.shop-offer-grid\s*\{[^}]*height:\s*auto;[^}]*flex:\s*1;/, "inventory content must fill the fixed tab viewport without increasing or collapsing it");
assert.match(gameApp, /className="panel-expand-button shop-open-button"[\s\S]*className="shop-open-title"><ShoppingBag size=\{17\}\/?> SHOP[\s\S]*className="shop-open-gold"><Coins size=\{16\}\/?> \{formatGoldUnits\(localState\.goldUnits \?\? 0\)\} GOLD/, "the Shop launcher must center a History-sized title above a larger available-Gold line");

assert.match(lobby, /className="joined-main" onClick=\{\(\) => onSelectPlayer\(player\.id\)\}/, "clicking a joined player card must still review that player's character and deck");
assert(!/Review deck|Character pending/.test(lobby), "joined player cards must omit the redundant review action and random-character pending copy");
assert(!/UserCheck|local-session-icon|Your session/.test(lobby), "joined player cards must omit the local-session icon");
assert.match(lobby, /className=\{`ready-badge[\s\S]*aria-label=\{player\.ready \? "Ready" : "Not ready"\}[\s\S]*player\.ready \? <Check size=\{14\}\/> : <Clock3 size=\{14\}\/>/, "joined-player readiness must use compact ready and waiting icons with accessible labels");
assert(!/shownHero\.(?:title|summary|impact)/.test(lobby), "lobby character previews must omit title/class subtitles, summary copy, and battle impact");
assert(!/inspectedPlayer\.hero\.(?:title|summary|impact)/.test(gameApp), "battle character previews must omit title/class subtitles, summary copy, and battle impact");
assert.match(lobby, /PASSIVE · <b className="passive-name-highlight">\{shownHero\.passiveName\}<\/b>/, "lobby character previews must highlight the passive name independently from its label");
assert.match(gameApp, /PASSIVE · <b className="passive-name-highlight">\{inspectedPlayer\.hero\.passiveName\}<\/b>/, "battle character previews must highlight the passive name independently from its label");
assert.match(styles, /\.passive-callout \.passive-name-highlight\s*\{[^}]*color:\s*#ffd76a\s*!important;[^}]*text-shadow:/, "passive names must use the dedicated gold highlight color in the final theme layer");
assert.match(lobby, /className="joined-actions local-player-actions"[\s\S]*className="out-team-button"[\s\S]*Out team[\s\S]*onToggleReady/, "the local player action row must expose Out team and Ready controls");
assert.match(lobby, /className="joined-actions remote-player-actions"[\s\S]*className="remove-player-button"[\s\S]*Remove/, "another player's action row must expose the expanded Remove control");
assert.match(styles, /@media \(min-width: 1280px\) and \(min-height: 720px\) \{[\s\S]*\.team-slot-player,\s*\.empty-team-slot \{\s*height: 118px;\s*min-height: 118px;/, "joined players and empty slots must keep equal supported-desktop heights");
assert.match(styles, /@media \(min-width: 1280px\) and \(min-height: 720px\) \{[\s\S]*\.team-slot-player \{\s*display: grid;\s*grid-template-rows: minmax\(0, 1fr\) auto;/, "joined supported-desktop slots must reserve the action row so its bottom padding is not clipped");
assert.match(styles, /@media \(min-width: 1360px\) and \(min-height: 720px\) and \(max-height: 1100px\) \{[\s\S]*\.team-slot-player \.joined-actions \{\s*padding: 3px 7px 5px;[\s\S]*\.team-slot-player \.joined-actions button \{\s*min-height: 28px;/, "compact supported-desktop player slots must fit their profile and action rows without overlap");

const autoPanelVariants = [
  "action-success", "action-failure", "action-skip", "action-discard", "action-neutral",
  "action-outcome-success", "action-outcome-failure", "action-outcome-skip", "action-outcome-discard", "action-outcome-neutral",
  "life-revive", "life-defeat", "world-pending", "world-resolved",
  "battle-victory", "battle-defeat", "battle-complete",
];
for (const variant of autoPanelVariants) {
  assert(autoPanelVfx.includes(`| "${variant}"`), `${variant} must remain a supported automatic-panel VFX variant`);
  assert(styles.includes(`.auto-panel-vfx-${variant}`), `${variant} must retain its contextual automatic-panel palette`);
}
const semanticVfxPalettes = new Map([
  ["action-success", "#79dc98"], ["action-outcome-success", "#79dc98"], ["life-revive", "#80e0a0"],
  ["action-failure", "#f06558"], ["action-outcome-failure", "#f06558"], ["life-defeat", "#d54846"],
  ["action-skip", "#5aa8ff"], ["action-outcome-skip", "#5aa8ff"],
  ["action-discard", "#47c9c2"], ["action-outcome-discard", "#47c9c2"],
  ["world-pending", "#e0b74f"], ["world-resolved", "#c78cf0"],
  ["battle-victory", "#ffd66a"], ["battle-defeat", "#d7473f"],
]);
for (const [variant, primaryColor] of semanticVfxPalettes) {
  assert(styles.includes(`.auto-panel-vfx-${variant} { --panel-vfx-primary: ${primaryColor};`), `${variant} must retain its panel-semantic primary color`);
}
assert.match(gameApp, /modalAutoPanelVfx && <AutoPanelVfx key=\{modalAutoPanelVfx\.key\} variant=\{modalAutoPanelVfx\.variant\}/, "standard automatic panels must render their keyed contextual VFX layer");
assert.match(gameApp, /function getOutcomeVfxTone[\s\S]*outcome\?\.kind === "card"[\s\S]*"success" : "failure"[\s\S]*outcome\?\.kind === "discard"[\s\S]*return "discard"[\s\S]*outcome\?\.kind === "skip" \|\| outcome\?\.kind === "timeout" \|\| outcome\?\.kind === "forced-skip"[\s\S]*return "skip"/, "automatic action panels must map success, failure, discard, skip, timeout, and forced skip to semantic VFX colors");
assert.match(gameApp, /activeAutoPanel === "outcome"[\s\S]*variant: `action-\$\{outcomeVfxTone\}`[\s\S]*activeAutoPanel === "action-outcome"[\s\S]*variant: `action-outcome-\$\{outcomeVfxTone\}`/, "local actions and Action Outcome must select their own result-sensitive VFX families");
assert.match(gameApp, /activeAutoPanel === "life"[\s\S]*"life-revive" : "life-defeat"[\s\S]*activeAutoPanel === "world"[\s\S]*variant: "world-resolved"[\s\S]*activeAutoPanel === "battle"[\s\S]*"battle-victory"[\s\S]*"battle-defeat"[\s\S]*"battle-complete"/, "life events, resolved World Events, and every Battle Complete verdict must select contextual VFX");
assert.match(worldEvents, /world-event-choice-backdrop auto-panel-backdrop[\s\S]*<AutoPanelVfx key=\{pendingEvent\.id\} variant="world-pending"/, "the pending World Event choice must render its own keyed VFX layer");
const autoPanelVfxStyles = styles.slice(styles.indexOf("/* Contextual VFX shown only behind panels that open automatically. */"));
assert.match(autoPanelVfx, /useReducedMotion\(\)[\s\S]*if \(reduced\) return null/, "automatic-panel Motion VFX must disappear for reduced-motion users");
assert.match(autoPanelVfx, /animate=\{\{ opacity: \[0, 1, 1, 0\] \}\}[\s\S]*times: \[0, 0\.08, 0\.76, 1\]/, "the complete automatic-panel Motion layer must fade away after its entrance sequence");
assert.doesNotMatch(autoPanelVfx, /repeat:\s*Infinity/, "automatic-panel VFX must never continue for the life of an open panel");
assert.doesNotMatch(autoPanelVfxStyles, /@keyframes|animation(?:-[a-z-]+)?\s*:|transition(?:-[a-z-]+)?\s*:/i, "automatic-panel styling must contain geometry and palettes only");
assert.doesNotMatch(styles, /@keyframes|animation(?:-[a-z-]+)?\s*:|transition(?:-[a-z-]+)?\s*:/i, "all legacy CSS animations and transitions must stay removed");

assert.match(gameMotionProvider, /<LazyMotion features=\{domMax\} strict>[\s\S]*<MotionConfig reducedMotion="user"/, "the app must load Motion features once and honor the user's reduced-motion preference globally");
for (const preset of ["motionTransition", "screenPresence", "panelPresence", "noticePresence"]) {
  assert(motionPresets.includes(`export const ${preset}`), `${preset} must remain available from the shared Motion presets`);
}
const roomGameSource = gameApp.slice(gameApp.indexOf("function RoomGame"));
assert.match(gameApp, /function BattleHand[\s\S]*useState<string\[]>\(\(\) => cards\.map[\s\S]*<Reorder\.Group[\s\S]*axis="x"[\s\S]*values=\{displayedCards\.map\(\(card\) => card\.id\)\}[\s\S]*onReorder=\{setHandOrder\}[\s\S]*<HandCardItem/, "the local hand must isolate horizontal Motion reordering from the room-level render tree");
assert.doesNotMatch(roomGameSource, /\[handOrder, setHandOrder\]|onReorder=\{setHandOrder\}/, "drag frames must not update RoomGame state and repaint the full battle UI");
assert.match(gameApp, /selectionActive=\{isLocalActiveTurn\}[\s\S]*playable=\{isLocalActiveTurn && status === "connected" && !rolling\}/, "a selected card must stay visibly selected while rolling temporarily disables interaction");
assert.match(gameApp, /function HandCardItem[\s\S]*dragMomentum=\{false\}[\s\S]*Drag anywhere on the card[\s\S]*initial=\{\{ opacity: 0 \}\}[\s\S]*animate=\{\{ opacity: 1,[\s\S]*exit=\{\{ opacity: 0 \}\}/, "the whole hand card must be draggable while additions and removals use opacity-only Motion presence");
assert.match(gameApp, /dragElastic=\{0\.08\}[\s\S]*whileDrag=\{\{ y: -9, scale: 1\.025, rotate: 0\.6,[\s\S]*animate=\{\{ opacity: 1, y: selected \? -5 : 0, scale: selected \? 1\.02 : 1, rotate: 0 \}\}[\s\S]*motionTransition\.hand/, "hand cards must use a tight, fast drag response and explicitly restore resting rotation");
assert.match(gameApp, /onDragEnd=\{\(\) => \{ lastDragEndRef\.current = Date\.now\(\); \}\}[\s\S]*onClickCapture=\{\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/, "finishing a whole-card drag must not also select the card or open its artwork viewer");
assert.match(gameApp, /<Reorder\.Group[\s\S]*Drag anywhere on a card to rearrange[\s\S]*<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*<HandCardItem/, "hand additions, returns, discards, and graveyard moves must fade through AnimatePresence inside the reorder group");
assert.match(gameApp, /tabIndex=\{0\}[\s\S]*ArrowLeft[\s\S]*ArrowRight/, "whole-card dragging must retain keyboard reordering without a separate handle");
assert.match(gameApp, /function TurnClock[\s\S]*window\.setInterval\(updateClock, 250\)[\s\S]*const timer = window\.setTimeout\(expireTurn, delay \+ 50\)/, "clock ticks must stay local while turn expiry uses one room-level timeout");
assert.doesNotMatch(roomGameSource, /setNow\(Date\.now\(\)\)|setInterval\(\(\) => setNow/, "the battle tree must not rerender on clock polling ticks");
assert.match(gameApp, /const loadD20Dice = \(\) => import\("\.\/d20\/D20Dice"\)[\s\S]*dynamic<D20DiceProps>[\s\S]*requestIdleCallback\(warmDice/, "the 3D d20 stack must be code-split and warmed away from battle entry");
assert.match(gameApp, /<AnimatePresence initial=\{false\} mode="sync">\{phase === "lobby"[\s\S]*motionTransition\.screen/, "lobby-to-battle presence must mount immediately with the fast screen transition");
assert.doesNotMatch([gameApp, styles].join("\n"), /GripVertical|hand-reorder-handle|CardTravelVfx|useCardTravel|card-travel-|battle-card-vfx|card-zone-vfx|zone-vfx-slot-hidden/, "drag icons and every previous card-travel VFX implementation must stay removed");
assert.equal(existsSync(new URL("../ui/motion/CardTravelVfx.tsx", import.meta.url)), false, "the card-travel renderer file must stay removed");
assert.equal(existsSync(new URL("../ui/hooks/useCardTravel.ts", import.meta.url)), false, "the card-travel state observer file must stay removed");

console.log("Card UI contract passed: isolated fast Motion, native image loading, whole-card ordering, shared card sizing, and gameplay-safe UI contracts.");
