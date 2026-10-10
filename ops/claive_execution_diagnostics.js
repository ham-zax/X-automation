// Additive, sanitized observations of *completed* Claive command events.
// These are not publication or safety attestations: only the Growth OS
// attempt ledger can establish whether a public action dispatched.
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const MAX_TRACE_BYTES = 16 * 1024 * 1024;
const MAX_EXAMPLES = 24;
const TRACE_ID = /^[a-f0-9]{12}$/i;
const READ_BRIDGE_COMMANDS = new Set(['relationship-context', 'relationship-inspect', 'scout', 'inspect',
  'growth-run-next', 'growth-run-status', 'operator-status', 'growth-policy', 'growth-analysis',
  'persona-model', 'act-target-status', 'publication-attempts', 'queue', 'writer-packet']);

function operationOf(command = '') {
  const value = String(command);
  const bridge = value.match(/\bagent(?:\.js)?\s+--\s+([a-z][a-z0-9-]*)/i)
    || value.match(/\bnode\s+agent_bridge\.js\s+([a-z][a-z0-9-]*)/i);
  if (bridge) return { name: bridge[1].toLowerCase(), transport: 'bridge-cli' };
  if (/\bagent-browser\b/.test(value)) return { name: 'browser-command', transport: 'agent-browser-cli' };
  if (/\bwh-browser\b/.test(value)) return { name: 'browser-command', transport: 'wh-browser-cli' };
  return { name: 'unknown', transport: 'shell' };
}

function causeOf(command = '', output = '') {
  const value = String(output).slice(-5000);
  if (/SQLITE_BUSY|database is locked/i.test(value)) return 'database_contention';
  if (/Unknown ref|No element found for ref|stale (?:element|reference)|invalid element reference/i.test(value)) return 'stale_reference';
  if (/profile not found/i.test(value) && /relationship-inspect/.test(command)) return 'relationship_not_tracked';
  if (/unknown command|invalid command/i.test(value) && /--pin-tab\s+[a-f0-9]{32}\b/i.test(command)) return 'browser_grammar';
  if (/missing required|requires (?:a |an )|Invalid JSON|Unexpected token|invalid input|must be (?:a |an )/i.test(value)) return 'contract_error';
  if (/429|rate.limit|provider error|ECONNRESET|ETIMEDOUT/i.test(value)) return 'provider_error';
  return 'unknown';
}

export function traceIdFromOutput(output = '') {
  const value = String(output);
  const matches = [...value.matchAll(/(?:^|\n)(?:Logs:\s*[^\n]*\/claive\/|Worker\s+)([a-f0-9]{12})(?=\s|\/|\n|$)/gi)];
  return matches.length ? matches.at(-1)[1].toLowerCase() : null;
}

export function parseClaiveEvents(text, { traceId = 'unknown', reportedFailures = null, observedAt = Date.now() } = {}) {
  const counts = { commandExecutions: 0, successfulCommands: 0, nonzeroCommands: 0,
    unfinishedCommands: 0, unclassifiedFailures: 0, failureCauses: {} };
  const events = [];
  const seen = new Set();
  let turn = 0;
  let malformedLines = 0;
  let lastEventType = null;
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch { malformedLines++; continue; }
    lastEventType = record?.type || lastEventType;
    if (record?.type === 'turn.started') turn++;
    if (!['item.completed', 'item.started'].includes(record?.type) || record?.item?.type !== 'command_execution') continue;
    const item = record.item;
    const identity = `${turn}:${String(item.id || '')}`;
    if (record.type === 'item.started') {
      seen.add(identity);
      continue;
    }
    // Completed command records, not started+completed pairs, are the denominator.
    const finishedId = `completed:${identity}`;
    if (seen.has(finishedId)) continue;
    seen.add(finishedId);
    const exitCode = item.exit_code;
    const outcome = Number.isInteger(exitCode) && exitCode === 0 ? 'completed'
      : Number.isInteger(exitCode) ? 'failed' : 'unknown';
    const operation = operationOf(item.command);
    const failureCause = outcome === 'failed' ? causeOf(item.command, item.aggregated_output) : 'none';
    counts.commandExecutions++;
    if (outcome === 'completed') counts.successfulCommands++;
    if (outcome === 'failed') {
      counts.nonzeroCommands++;
      counts.failureCauses[failureCause] = (counts.failureCauses[failureCause] || 0) + 1;
      if (failureCause === 'unknown') counts.unclassifiedFailures++;
    }
    if (outcome === 'unknown') counts.unfinishedCommands++;
    if (outcome !== 'completed' && events.length < MAX_EXAMPLES) events.push({
      schemaVersion: 1, operationId: `${traceId}:${identity}`, operation: operation.name,
      transport: operation.transport, outcome, failureCause,
      safetyState: 'unknown',
      dispatchState: READ_BRIDGE_COMMANDS.has(operation.name) ? 'not_applicable' : 'unknown',
      recoveryState: 'unknown', toolVersion: 'claive-codex-jsonl-v1', source: 'claive_event',
    });
  }
  return { schemaVersion: 1, source: 'claive_events_jsonl', traceId, observedAt,
    rawClaiveReportedFailures: reportedFailures, ...counts,
    events, eventSampleLimit: MAX_EXAMPLES, malformedLines,
    traceComplete: lastEventType === 'turn.completed',
    attribution: 'session_trace_only; no inferred Growth Run or publication dispatch',
  };
}

