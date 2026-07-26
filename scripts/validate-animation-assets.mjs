import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import {
  ANIMATION_MANIFEST_PATH,
  ANIMATION_MANIFEST_VERSION,
  COMMON_CARD_IDS,
  EXPECTED_CLIP_GROUPS,
  EXPECTED_CLIP_IDS,
  HEROES,
  UNIQUE_CARD_IDS,
  WORLD_EVENTS
} from "./animation-asset-contract.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const publicRoot = path.join(projectRoot, "public");
const manifestPath = path.join(projectRoot, ANIMATION_MANIFEST_PATH);
const catalogPath = path.join(projectRoot, "backend", "game", "catalog.ts");
const enginePath = path.join(projectRoot, "backend", "game", "engine.ts");
const gameAppPath = path.join(projectRoot, "ui", "GameApp.tsx");
const pixelStagePath = path.join(projectRoot, "ui", "components", "PixelBattleStage.tsx");
const globalCssPath = path.join(projectRoot, "app", "globals.css");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CLIP_ID_PATTERN = /^(?:character|card|shared|world|result)\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function fail(message) {
  throw new Error(message);
}

function assertInteger(value, label, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}; received ${String(value)}.`);
  }
}

function parseCatalogSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) fail(`Could not find ${startMarker} in backend/game/catalog.ts.`);
  return source.slice(start, end);
}

function extractMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function assertSameSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((item) => !actualSet.has(item));
  const unexpected = actual.filter((item) => !expectedSet.has(item));
  if (missing.length || unexpected.length || actualSet.size !== expectedSet.size) {
    fail(
      `${label} does not match the animation contract.` +
      `${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}` +
      `${unexpected.length ? ` Unexpected: ${unexpected.join(", ")}.` : ""}`
    );
  }
}

function requireSourceMatch(source, pattern, message) {
  if (!pattern.test(source)) fail(message);
}

async function validateUiIntegrationContract() {
  const [gameAppSource, pixelStageSource, globalCssSource] = await Promise.all([
    readFile(gameAppPath, "utf8"),
    readFile(pixelStagePath, "utf8"),
    readFile(globalCssPath, "utf8")
  ]);

  requireSourceMatch(
    pixelStageSource,
    /import\s+animationManifestData\s+from\s+["']@\/public\/pixel\/animations\.manifest\.json["']/,
    "PixelBattleStage must import public/pixel/animations.manifest.json."
  );
  requireSourceMatch(
    gameAppSource,
    /import\s*\{\s*PixelBattleStage\s*\}\s*from\s*["']\.\/components\/PixelBattleStage["']/,
    "GameApp must import PixelBattleStage."
  );
  requireSourceMatch(
    pixelStageSource,
    /context\.imageSmoothingEnabled\s*=\s*false/,
    "PixelBattleStage must disable canvas image smoothing for crisp pixel art."
  );
  requireSourceMatch(
    pixelStageSource,
    /timestamp\s*-\s*startedAt\s*>=\s*sequenceDuration[\s\S]{0,120}?completionRef\.current\(\)/,
    "PixelBattleStage must report completion only after its rendered animation sequence."
  );
  requireSourceMatch(
    pixelStageSource,
    /window\.requestAnimationFrame\(finishAfterRenderedSequence\)/,
    "PixelBattleStage completion must follow rendered animation frames so hidden tabs cannot skip VFX."
  );

  requireSourceMatch(
    gameAppSource,
    /<PixelBattleStage\b[^>]*\boutcome=\{outcome\}[^>]*\bonAnimationComplete=/s,
    "The action/observer panel must render PixelBattleStage and handle animation completion."
  );
  requireSourceMatch(
    gameAppSource,
    /<PixelBattleStage\b[^>]*\bmode=["']world["'][^>]*\bonAnimationComplete=/s,
    "The world-event panel must render PixelBattleStage in world mode."
  );
  requireSourceMatch(
    gameAppSource,
    /<PixelBattleStage\b[^>]*\bmode=["']result["'][^>]*\bonAnimationComplete=/s,
    "The battle-judgment panel must render PixelBattleStage in result mode."
  );

  requireSourceMatch(
    gameAppSource,
    /window\.setTimeout\(\(\)\s*=>\s*\{[\s\S]{0,500}?\},\s*5000\)/,
    "Automatic panels must retain the five-second minimum reading timer."
  );
  requireSourceMatch(
    gameAppSource,
    /automaticPanelReady\s*=\s*Boolean\([^;]*panelTiming\.minimumElapsed\s*&&\s*panelTiming\.animationComplete\)/,
    "Automatic panel readiness must require both the five-second minimum and animation completion."
  );
  requireSourceMatch(
    gameAppSource,
    /resultAnimationReady\s*=\s*Boolean\([^;]*panelTiming\.animationComplete\)/,
    "Battle-result panel readiness must require animation completion."
  );
  requireSourceMatch(
    gameAppSource,
    /panelInteractionLocked\s*=\s*Boolean\([^;]*!automaticPanelReady[^;]*!resultAnimationReady/,
    "Panel interaction locking must use automatic and battle-result animation readiness."
  );
  requireSourceMatch(
    gameAppSource,
    /disabled=\{panelInteractionLocked\}/,
    "The modal close control must remain disabled while panel animation is locked."
  );
  requireSourceMatch(
    gameAppSource,
    /if\s*\(!automaticPanelReady\s*\|\|\s*!activeAutoPanel\)\s*return/,
    "Automatic panel dismissal must be gated by automaticPanelReady."
  );

  const combinedUiSource = `${gameAppSource}\n${pixelStageSource}\n${globalCssSource}`;
  if (/\bbattle-card-vfx\b/.test(combinedUiSource)) {
    fail("Legacy battle-card-vfx markup or styling must be removed before the pixel animation stage is enabled.");
  }
}

async function validateCatalogContract() {
  const [source, engineSource] = await Promise.all([
    readFile(catalogPath, "utf8"),
    readFile(enginePath, "utf8")
  ]);
  const heroSection = parseCatalogSection(source, "export const HERO_TEMPLATES", "type CardWithoutPity");
  const uniqueSection = parseCatalogSection(source, "export const CHARACTER_SKILL_CARDS", "const COMMON_ACTION_CARDS");
  const commonSection = parseCatalogSection(source, "const COMMON_ACTION_CARDS", "export const ACTION_CARDS");

  const heroNames = extractMatches(heroSection, /\{\s*name:\s*"([^"]+)"/g);
  const uniqueCardIds = extractMatches(uniqueSection, /\{\s*id:\s*"([^"]+)"/g);
  const commonCardIds = extractMatches(commonSection, /\{\s*id:\s*"([^"]+)"/g);

  assert.equal(heroNames.length, 10, "The game catalog must contain exactly 10 heroes.");
  assert.equal(uniqueCardIds.length, 30, "The game catalog must contain exactly 30 unique cards.");
  assert.equal(commonCardIds.length, 7, "The game catalog must contain exactly 7 common cards.");
  assertSameSet(heroNames, HEROES.map((hero) => hero.name), "Hero catalog");
  assertSameSet(uniqueCardIds, UNIQUE_CARD_IDS, "Unique-card catalog");
  assertSameSet(commonCardIds, COMMON_CARD_IDS, "Common-card catalog");

  for (const hero of HEROES) {
    const derivedId = hero.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    assert.equal(hero.id, derivedId, `Hero animation ID for ${hero.name} must use its normalized name.`);
  }
  for (const worldEvent of WORLD_EVENTS) {
    if (!engineSource.includes(`"${worldEvent.name}"`)) {
      fail(`World-event contract contains ${worldEvent.name}, but backend/game/engine.ts does not.`);
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePngChunks(buffer, sourceLabel) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${sourceLabel} is not a PNG file.`);
  }

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) fail(`${sourceLabel} has a truncated PNG chunk header.`);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > buffer.length) fail(`${sourceLabel} has a truncated ${type} chunk.`);

    const expectedCrc = buffer.readUInt32BE(crcOffset);
    const actualCrc = crc32(buffer.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) fail(`${sourceLabel} has an invalid ${type} chunk checksum.`);

    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    offset = crcOffset + 4;
    if (type === "IEND") break;
  }

  if (!chunks.some((chunk) => chunk.type === "IEND")) fail(`${sourceLabel} has no IEND chunk.`);
  if (offset !== buffer.length) fail(`${sourceLabel} contains data after its IEND chunk.`);
  return chunks;
}

