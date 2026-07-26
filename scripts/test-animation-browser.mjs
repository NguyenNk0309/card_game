import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const appPort = 34000 + Math.floor(Math.random() * 500);
const debugPort = 34500 + Math.floor(Math.random() * 500);
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) {
  throw new Error("Chrome or Edge was not found. Set CHROME_PATH to run the animation browser test.");
}

const browserProfile = mkdtempSync(join(tmpdir(), "shattered-oath-animation-browser-"));
const serverEnvironment = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: String(appPort)
};
const server = spawn(process.execPath, ["backend/server.mjs"], {
  env: serverEnvironment,
  stdio: "inherit",
  windowsHide: true
});
let browser;
let socket;

async function waitFor(check, message, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (server.exitCode !== null) throw new Error("The production server exited during the browser test.");
    try {
      const result = await check();
      if (result) return result;
    } catch {
      // The process or endpoint is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(message);
}

class DevtoolsClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    webSocket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const browserProbe = String.raw`
(async () => {
  const response = await fetch("/pixel/animations.manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest request failed with " + response.status + ".");
  const manifest = await response.json();
  if (manifest.version !== 1 || !manifest.clips) throw new Error("The runtime manifest has an invalid shape.");

  const images = new Map();
  const loadImage = async (source) => {
    if (images.has(source)) return images.get(source);
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    await image.decode();
    images.set(source, image);
    return image;
  };

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Chrome could not create a 2D canvas context.");
  context.imageSmoothingEnabled = false;
  let decodedFrames = 0;
  let visiblePixels = 0;

  for (const [clipId, clip] of Object.entries(manifest.clips)) {
    const image = await loadImage(clip.src);
    const columns = clip.columns || clip.frames;
    const rows = Math.ceil(clip.frames / columns);
    const expectedWidth = clip.frameWidth * columns;
    const expectedHeight = clip.frameHeight * rows;
    if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight) {
      throw new Error(
        clipId + " decoded at " + image.naturalWidth + "x" + image.naturalHeight +
        "; expected " + expectedWidth + "x" + expectedHeight + "."
      );
    }

    canvas.width = clip.frameWidth;
    canvas.height = clip.frameHeight;
    context.imageSmoothingEnabled = false;
    const hashes = new Set();
    for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
      const sourceX = (frameIndex % columns) * clip.frameWidth;
      const sourceY = Math.floor(frameIndex / columns) * clip.frameHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        clip.frameWidth,
        clip.frameHeight,
        0,
        0,
        clip.frameWidth,
        clip.frameHeight
      );
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let frameVisiblePixels = 0;
      let hash = 2166136261;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] > 0) frameVisiblePixels += 1;
        hash = Math.imul(hash ^ pixels[offset], 16777619) >>> 0;
        hash = Math.imul(hash ^ pixels[offset + 1], 16777619) >>> 0;
        hash = Math.imul(hash ^ pixels[offset + 2], 16777619) >>> 0;
        hash = Math.imul(hash ^ pixels[offset + 3], 16777619) >>> 0;
      }
      if (frameVisiblePixels === 0) throw new Error(clipId + " has an empty decoded frame.");
      hashes.add(hash);
      visiblePixels += frameVisiblePixels;
      decodedFrames += 1;
    }
    if (clip.frames > 1 && hashes.size < 2) {
      throw new Error(clipId + " does not visibly animate after browser decoding.");
    }
  }

  const oldVfx = document.querySelector(".battle-card-vfx");
  if (oldVfx) throw new Error("The retired battle-card-vfx layer still renders.");
  return {
    clips: Object.keys(manifest.clips).length,
    assets: images.size,
    decodedFrames,
    visiblePixels,
    smoothingDisabled: context.imageSmoothingEnabled === false,
    pageReady: document.readyState
  };
})()
`;

try {
  await waitFor(
    async () => (await fetch(`http://127.0.0.1:${appPort}/`, { cache: "no-store" })).ok,
    "Timed out waiting for the production app."
  );

  browser = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${browserProfile}`,
    `http://127.0.0.1:${appPort}/`
  ], {
    stdio: "ignore",
    windowsHide: true
  });

  const page = await waitFor(async () => {
    if (browser.exitCode !== null) throw new Error("The headless browser exited before connecting.");
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { cache: "no-store" });
    if (!response.ok) return null;
    const pages = await response.json();
    return pages.find((item) => item.type === "page" && item.url.includes(`127.0.0.1:${appPort}`));
  }, "Timed out waiting for the headless browser.");

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const client = new DevtoolsClient(socket);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${appPort}/` });
  await waitFor(async () => {
    const readiness = await client.send("Runtime.evaluate", {
      expression: "({ href: location.href, readyState: document.readyState })",
      returnByValue: true
    });
    const value = readiness.result?.value;
    return value?.href === `http://127.0.0.1:${appPort}/` && value?.readyState === "complete";
  }, "Timed out waiting for the app page to finish loading in Chrome.");
  const evaluation = await client.send("Runtime.evaluate", {
    expression: browserProbe,
    awaitPromise: true,
    returnByValue: true
  });
  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
  }
  const result = evaluation.result?.value;
  if (!result?.smoothingDisabled || result.pageReady !== "complete") {
    throw new Error(`Unexpected browser probe result: ${JSON.stringify(result)}`);
  }
  console.log(
    `Animation browser test passed: ${result.clips} clips, ${result.assets} decoded PNGs, ` +
    `${result.decodedFrames} canvas-drawn frames, and ${result.visiblePixels} visible pixels.`
  );
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  rmSync(browserProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
