// Launch the already-installed native Lightpanda MCP with X cookies read from
// the existing locally authenticated Chromium. Cookie bytes are piped through
// fd 3 to a minimal memfd launcher, never written to disk or logged.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CDP_PORT = Number(process.env.X_GROWTH_BROWSER_CDP_PORT || 9222);
const LIGHTPANDA_BIN = process.env.X_GROWTH_LIGHTPANDA_BINARY || '/usr/local/bin/lightpanda';
const X_DOMAINS = /(?:^|\.)(?:x\.com|twitter\.com)$/i;

export async function readXSessionCookies({ port = CDP_PORT } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5500) });
  if (!response.ok) throw new Error('Authenticated Chromium CDP endpoint unavailable');
  const { webSocketDebuggerUrl } = await response.json();
  if (typeof webSocketDebuggerUrl !== 'string' || !webSocketDebuggerUrl) throw new Error('CDP browser websocket unavailable');
  const all = await new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const timeout = setTimeout(() => { socket.close(); reject(new Error('CDP cookie inspection timed out')); }, 15000);
    const finish = (error, value) => { clearTimeout(timeout); socket.close(); error ? reject(error) : resolve(value); };
    socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method: 'Storage.getCookies' })), { once: true });
    socket.addEventListener('error', () => finish(new Error('CDP cookie inspection failed')), { once: true });
    socket.addEventListener('message', (message) => {
      try {
        const parsed = JSON.parse(String(message.data));
        if (parsed.id !== 1) return;
        if (parsed.error) throw new Error('CDP rejected cookie inspection');
        finish(null, parsed.result?.cookies || []);
      } catch (error) { finish(error); }
    });
  });
  const cookies = all.filter(cookie => X_DOMAINS.test(cookie.domain || ''));
  if (!cookies.some(cookie => cookie.name === 'auth_token' && cookie.value)
    || !cookies.some(cookie => cookie.name === 'ct0' && cookie.value)) {
    throw new Error('Authenticated X session unavailable in Chromium; Lightpanda will not publish');
  }
  return cookies;
}

export async function spawnLightpanda({ stdio = ['pipe', 'pipe', 'pipe'] } = {}) {
  const cookies = await readXSessionCookies();
  // Lightpanda's cookie loader requires a seekable file, not a pipe.
  // The launcher receives an anonymous pipe, creates a seekable memfd, and
  // replaces itself with the *same installed* Lightpanda executable.
  const launcher = fileURLToPath(new URL('./lightpanda_memfd_launcher.py', import.meta.url));
  const child = spawn('/usr/bin/python3', [launcher, LIGHTPANDA_BIN], {
    stdio: [...stdio, 'pipe'],
    env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true', LIGHTPANDA_DISABLE_CORE_DUMP: '1' },
  });
  for (const stream of child.stdio) stream?.on?.('error', () => { /* Child may close a pipe during shutdown. */ });
  child.stdio[3].end(JSON.stringify(cookies));
  return child;
}

// Codex MCP entrypoint. It exposes the *same native Lightpanda tool schema*
// rather than building a second browser API or depending on WebHarness internals.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const child = await spawnLightpanda({ stdio: ['inherit', 'inherit', 'inherit'] });
    child.on('exit', code => { process.exitCode = code || 0; });
  } catch (error) {
    process.stderr.write(`Lightpanda authentication unavailable: ${String(error.message).slice(0, 180)}\n`);
    process.exitCode = 1;
  }
}