function paethPredictor(left, up, upperLeft) {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function reconstructScanlines(inflated, width, height, bytesPerPixel, rowBytes, sourceLabel) {
  const expectedLength = height * (rowBytes + 1);
  if (inflated.length !== expectedLength) {
    fail(`${sourceLabel} has ${inflated.length} decompressed bytes; expected ${expectedLength}.`);
  }

  const rows = [];
  let offset = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[offset];
    const filtered = inflated.subarray(offset + 1, offset + 1 + rowBytes);
    const row = Buffer.alloc(rowBytes);
    if (filter > 4) fail(`${sourceLabel} uses unsupported PNG filter ${filter}.`);

    for (let index = 0; index < rowBytes; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const up = previous[index] ?? 0;
      const upperLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      const prediction =
        filter === 0 ? 0 :
        filter === 1 ? left :
        filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) :
        paethPredictor(left, up, upperLeft);
      row[index] = (filtered[index] + prediction) & 0xff;
    }

    rows.push(row);
    previous = row;
    offset += rowBytes + 1;
  }
  return rows;
}

function inspectTransparency(rows, width, colorType, bitDepth, transparency, sourceLabel) {
  let transparentPixels = 0;
  let visiblePixels = 0;
  let partialAlphaPixels = 0;

  const recordAlpha = (alpha) => {
    if (alpha === 0) transparentPixels += 1;
    else {
      visiblePixels += 1;
      if (alpha !== 255) partialAlphaPixels += 1;
    }
  };

  if (colorType === 6) {
    for (const row of rows) {
      for (let x = 0; x < width; x += 1) recordAlpha(row[(x * 4) + 3]);
    }
  } else if (colorType === 4) {
    for (const row of rows) {
      for (let x = 0; x < width; x += 1) recordAlpha(row[(x * 2) + 1]);
    }
  } else if (colorType === 3) {
    if (!transparency?.length) fail(`${sourceLabel} is indexed-color but has no tRNS transparency chunk.`);
    const mask = (1 << bitDepth) - 1;
    for (const row of rows) {
      for (let x = 0; x < width; x += 1) {
        const bitOffset = x * bitDepth;
        const byte = row[Math.floor(bitOffset / 8)];
        const shift = 8 - bitDepth - (bitOffset % 8);
        const paletteIndex = (byte >> shift) & mask;
        recordAlpha(transparency[paletteIndex] ?? 255);
      }
    }
  } else {
    fail(`${sourceLabel} must use RGBA, grayscale-alpha, or indexed color with transparency.`);
  }

  if (transparentPixels === 0) {
    fail(`${sourceLabel} has no transparent pixels; remove the generated/chroma background.`);
  }
  if (visiblePixels === 0) fail(`${sourceLabel} is completely transparent.`);
  return { transparentPixels, visiblePixels, partialAlphaPixels };
}

