// Wall-clock discovery blocks. The block index decides which stream a pass reads,
// so a session boundary cannot reset or duplicate the rotation. Overrunning work
// is finished, then the current block is taken. Missed blocks are never replayed.

export const DISCOVERY_STREAMS = Object.freeze(['momentum', 'forYou']);

export const DEFAULT_DISCOVERY_SCHEDULE = Object.freeze({
  blockSeconds: 300,
  order: DISCOVERY_STREAMS,
  restWatchMinutes: 60,
  builderRefreshMinutes: 60,
});

function integer(value, label, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function normalizeScheduleOrder(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const order = raw.map((entry) => String(entry).trim()).filter(Boolean);
  if (order.length < 2) throw new Error('schedule.order must name at least two streams.');
  for (const stream of order) {
    if (!DISCOVERY_STREAMS.includes(stream)) {
      throw new Error(`schedule.order has unsupported stream ${stream}. Use ${DISCOVERY_STREAMS.join(' or ')}.`);
    }
  }
  if (new Set(order).size !== order.length) throw new Error('schedule.order must not repeat a stream.');
  return order;
}

export function normalizeSchedule(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    blockSeconds: source.blockSeconds == null
      ? DEFAULT_DISCOVERY_SCHEDULE.blockSeconds
      : integer(source.blockSeconds, 'schedule.blockSeconds', 60, 3600),
    order: source.order == null ? DEFAULT_DISCOVERY_SCHEDULE.order : normalizeScheduleOrder(source.order),
    restWatchMinutes: source.restWatchMinutes == null
      ? DEFAULT_DISCOVERY_SCHEDULE.restWatchMinutes
      : integer(source.restWatchMinutes, 'schedule.restWatchMinutes', 15, 1440),
    builderRefreshMinutes: source.builderRefreshMinutes == null
      ? DEFAULT_DISCOVERY_SCHEDULE.builderRefreshMinutes
      : integer(source.builderRefreshMinutes, 'schedule.builderRefreshMinutes', 15, 1440),
  };
}

export function discoveryBlock({ now = Date.now(), schedule = null } = {}) {
  const config = normalizeSchedule(schedule);
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('discoveryBlock requires a non-negative numeric now.');
  const blockMs = config.blockSeconds * 1000;
  const blockIndex = Math.floor(timestamp / blockMs);
  const startedAt = blockIndex * blockMs;
  const stream = config.order[blockIndex % config.order.length];
  const nextStream = config.order[(blockIndex + 1) % config.order.length];
  return {
    blockSeconds: config.blockSeconds,
    blockIndex,
    stream,
    startedAt,
    endsAt: startedAt + blockMs,
    nextStream,
    nextBlockAt: startedAt + blockMs,
    restWatchMinutes: config.restWatchMinutes,
    builderRefreshMinutes: config.builderRefreshMinutes,
  };
}
