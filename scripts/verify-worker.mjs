import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable. Run verification through npm run verify.");

const firstPort = 33000 + Math.floor(Math.random() * 900);
const wranglerCli = resolve("node_modules/wrangler/bin/wrangler.js");
const baseEnvironment = {
  ...process.env,
  HOSTNAME: "127.0.0.1"
};

function run(command, args, environment = baseEnvironment) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

async function waitForWorker(worker, port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (worker.exitCode !== null) throw new Error("The Durable Object worker exited before it became ready.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/room`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Timed out waiting for the Durable Object worker.");
}

async function verifyWorker(testMode, port, scripts) {
  const persistenceDirectory = mkdtempSync(join(tmpdir(), `shattered-oath-worker-test-${testMode}-`));
  const environment = { ...baseEnvironment, PORT: String(port), TEST_MODE: testMode };
  const worker = spawn(process.execPath, [wranglerCli, "dev", "--local", "--persist-to", persistenceDirectory, "--ip", "127.0.0.1", "--port", String(port), "--var", `TEST_MODE:${testMode}`], {
    env: environment,
    stdio: "inherit",
    windowsHide: true
  });
  try {
    await waitForWorker(worker, port);
    for (const script of scripts) {
      const connectionEnvironment = script === "test:rooms"
        ? { ROOMS_ORIGIN: `http://127.0.0.1:${port}` }
        : script === "test:polling"
          ? { ROOM_HTTP_URL: `http://127.0.0.1:${port}/api/room` }
          : { ROOM_URL: `ws://127.0.0.1:${port}/ws` };
      await run(process.execPath, [npmCli, "run", script], { ...environment, ...connectionEnvironment });
    }
  } finally {
    if (worker.exitCode === null) {
      await new Promise((resolveExit) => {
        worker.once("exit", resolveExit);
        worker.kill();
      });
    }
    rmSync(persistenceDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

await verifyWorker("false", firstPort, ["test:rooms", "test:realtime", "test:polling"]);
await verifyWorker("true", firstPort + 1, ["test:realtime"]);
console.log("Durable Object verification passed with TEST_MODE false and true.");