export function readClaiveExecutionDiagnostics(outputTail, { stateHome = path.join(homedir(), '.local/state'),
  observedAt = Date.now() } = {}) {
  const reported = [...String(outputTail || '').matchAll(/Task failures reported:\s*(\d+)/g)];
  const rawClaiveReportedFailures = reported.length ? Number(reported.at(-1)[1]) : null;
  const traceId = traceIdFromOutput(outputTail);
  const fallback = (reason) => ({ schemaVersion: 1, source: 'claive_events_jsonl',
    sourceStatus: reason, traceId, observedAt, rawClaiveReportedFailures,
    commandExecutions: null, successfulCommands: null, nonzeroCommands: null,
    unfinishedCommands: null, unclassifiedFailures: null,
    failureCauses: {}, events: [], attribution: 'unavailable; do not infer zero failures or safe dispatch' });
  if (!traceId || !TRACE_ID.test(traceId)) return fallback('trace_identity_missing');
  try {
    const base = path.join(stateHome, 'claive', traceId);
    const dir = lstatSync(base);
    const file = lstatSync(path.join(base, 'events.jsonl'));
    if (!dir.isDirectory() || !file.isFile() || dir.isSymbolicLink() || file.isSymbolicLink()) return fallback('invalid_trace_file');
    if (file.size > MAX_TRACE_BYTES || file.size === 0) return fallback('trace_size_out_of_bounds');
    const parsed = parseClaiveEvents(readFileSync(path.join(base, 'events.jsonl'), 'utf8'), {
      traceId, reportedFailures: rawClaiveReportedFailures, observedAt,
    });
    return { ...parsed, sourceStatus: parsed.traceComplete ? 'complete' : 'partial' };
  } catch { return fallback('trace_unavailable'); }
}

export function combineClaiveDiagnostics(sessions) {
  const items = sessions.filter(Boolean);
  const observed = items.filter(item => typeof item.commandExecutions === 'number');
  const sum = field => observed.reduce((total, item) => total + item[field], 0);
  const failureCauses = {};
  for (const item of observed) for (const [cause, count] of Object.entries(item.failureCauses)) {
    failureCauses[cause] = (failureCauses[cause] || 0) + count;
  }
  return { schemaVersion: 1, source: 'claive_events_jsonl',
    traceCount: items.length, readableTraces: observed.length,
    commandExecutions: observed.length ? sum('commandExecutions') : null,
    successfulCommands: observed.length ? sum('successfulCommands') : null,
    nonzeroCommands: observed.length ? sum('nonzeroCommands') : null,
    unfinishedCommands: observed.length ? sum('unfinishedCommands') : null,
    unclassifiedFailures: observed.length ? sum('unclassifiedFailures') : null,
    failureCauses, rawClaiveReportedFailures: items.some(item => item.rawClaiveReportedFailures !== null)
      ? items.reduce((n, item) => n + (item.rawClaiveReportedFailures || 0), 0) : null,
    sessions: items.map(({ traceId, sourceStatus, observedAt, sessionId, rawClaiveReportedFailures,
      commandExecutions, nonzeroCommands, traceComplete, attribution, events }) => ({
      traceId, sourceStatus, observedAt, sessionId, rawClaiveReportedFailures,
      commandExecutions, nonzeroCommands, traceComplete, attribution, events,
    })),
    limitations: 'Counts are from completed shell commands, not all MCP calls, and do not prove meaningful work, safety, run attribution or mutation dispatch.',
  };
}
