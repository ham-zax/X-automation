// Browser-specific instructions live behind one small seam; Growth OS owns all sends.
// Switching a browser must not change the action/claim/reconciliation protocol.
export const BROWSER_INTERFACES = Object.freeze(['webharness-mcp', 'agent-browser-cli']);

function cliInstructions({ agentBrowserCli, cdpPort, sessionId }) {
  const cli = `${agentBrowserCli} --cdp ${cdpPort} --session ${sessionId}`;
  return `Fallback browser CLI: read its installed contract first with \`${agentBrowserCli} skills get core\` (or \`skills get core --full\`). Use only \`${cli} <command>\` against the EXISTING authenticated Chromium on port ${cdpPort}; never create another profile or browser.
Correct CLI syntax: \`tab list --json\` to discover stable IDs, then \`tab t2\` only if t2 is the observed X tab (not \`tabs\` or \`tab 2\`); \`snapshot -i\` or \`snapshot\` for fresh refs; \`get attr @e1 href\` for an attribute (element first); \`get url\` for current URL. Do not guess command names or reuse stale refs.
If a click is blocked by \`div#layers\` or another covering element, it was NOT dispatched. Observe the covering UI: use its current visible Close/Cancel control only when safe, or \`press Escape\` only if it cannot discard draft content. Re-snapshot before attempting any DIFFERENT pre-send action. Never force-click, script around overlays, or blindly repeat an action with uncertain effects.`;
}

export function browserOperatorContract({ browserTarget, browserInterface, agentBrowserCli, cdpPort, sessionId, browserMcpServer = 'xgrowth_browser', browserFastBackend = 'clearcote' }) {
  if (browserTarget !== 'linux') return ''; // Windows uses the existing browser-fast + native-dialog policy.
  const fallback = cliInstructions({ agentBrowserCli, cdpPort, sessionId });
  if (browserInterface === 'agent-browser-cli') {
    return `Browser interface: agent-browser-cli (selected explicitly). ${fallback}
Publishing boundary: ONLY the Growth OS bridge \`act\` may send; browser commands here are for observation and pre-send preparation. If any send might have been dispatched, stop UI mutations and reconcile through the existing attempt; never re-send.`;
  }
  if (browserInterface !== 'webharness-mcp') throw new Error(`Unsupported browser interface: ${browserInterface}`);
  return `Browser interface: webharness-mcp (preferred). Use the Codex MCP tools from server \`${browserMcpServer}\`: \`observe\` and \`execute\`. They are typed tools, not shell commands. If they are available, do NOT call agent-browser or wh-browser in the shell for browser work.
To inspect: \`observe\` with browser_target="linux", browser_backend="${browserFastBackend}", scope="interactive" (or "full" for post URLs). Carry returned \`active_tab\` into \`execute\` as tab, with the same target/backend/profile (do not switch backends); execute actions like [{"op":"navigate","url":"https://x.com/home"}] or [{"op":"click","target":"<ref from current observe>"}]. Execute stops on error and never retries. Read completed/failed/unknown/not_run and final_state. Use fresh observe after navigation, stale refs, or a tab mismatch; do not guess a tab or element.
If an X dialog/overlay covers a click, inspect via \`observe\` scope="full"; act only on a newly observed Close/Cancel control when safe, or press Escape when no unsent text can be lost. Re-observe and resolve new refs. Do not force-click, remove overlays through JS, guess selectors, or replay the blocked action without establishing the new state.
Only if the MCP tools are unavailable BEFORE any consequential send, you may select the CLI fallback for the rest of this pass (report the switch): ${fallback}
Publishing boundary: ONLY the Growth OS bridge \`act\` may send; never use direct browser MCP/CLI Post/Reply/Quote clicks as a replacement. An attempted or unknown public send cannot be retried through another browser interface; reconcile the existing attempt or report a blocker. Browser selection never changes claim, health, or duplicate gates.`;
}
