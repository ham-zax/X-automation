// Each unattended Agent Browser --cdp session creates an independent page in the
// shared Chrome process. "agent-browser close" disconnects that session but
// does not close its page. This lease owns ONLY the page it creates; it never
// closes pre-existing tabs, the authenticated Chrome process, or other sessions.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TARGET_ID = /^[a-fA-F0-9]{32}$/;
const PORT = /^\d{2,5}$/;
const READ_TIMEOUT_MS = 3000;
const COMMAND_TIMEOUT_MS = 12000;

async function chromeJson(port, endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}/json/${endpoint}`, {
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Shared Chrome CDP ${endpoint} returned HTTP ${response.status}`);
  return response.json();
}

async function snapshot(port) {
  const [version, targets] = await Promise.all([chromeJson(port, 'version'), chromeJson(port, 'list')]);
  const ws = String(version.webSocketDebuggerUrl || '');
  const endpoint = new URL(ws);
  if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1'
      || endpoint.port !== String(port) || !endpoint.pathname.startsWith('/devtools/browser/')) {
    throw new Error('Shared Chrome returned an unexpected browser websocket endpoint');
  }
  if (!Array.isArray(targets)) throw new Error('Shared Chrome returned no target list');
  return {
    browserWs: ws,
    pages: new Map(targets.filter(t => t.type === 'page' && TARGET_ID.test(String(t.id || '')))
      .map(t => [t.id, { url: String(t.url || '') }])),
  };
}

async function cliCommand(cli, port, sessionId, ...args) {
  return execFileAsync(cli, ['--cdp', String(port), '--session', sessionId, ...args], {
    timeout: COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_NO_XVFB: '1' },
  });
}

async function closeExactTarget(browserWs, targetId) {
  if (!TARGET_ID.test(targetId)) throw new Error('Refusing to close a non-CDP page identifier');
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(browserWs);
    let finished = false;
    const timer = setTimeout(() => done(new Error('CDP exact-tab cleanup timed out')), READ_TIMEOUT_MS);
    function done(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve();
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({
      id: 1, method: 'Target.closeTarget', params: { targetId },
    })));
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(String(event.data || '')); }
      catch { return; }
      if (message.id !== 1) return;
      if (message.error || message.result?.success !== true) {
        done(new Error('Chrome refused exact owned-tab cleanup'));
      } else done();
    });
    socket.addEventListener('error', () => done(new Error('Chrome websocket cleanup failed')));
    socket.addEventListener('close', () => done(new Error('Chrome websocket closed during cleanup')));
  });
}

export async function leaseAgentBrowserTab({
  cli, cdpPort, sessionId, maxPages = 16,
} = {}) {
  const port = String(cdpPort || '');
  if (!PORT.test(port) || Number(port) > 65535) throw new Error('Invalid Chrome CDP port');
  if (!cli || !/^[a-zA-Z0-9_-]{4,120}$/.test(String(sessionId || ''))) {
    throw new Error('Agent Browser tab lease requires its exact CLI and unique run session ID');
  }
  const before = await snapshot(port);
  if (before.pages.size >= maxPages) {
    throw new Error(`Shared Chrome already has ${before.pages.size} pages (limit ${maxPages}); refusing to add another page. Diagnose or reconcile idle tabs before launching Luna.`);
  }
  let newPageId = '';
  try {
    const { stdout } = await cliCommand(cli, port, sessionId, '--pin-tab', 'tab', 'list', '--json');
    const response = JSON.parse(stdout);
    if (response.success !== true || !Array.isArray(response.data?.tabs)) {
      throw new Error('Agent Browser did not return a successful pinned tab listing');
    }
    const after = await snapshot(port);
    if (after.browserWs !== before.browserWs) throw new Error('Shared Chrome restarted during tab allocation');
    const added = [...after.pages].filter(([id]) => !before.pages.has(id));
    if (added.length !== 1 || added[0][1].url !== 'about:blank') {
      throw new Error(`Cannot attribute tab ownership: expected one new blank tab, observed ${added.length} new tabs`);
    }
    newPageId = added[0][0];
    const active = response.data.tabs.find(tab => tab.active === true);
    if (active?.targetId !== newPageId) {
      throw new Error('Agent Browser new session is not pinned to its newly allocated page');
    }
  } catch (error) {
    // A CLI timeout can occur AFTER it created the session's blank page.
    // Recover its ID by a second CDP snapshot, but close nothing unless it
    // is the only new page and its URL is still about:blank.
    let cleanupId = newPageId;
    if (!cleanupId) {
      try {
        const failed = await snapshot(port);
        if (failed.browserWs === before.browserWs) {
          const added = [...failed.pages].filter(([id]) => !before.pages.has(id));
          if (added.length === 1 && added[0][1].url === 'about:blank') cleanupId = added[0][0];
        }
      } catch {}
    }
    if (cleanupId) await closeExactTarget(before.browserWs, cleanupId).catch(() => {});
    throw error;
  }
  let released = false;
  return {
    targetId: newPageId,
    pagesAtStart: before.pages.size,
    async release() {
      if (released) return;
      released = true;
      const warnings = [];
      try { await cliCommand(cli, port, sessionId, 'close'); }
      catch (error) { warnings.push(`Agent Browser disconnect: ${String(error.message).slice(0,160)}`); }
      try {
        const current = await snapshot(port);
        if (current.browserWs !== before.browserWs) {
          warnings.push('Shared Chrome restarted; exact page was not closed in the new browser');
        } else if (current.pages.has(newPageId)) {
          await closeExactTarget(before.browserWs, newPageId);
          const verified = await snapshot(port);
          if (verified.pages.has(newPageId)) warnings.push('Owned tab still present after Chrome acknowledged close');
        }
        const remaining = [...current.pages.keys()].filter(id => !before.pages.has(id) && id !== newPageId);
        if (remaining.length) warnings.push(`${remaining.length} extra tabs remain from this run or concurrent browser clients; no unowned tabs were closed`);
      } catch (error) { warnings.push(`Exact browser-page cleanup failed: ${String(error.message).slice(0,160)}`); }
      return { targetId: newPageId, cleaned: warnings.length === 0, warnings };
    },
  };
}
