import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
mkdirSync('dist/assets', { recursive: true });

for (const entry of readdirSync('dist')) {
  if (entry === 'assets' || entry === 'server' || entry === '.openai') continue;
  cpSync(`dist/${entry}`, `dist/assets/${entry}`, { recursive: true });
}

const cloudflareWorker = readFileSync('backend/realtime-worker.js', 'utf8');
const durableClassStart = cloudflareWorker.indexOf('export class GameRoom');
const defaultExportStart = cloudflareWorker.indexOf('export default', durableClassStart);
if (durableClassStart < 0 || defaultExportStart < 0) throw new Error('Could not locate the Durable Object export in the realtime worker.');

const sitesWorker = `${cloudflareWorker.slice(0, durableClassStart)}${cloudflareWorker.slice(defaultExportStart)}`.replace(
  /      if \(env\.GAME_ROOM\) \{[\s\S]*?      if \(env\.REALTIME_ORIGIN\) return proxyRoomRequest\(request, env\.REALTIME_ORIGIN\);\r?\n      return handleRoomRequest\(request\);/,
  `      if (env.REALTIME_ORIGIN) return proxyRoomRequest(request, env.REALTIME_ORIGIN);
      return json({ error: 'The shared room backend is not configured.' }, 503);`
);
if (sitesWorker.includes('export class GameRoom') || sitesWorker.includes('env.GAME_ROOM')) throw new Error('Sites worker still contains a Durable Object binding.');
if (!sitesWorker.includes('env.REALTIME_ORIGIN') || sitesWorker.includes('return handleRoomRequest(request);')) {
  throw new Error('Sites worker must proxy every room request to the authoritative realtime backend.');
}
writeFileSync('dist/server/index.js', sitesWorker);

cpSync('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Prepared Sites artifact: Worker entrypoint and static assets');