function inspectPng(buffer, sourceLabel) {
  const chunks = parsePngChunks(buffer, sourceLabel);
  const header = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!header || header.length !== 13) fail(`${sourceLabel} has no valid IHDR chunk.`);

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const compression = header[10];
  const filter = header[11];
  const interlace = header[12];
  assertInteger(width, `${sourceLabel} width`);
  assertInteger(height, `${sourceLabel} height`);
  if (bitDepth !== 8) fail(`${sourceLabel} must be exported as 8-bit pixel art; received ${bitDepth}-bit.`);
  if (![3, 4, 6].includes(colorType)) fail(`${sourceLabel} does not contain an alpha-capable color format.`);
  if (compression !== 0 || filter !== 0 || interlace !== 0) {
    fail(`${sourceLabel} must use standard compression/filtering and be non-interlaced.`);
  }

  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  if (!compressed.length) fail(`${sourceLabel} has no image data.`);

  let inflated;
  try {
    inflated = inflateSync(compressed);
  } catch (error) {
    fail(`${sourceLabel} image data could not be decompressed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const rows = reconstructScanlines(inflated, width, height, bytesPerPixel, rowBytes, sourceLabel);
  const transparency = chunks.find((chunk) => chunk.type === "tRNS")?.data;
  const alpha = inspectTransparency(rows, width, colorType, bitDepth, transparency, sourceLabel);
  return { width, height, rows, channels, colorType, transparency, ...alpha };
}

function alphaAt(inspection, x, y) {
  const row = inspection.rows[y];
  if (inspection.colorType === 6) return row[(x * 4) + 3];
  if (inspection.colorType === 4) return row[(x * 2) + 1];
  return inspection.transparency?.[row[x]] ?? 255;
}

function inspectAnimationFrames(inspection, clipId, frameWidth, frameHeight, frames, columns) {
  const frameHashes = [];
  const isCharacter = clipId.startsWith("character.");
  const pixelsPerFrame = frameWidth * frameHeight;
  for (let frame = 0; frame < frames; frame += 1) {
    const frameX = (frame % columns) * frameWidth;
    const frameY = Math.floor(frame / columns) * frameHeight;
    let visiblePixels = 0;
    let partialAlphaPixels = 0;
    let hash = 0x811c9dc5;

    for (let y = frameY; y < frameY + frameHeight; y += 1) {
      const row = inspection.rows[y];
      for (let x = frameX; x < frameX + frameWidth; x += 1) {
        const alpha = alphaAt(inspection, x, y);
        if (alpha > 0) visiblePixels += 1;
        if (alpha > 0 && alpha < 255) partialAlphaPixels += 1;
        const pixelOffset = x * inspection.channels;
        for (let channel = 0; channel < inspection.channels; channel += 1) {
          const value = alpha === 0 ? 0 : row[pixelOffset + channel];
          hash = Math.imul(hash ^ value, 0x01000193) >>> 0;
        }
      }
    }

    if (visiblePixels === 0) fail(`${clipId} frame ${frame + 1} is completely transparent.`);
    const minimumTransparentPixels = Math.ceil(pixelsPerFrame * (isCharacter ? 0.25 : 0.01));
    if (pixelsPerFrame - visiblePixels < minimumTransparentPixels) {
      fail(
        `${clipId} frame ${frame + 1} does not have enough transparent background ` +
        `(${pixelsPerFrame - visiblePixels}/${pixelsPerFrame} transparent pixels).`
      );
    }
    if (isCharacter && partialAlphaPixels > 0) {
      fail(`${clipId} frame ${frame + 1} has ${partialAlphaPixels} partially transparent pixels; character sprites must have crisp pixel edges.`);
    }
    frameHashes.push(hash);
  }
  if (frames > 1 && new Set(frameHashes).size < 2) {
    fail(`${clipId} repeats the same pixels in every frame; it must contain visible animation.`);
  }
}

function resolvePublicAsset(source, clipId) {
  if (typeof source !== "string" || !source.startsWith("/pixel/") || source.includes("\\") || source.includes("?") || source.includes("#")) {
    fail(`${clipId}.src must be an absolute /pixel/*.png path.`);
  }
  if (!source.toLowerCase().endsWith(".png")) fail(`${clipId}.src must reference a PNG file.`);
  const assetPath = path.resolve(publicRoot, `.${source}`);
  const relative = path.relative(publicRoot, assetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${clipId}.src escapes the public directory.`);
  return assetPath;
}

function validateClipMetadata(clipId, clip) {
  if (!CLIP_ID_PATTERN.test(clipId)) fail(`Invalid animation clip ID: ${clipId}.`);
  if (!clip || typeof clip !== "object" || Array.isArray(clip)) fail(`${clipId} must be an object.`);

  assertInteger(clip.frameWidth, `${clipId}.frameWidth`, 1, 1024);
  assertInteger(clip.frameHeight, `${clipId}.frameHeight`, 1, 1024);
  assertInteger(clip.frames, `${clipId}.frames`, 1, 512);
  const columns = clip.columns ?? clip.frames;
  assertInteger(columns, `${clipId}.columns`, 1, clip.frames);
  const expectedFrameSize = clipId.startsWith("character.") ? 64 : 128;
  if (clip.frameWidth !== expectedFrameSize || clip.frameHeight !== expectedFrameSize) {
    fail(`${clipId} frames must be ${expectedFrameSize}x${expectedFrameSize}px.`);
  }
  if (typeof clip.fps !== "number" || !Number.isFinite(clip.fps) || clip.fps < 1 || clip.fps > 60) {
    fail(`${clipId}.fps must be a finite number from 1 to 60.`);
  }
  if (clip.loop != null && typeof clip.loop !== "boolean") fail(`${clipId}.loop must be boolean when provided.`);
  if (clip.frames > 1 && clip.fps < 4) fail(`${clipId}.fps is too slow for a readable animation.`);
  const durationSeconds = clip.frames / clip.fps;
  if (durationSeconds < 0.05 || durationSeconds > 12) {
    fail(`${clipId} lasts ${durationSeconds.toFixed(2)} seconds; clips must last from 0.05 to 12 seconds.`);
  }
  if (EXPECTED_CLIP_IDS.includes(clipId) && clip.frames < 2) {
    fail(`${clipId} must contain at least 2 frames; a static image is not an animation.`);
  }
  const isIdle = /^character\.[^.]+\.idle$/.test(clipId);
  if (clip.loop === true && !isIdle) {
    fail(`${clipId} cannot loop because automatic panels must receive an animation-complete event.`);
  }

  return {
    assetPath: resolvePublicAsset(clip.src, clipId),
    expectedWidth: clip.frameWidth * columns,
    expectedHeight: clip.frameHeight * Math.ceil(clip.frames / columns),
    frameWidth: clip.frameWidth,
    frameHeight: clip.frameHeight,
    frames: clip.frames,
    columns
  };
}

async function main({ uiOnly = false } = {}) {
  await validateCatalogContract();
  await validateUiIntegrationContract();
  if (uiOnly) {
    console.log("Animation UI integration passed: action, world, and result stages are wired to five-second/animation-complete panel gating.");
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(
      `Unable to read ${ANIMATION_MANIFEST_PATH}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("Animation manifest must be an object.");
  assert.equal(
    manifest.version,
    ANIMATION_MANIFEST_VERSION,
    `Animation manifest version must be ${ANIMATION_MANIFEST_VERSION}.`
  );
  if (!manifest.clips || typeof manifest.clips !== "object" || Array.isArray(manifest.clips)) {
    fail("Animation manifest must contain a clips object.");
  }

  const manifestIds = Object.keys(manifest.clips);
  const missingIds = EXPECTED_CLIP_IDS.filter((clipId) => !(clipId in manifest.clips));
  if (missingIds.length) {
    const groupSummary = Object.entries(EXPECTED_CLIP_GROUPS)
      .map(([group, ids]) => `${group}: ${ids.filter((id) => missingIds.includes(id)).length}`)
      .filter((line) => !line.endsWith(": 0"))
      .join(", ");
    fail(`Animation manifest is missing ${missingIds.length} required clips (${groupSummary}). First missing IDs: ${missingIds.slice(0, 20).join(", ")}.`);
  }

  const caseFoldedIds = new Set();
  const assetCache = new Map();
  let partialAlphaPixels = 0;
  for (const clipId of manifestIds) {
    const folded = clipId.toLowerCase();
    if (caseFoldedIds.has(folded)) fail(`Animation clip ID is duplicated with different casing: ${clipId}.`);
    caseFoldedIds.add(folded);

    const { assetPath, expectedWidth, expectedHeight, frameWidth, frameHeight, frames, columns } =
      validateClipMetadata(clipId, manifest.clips[clipId]);
    let inspection = assetCache.get(assetPath);
    if (!inspection) {
      let buffer;
      try {
        buffer = await readFile(assetPath);
      } catch (error) {
        fail(`${clipId} references missing asset ${path.relative(projectRoot, assetPath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
      inspection = inspectPng(buffer, path.relative(projectRoot, assetPath));
      assetCache.set(assetPath, inspection);
      partialAlphaPixels += inspection.partialAlphaPixels;
    }
    if (inspection.width !== expectedWidth || inspection.height !== expectedHeight) {
      fail(
        `${clipId} expects ${expectedWidth}x${expectedHeight}px from its frame grid, ` +
        `but ${path.relative(projectRoot, assetPath)} is ${inspection.width}x${inspection.height}px.`
      );
    }
    inspectAnimationFrames(inspection, clipId, frameWidth, frameHeight, frames, columns);
  }

  const requiredCount = EXPECTED_CLIP_IDS.length;
  const extraCount = manifestIds.length - requiredCount;
  console.log(
    `Animation assets passed: ${requiredCount} required clips, ${extraCount} extra clips, ` +
    `${assetCache.size} PNG files, ${HEROES.length} heroes, ${UNIQUE_CARD_IDS.length} unique cards, ` +
    `${COMMON_CARD_IDS.length} common cards, and ${WORLD_EVENTS.length} world events.`
  );
  if (partialAlphaPixels > 0) {
    console.log(`Transparency check: ${partialAlphaPixels} partially transparent pixels retained for VFX blending.`);
  }
}

const invokedAsScript =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  main({ uiOnly: process.argv.includes("--ui-only") }).catch((error) => {
    console.error(`Animation asset verification failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export { inspectAnimationFrames, inspectPng, validateClipMetadata, validateUiIntegrationContract };
