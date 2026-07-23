import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable. Run verification through npm run verify.");
const port = 32000 + Math.floor(Math.random() * 1000);
const baseEnvironment = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: String(port)
};

function run(command, args, environment = baseEnvironment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error("The production server exited before it became ready.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/room`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the production server.");
}

const server = spawn(process.execPath, ["backend/server.mjs"], {
  env: baseEnvironment,
  stdio: "inherit",
  windowsHide: true
});

try {
  await waitForServer(server);
  await run(process.execPath, [npmCli, "run", "test:realtime"], {
    ...baseEnvironment,
    ROOM_URL: `ws://127.0.0.1:${port}/ws`
  });
  await run(process.execPath, [npmCli, "run", "test:polling"], {
    ...baseEnvironment,
    ROOM_HTTP_URL: `http://127.0.0.1:${port}/api/room`
  });
  console.log("Full production verification passed.");
} finally {
  if (server.exitCode === null) server.kill();
}
