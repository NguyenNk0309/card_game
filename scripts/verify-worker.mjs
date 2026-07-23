import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable. Run verification through npm run verify.");

const port = 33000 + Math.floor(Math.random() * 1000);
const wranglerCli = resolve("node_modules/wrangler/bin/wrangler.js");
const persistenceDirectory = mkdtempSync(join(tmpdir(), "shattered-oath-worker-test-"));
const baseEnvironment = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: String(port)
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

async function waitForWorker(worker) {
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

const worker = spawn(process.execPath, [wranglerCli, "dev", "--local", "--persist-to", persistenceDirectory, "--ip", "127.0.0.1", "--port", String(port)], {
  env: baseEnvironment,
  stdio: "inherit",
  windowsHide: true
});

try {
  await waitForWorker(worker);
  await run(process.execPath, [npmCli, "run", "test:realtime"], {
    ...baseEnvironment,
    ROOM_URL: `ws://127.0.0.1:${port}/ws`
  });
  await run(process.execPath, [npmCli, "run", "test:polling"], {
    ...baseEnvironment,
    ROOM_HTTP_URL: `http://127.0.0.1:${port}/api/room`
  });
  console.log("Durable Object verification passed.");
} finally {
  if (worker.exitCode === null) {
    await new Promise((resolveExit) => {
      worker.once("exit", resolveExit);
      worker.kill();
    });
  }
  rmSync(persistenceDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
