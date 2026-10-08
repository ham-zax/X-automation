// Publishing-browser transport: implementation details only. No claim, approval,
// duplicate, send-start, or reconciliation authority lives here.
// `driveBrowserSend(input, deps)` can inject a replacement with the same
// observe/execute/listPages/listNetwork/getNetwork contract.
import { spawnSync } from 'node:child_process';

function runWhBrowser(args, { timeoutMs = 30000 } = {}) {
  const result = spawnSync('wh-browser', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw new Error(`wh-browser failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`wh-browser exit ${result.status}: ${String(result.stderr || result.stdout || '').slice(0, 500)}`);
  try {
    return JSON.parse(String(result.stdout || ''));
  } catch {
    return { raw: String(result.stdout || '') };
  }
}

function fastObserve(tab = null, scope = 'compact') {
  const payload = tab ? { scope, tab } : { scope };
  return runWhBrowser(['fast', 'observe', JSON.stringify(payload)]);
}

function fastExecute(tab, actions, finalState = 'compact') {
  return runWhBrowser(['fast', 'execute', JSON.stringify({ tab, actions, final_state: finalState })], { timeoutMs: 60000 });
}

function devtoolsListPages() {
  return runWhBrowser(['devtools', 'list_pages', '{}']);
}

function devtoolsListNetwork(pageId, pageSize = 1000) {
  return runWhBrowser(['devtools', 'list_network_requests', JSON.stringify({ pageId, pageSize, resourceTypes: ['xhr', 'fetch'], includePreservedRequests: true })], { timeoutMs: 30000 });
}

function devtoolsGetNetwork(pageId, reqid) {
  return runWhBrowser(['devtools', 'get_network_request', JSON.stringify({ pageId, reqid })], { timeoutMs: 30000 });
}

export const whBrowserTransport = Object.freeze({
  observe: fastObserve,
  execute: fastExecute,
  listPages: devtoolsListPages,
  listNetwork: devtoolsListNetwork,
  getNetwork: devtoolsGetNetwork,
});
