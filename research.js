import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { fetchXPostContext } from './tech_news.js';
import {
  getEditorialRecommendation,
  saveResearchEvidence,
} from './store.js';

export const RESEARCH_FETCH_TIMEOUT_MS = 10_000;
export const RESEARCH_FETCH_MAX_BYTES = 1024 * 1024;
export const RESEARCH_FETCH_MAX_REDIRECTS = 3;
export const RESEARCH_EVIDENCE_STATUSES = Object.freeze(['primary_supported', 'source_claim', 'contradicted', 'unresolved']);

const SUPPORTED_CONTENT_TYPES = new Set([
  'text/html',
  'text/plain',
  'application/json',
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
]);
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'metadata.aws.internal',
  'instance-data',
]);

class ResearchFetchError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

function failure(reason, message, details = {}) {
  return { ok: false, reason, message, ...details };
}

function normalizedHostname(hostname) {
  return String(hostname || '').replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

const BLOCKED_IPV4 = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) BLOCKED_IPV4.addSubnet(address, prefix, 'ipv4');
const BLOCKED_IPV6 = new net.BlockList();
for (const [address, prefix] of [
  ['::', 96],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
]) BLOCKED_IPV6.addSubnet(address, prefix, 'ipv6');

export function isPublicResearchAddress(address) {
  const value = String(address || '');
  const family = net.isIP(value);
  if (family === 4) return !BLOCKED_IPV4.check(value, 'ipv4');
  if (family === 6) {
    const normalized = new net.SocketAddress({ address: value, family: 'ipv6', port: 0 }).address;
    if (normalized.startsWith('::ffff:')) return !BLOCKED_IPV4.check(normalized.slice(7), 'ipv4');
    return !BLOCKED_IPV6.check(normalized, 'ipv6');
  }
  return false;
}

function remainingMs(deadline) {
  return Math.max(0, deadline - Date.now());
}

async function beforeDeadline(promise, deadline) {
  const remaining = remainingMs(deadline);
  if (remaining <= 0) throw new ResearchFetchError('timeout', 'Research fetch exceeded the 10-second total timeout.');
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ResearchFetchError('timeout', 'Research fetch exceeded the 10-second total timeout.')), remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function resolvePublicDestination(url, deadline) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ResearchFetchError('unsupported_scheme', 'Research URLs must use http: or https:.');
  }
  if (url.username || url.password) {
    throw new ResearchFetchError('embedded_credentials', 'Research URLs cannot contain embedded credentials.');
  }

  const hostname = normalizedHostname(url.hostname);
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new ResearchFetchError('blocked_hostname', `Research destination hostname is not allowed: ${hostname || 'missing'}.`);
  }

  const literalFamily = net.isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await beforeDeadline(dns.lookup(hostname, { all: true, verbatim: true }), deadline);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new ResearchFetchError('dns_no_address', `Research destination did not resolve: ${hostname}.`);
  }
  const normalized = addresses.map((entry) => ({ address: String(entry.address), family: Number(entry.family) }));
  const blocked = normalized.find((entry) => !isPublicResearchAddress(entry.address));
  if (blocked) {
    throw new ResearchFetchError('blocked_address', `Research destination resolved to a non-public address: ${blocked.address}.`);
  }
  return normalized;
}

function mimeType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function requestOnce(url, approvedAddresses, deadline) {
  return new Promise((resolve) => {
    const transport = url.protocol === 'https:' ? https : http;
    let settled = false;
    let totalTimer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (totalTimer) clearTimeout(totalTimer);
      resolve(result);
    };
    const remaining = remainingMs(deadline);
    if (remaining <= 0) {
      finish(failure('timeout', 'Research fetch exceeded the 10-second total timeout.'));
      return;
    }

    const request = transport.request(url, {
      method: 'GET',
      headers: {
        accept: 'text/html,text/plain,application/json,application/xhtml+xml,application/xml,text/xml',
        'accept-encoding': 'identity',
        'user-agent': 'XActions-Research/1.0',
      },
      lookup(_hostname, options, callback) {
        const requestedFamily = Number(options?.family || 0);
        const eligible = requestedFamily
          ? approvedAddresses.filter((entry) => entry.family === requestedFamily)
          : approvedAddresses;
        if (eligible.length === 0) {
          const error = new Error(`No validated public address is available for address family ${requestedFamily}.`);
          error.code = 'ENOTFOUND';
          callback(error);
          return;
        }
        if (options?.all === true) {
          callback(null, eligible);
          return;
        }
        callback(null, eligible[0].address, eligible[0].family);
      },
    }, (response) => {
      const statusCode = Number(response.statusCode || 0);
      if (statusCode >= 300 && statusCode < 400) {
        const location = response.headers.location;
        response.resume();
        finish(location
          ? { ok: true, redirect: true, statusCode, location: String(location) }
          : failure('redirect_missing_location', `HTTP ${statusCode} did not include a Location header.`, { statusCode }));
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        finish(failure('http_status', `Research page returned HTTP ${statusCode}.`, { statusCode }));
        return;
      }

      const contentType = mimeType(response.headers['content-type']);
      if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
        response.resume();
        finish(failure('unsupported_content_type', `Unsupported research content type: ${contentType || 'missing'}.`, { statusCode, contentType }));
        return;
      }
      const contentEncoding = String(response.headers['content-encoding'] || '').trim().toLowerCase();
      if (contentEncoding && contentEncoding !== 'identity') {
        response.resume();
        finish(failure('unsupported_content_encoding', `Unsupported research content encoding: ${contentEncoding}.`, { statusCode, contentType }));
        return;
      }

      const declaredLength = Number(response.headers['content-length'] || 0);
      if (Number.isFinite(declaredLength) && declaredLength > RESEARCH_FETCH_MAX_BYTES) {
        response.resume();
        finish(failure('body_too_large', 'Research page exceeds the 1 MiB body limit.', { statusCode, contentType }));
        return;
      }

      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > RESEARCH_FETCH_MAX_BYTES) {
          response.destroy();
          finish(failure('body_too_large', 'Research page exceeds the 1 MiB body limit.', { statusCode, contentType }));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (settled) return;
        finish({
          ok: true,
          redirect: false,
          statusCode,
          contentType,
          bytes,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      response.on('error', (error) => {
        finish(failure('response_error', error.message, { statusCode, contentType }));
      });
    });

    totalTimer = setTimeout(() => {
      request.destroy(new ResearchFetchError('timeout', 'Research fetch exceeded the 10-second total timeout.'));
    }, remaining);
    request.on('error', (error) => {
      const reason = error instanceof ResearchFetchError ? error.reason : 'request_error';
      finish(failure(reason, error.message));
    });
    request.end();
  });
}

function decodedCodePoint(value, fallback) {
  const codePoint = Number(value);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (entity, code) => decodedCodePoint(Number(code), entity))
    .replace(/&#x([0-9a-f]+);/gi, (entity, code) => decodedCodePoint(Number.parseInt(code, 16), entity));
}

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function htmlPage(body) {
  const titleMatch = String(body || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = compactWhitespace(decodeEntities(titleMatch?.[1] || '').replace(/<[^>]*>/g, ' '));
  const text = compactWhitespace(decodeEntities(String(body || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|section|article|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')));
  return { title, text };
}

function readablePage(contentType, body) {
  if (contentType === 'text/html' || contentType === 'application/xhtml+xml') return htmlPage(body);
  if (contentType === 'application/xml' || contentType === 'text/xml') {
    return { title: '', text: compactWhitespace(decodeEntities(String(body || '').replace(/<[^>]*>/g, ' '))) };
  }
  return { title: '', text: String(body || '').trim() };
}

export function researchSourceFamily(url) {
  try {
    return normalizedHostname(new URL(String(url)).hostname);
  } catch {
    return '';
  }
}

export function normalizeResearchEvidence(input = {}) {
  const status = String(input.status ?? input.evidenceStatus ?? input.evidence_status ?? 'unresolved').toLowerCase();
  if (!RESEARCH_EVIDENCE_STATUSES.includes(status)) throw new Error(`Unsupported research evidence status: ${status}.`);
  const requestedUrl = String(input.requestedUrl ?? input.requested_url ?? '').trim();
  const resolvedUrl = String(input.resolvedUrl ?? input.resolved_url ?? requestedUrl).trim();
  return {
    id: input.id == null ? null : String(input.id),
    claim: String(input.claim || '').trim(),
    claimType: String(input.claimType ?? input.claim_type ?? '').trim(),
    status,
    sourceFamily: String(input.sourceFamily ?? input.source_family ?? researchSourceFamily(resolvedUrl) ?? '').trim(),
    requestedUrl,
    resolvedUrl,
    title: String(input.title || '').trim(),
    text: String(input.text || '').trim(),
  };
}

export async function safeFetchResearchPage(inputUrl) {
  const requestedUrl = String(inputUrl || '').trim();
  const deadline = Date.now() + RESEARCH_FETCH_TIMEOUT_MS;
  let current;
  try {
    current = new URL(requestedUrl);
  } catch {
    return failure('invalid_url', 'Research URL is invalid.', { requestedUrl, resolvedUrl: null, redirects: [] });
  }

  const redirects = [];
  for (;;) {
    let approvedAddresses;
    try {
      approvedAddresses = await resolvePublicDestination(current, deadline);
    } catch (error) {
      const reason = error instanceof ResearchFetchError ? error.reason : 'destination_error';
      return failure(reason, error.message, {
        requestedUrl,
        resolvedUrl: current.toString(),
        redirects,
      });
    }

    const result = await requestOnce(current, approvedAddresses, deadline);
    if (!result.ok) {
      return { ...result, requestedUrl, resolvedUrl: current.toString(), redirects };
    }
    if (result.redirect) {
      if (redirects.length >= RESEARCH_FETCH_MAX_REDIRECTS) {
        return failure('too_many_redirects', `Research page exceeded ${RESEARCH_FETCH_MAX_REDIRECTS} redirects.`, {
          requestedUrl,
          resolvedUrl: current.toString(),
          redirects,
        });
      }
      let next;
      try {
        next = new URL(result.location, current);
      } catch {
        return failure('invalid_redirect', 'Research page returned an invalid redirect destination.', {
          requestedUrl,
          resolvedUrl: current.toString(),
          redirects,
        });
      }
      redirects.push({ from: current.toString(), to: next.toString(), statusCode: result.statusCode });
      current = next;
      continue;
    }

    const page = readablePage(result.contentType, result.body);
    return {
      ok: true,
      requestedUrl,
      resolvedUrl: current.toString(),
      statusCode: result.statusCode,
      contentType: result.contentType,
      bytes: result.bytes,
      title: page.title,
      text: page.text,
      redirects,
    };
  }
}

const RESEARCH_SUMMARY_MAX_CHARS = 6000;

function boundedSummary(value, limit = RESEARCH_SUMMARY_MAX_CHARS) {
  const text = compactWhitespace(value);
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function githubRepository(inputUrl) {
  try {
    const url = new URL(String(inputUrl || ''));
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;
    const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
    const repo = String(rawRepo || '').replace(/\.git$/i, '');
    if (!/^[A-Za-z0-9_.-]+$/.test(owner || '') || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    return { owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
  } catch {
    return null;
  }
}

function hackerNewsItemId(candidate) {
  const values = [candidate?.metrics?.hnUrl, candidate?.url];
  for (const value of values) {
    try {
      const url = new URL(String(value || ''));
      if (url.hostname === 'news.ycombinator.com') {
        const id = url.searchParams.get('id');
        if (/^\d+$/.test(id || '')) return id;
      }
    } catch {
      // Keep trying supplied candidate URLs.
    }
  }
  return null;
}

function xStatusId(inputUrl) {
  try {
    return new URL(String(inputUrl || '')).pathname.match(/\/status\/(\d+)/)?.[1] || null;
  } catch {
    return null;
  }
}

function extractExplicitUrls(text) {
  return [...new Set((String(text || '').match(/https?:\/\/[^\s<>()\[\]{}"']+/g) || []).map((value) => value.replace(/[.,;:!?]+$/, '')))];
}

function candidateFamily(candidate) {
  const github = githubRepository(candidate?.url);
  if (github) return `github:${github.fullName.toLowerCase()}`;
  const key = String(candidate?.key || candidate?.candidateKey || candidate?.url || '').trim();
  return key ? `candidate:${key}` : researchSourceFamily(candidate?.url) || 'candidate:unknown';
}

async function fixedFetch(url, { accept = 'application/json', text = false } = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'xactions-editorial-research/1.0',
        Accept: accept,
        ...(process.env.GITHUB_TOKEN && new URL(url).hostname === 'api.github.com' ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(RESEARCH_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, statusCode: response.status, error: `HTTP ${response.status}` };
    return { ok: true, statusCode: response.status, body: text ? await response.text() : await response.json() };
  } catch (error) {
    return { ok: false, statusCode: null, error: error.message };
  }
}

function persistEvidence(editorialRunId, storyKey, candidate, input) {
  return saveResearchEvidence({
    editorialRunId,
    storyKey,
    candidateKey: candidate?.key || candidate?.candidateKey || null,
    observedAt: Date.now(),
    ...input,
  });
}

function failedEvidence(editorialRunId, storyKey, candidate, { sourceKind, sourceFamily, requestedUrl, result, claim = '' }) {
  return persistEvidence(editorialRunId, storyKey, candidate, {
    claim: claim || `Controlled research could not retrieve ${requestedUrl}.`,
    claimType: 'other',
    status: 'unresolved',
    sourceKind,
    sourceFamily,
    requestedUrl,
    resolvedUrl: result?.resolvedUrl || requestedUrl,
    title: '',
    summary: result?.message || result?.error || 'Research source unavailable.',
    metadata: { fetchFailure: result?.reason || result?.error || 'unavailable', statusCode: result?.statusCode ?? null },
  });
}

async function enrichGitHub(editorialRunId, storyKey, candidate) {
  const repo = githubRepository(candidate?.url);
  if (!repo) return [];
  const family = `github:${repo.fullName.toLowerCase()}`;
  const rows = [];
  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  const metadata = await fixedFetch(apiBase);
  if (!metadata.ok) {
    rows.push(failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'github_api', sourceFamily: family, requestedUrl: apiBase, result: metadata }));
    return rows;
  }
  const data = metadata.body || {};
  rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
    claim: `GitHub repository metadata for ${repo.fullName}.`,
    claimType: 'implementation',
    status: 'primary_supported',
    sourceKind: 'github_api',
    sourceFamily: family,
    requestedUrl: apiBase,
    resolvedUrl: apiBase,
    title: String(data.full_name || repo.fullName),
    summary: boundedSummary(JSON.stringify({
      description: data.description || '', language: data.language || '', stargazers: data.stargazers_count ?? null,
      forks: data.forks_count ?? null, openIssues: data.open_issues_count ?? null, defaultBranch: data.default_branch || '',
      homepage: data.homepage || '', archived: data.archived === true, pushedAt: data.pushed_at || null,
    })),
    metadata: { artifact: 'repository_metadata' },
  }));

  const readmeUrl = `${apiBase}/readme`;
  const readme = await fixedFetch(readmeUrl, { accept: 'application/vnd.github.raw+json', text: true });
  if (readme.ok) {
    rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
      claim: `The ${repo.fullName} repository README states the supplied implementation and usage details.`,
      claimType: 'implementation', status: 'primary_supported', sourceKind: 'github_readme', sourceFamily: family,
      requestedUrl: readmeUrl, resolvedUrl: readmeUrl, title: `${repo.fullName} README`, summary: boundedSummary(readme.body),
      metadata: { artifact: 'readme' },
    }));
  }

  const releaseUrl = `${apiBase}/releases/latest`;
  const release = await fixedFetch(releaseUrl);
  if (release.ok) {
    const item = release.body || {};
    rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
      claim: `Latest GitHub release metadata for ${repo.fullName}.`,
      claimType: 'implementation', status: 'primary_supported', sourceKind: 'github_release', sourceFamily: family,
      requestedUrl: releaseUrl, resolvedUrl: String(item.html_url || releaseUrl), title: String(item.name || item.tag_name || `${repo.fullName} release`),
      summary: boundedSummary(`${item.tag_name || ''} ${item.published_at || ''} ${item.body || ''}`), metadata: { artifact: 'latest_release', tag: item.tag_name || '' },
    }));
  }

  const homepage = String(data.homepage || '').trim();
  if (homepage) {
    const page = await safeFetchResearchPage(homepage);
    if (page.ok) {
      rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
        claim: `Repository homepage content linked by ${repo.fullName}.`, claimType: 'other', status: 'source_claim',
        sourceKind: 'generic_page', sourceFamily: family, requestedUrl: page.requestedUrl, resolvedUrl: page.resolvedUrl,
        title: page.title, summary: boundedSummary(page.text), metadata: { artifact: 'repository_homepage', contentType: page.contentType },
      }));
    } else {
      rows.push(failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'generic_page', sourceFamily: family, requestedUrl: homepage, result: page }));
    }
  }
  return rows;
}

async function enrichHackerNews(editorialRunId, storyKey, candidate) {
  const family = candidateFamily(candidate);
  const rows = [];
  const id = hackerNewsItemId(candidate);
  if (id) {
    const itemUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
    const result = await fixedFetch(itemUrl);
    if (result.ok) {
      const item = result.body || {};
      rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
        claim: `Hacker News item ${id} metadata and source claim.`, claimType: 'announcement', status: 'source_claim',
        sourceKind: 'hn_item', sourceFamily: family, requestedUrl: itemUrl, resolvedUrl: `https://news.ycombinator.com/item?id=${id}`,
        title: String(item.title || candidate.title || ''), summary: boundedSummary(JSON.stringify({ by: item.by, score: item.score, descendants: item.descendants, url: item.url, text: item.text })),
        metadata: { hnItemId: id },
      }));
    } else {
      rows.push(failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'hn_item', sourceFamily: family, requestedUrl: itemUrl, result }));
    }
  }
  const linkedUrl = String(candidate?.url || '');
  if (linkedUrl && !linkedUrl.includes('news.ycombinator.com/item')) {
    const page = await safeFetchResearchPage(linkedUrl);
    if (page.ok) {
      rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
        claim: `Linked page for Hacker News story ${candidate.title || ''}.`, claimType: 'other', status: 'source_claim',
        sourceKind: 'generic_page', sourceFamily: family, requestedUrl: page.requestedUrl, resolvedUrl: page.resolvedUrl,
        title: page.title || String(candidate.title || ''), summary: boundedSummary(page.text), metadata: { contentType: page.contentType },
      }));
    } else {
      rows.push(failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'generic_page', sourceFamily: family, requestedUrl: linkedUrl, result: page }));
    }
  }
  return rows;
}

async function enrichX(editorialRunId, storyKey, candidate) {
  const family = candidateFamily(candidate);
  const rows = [persistEvidence(editorialRunId, storyKey, candidate, {
    claim: `X source post ${xStatusId(candidate?.url) || candidate?.key || ''} states the supplied source text.`,
    claimType: 'announcement', status: 'source_claim', sourceKind: 'x_post', sourceFamily: family,
    requestedUrl: String(candidate?.url || ''), resolvedUrl: String(candidate?.url || ''), title: String(candidate?.title || ''),
    summary: boundedSummary(candidate?.text || ''), metadata: { sourceMetrics: candidate?.metrics || {} },
  })];
  const context = await fetchXPostContext(candidate?.url);
  if (context?.context?.length > 1) {
    rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
      claim: `Observable X thread/quote context around source post ${xStatusId(candidate?.url) || ''}.`,
      claimType: 'announcement', status: 'source_claim', sourceKind: 'x_context', sourceFamily: family,
      requestedUrl: String(candidate?.url || ''), resolvedUrl: String(context.post?.url || candidate?.url || ''),
      title: String(candidate?.title || ''), summary: boundedSummary(context.context.map((item) => `${item.username}: ${item.text}`).join('\n')),
      metadata: { contextPostIds: context.context.map((item) => item.id) },
    }));
  }
  for (const linkedUrl of extractExplicitUrls(candidate?.text)) {
    if (linkedUrl === candidate?.url) continue;
    const github = githubRepository(linkedUrl);
    if (github) {
      rows.push(...await enrichGitHub(editorialRunId, storyKey, { ...candidate, url: github.url }));
      continue;
    }
    const page = await safeFetchResearchPage(linkedUrl);
    if (page.ok) {
      rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
        claim: `Page explicitly linked from the X source post.`, claimType: 'other', status: 'source_claim',
        sourceKind: 'generic_page', sourceFamily: family, requestedUrl: page.requestedUrl, resolvedUrl: page.resolvedUrl,
        title: page.title, summary: boundedSummary(page.text), metadata: { contentType: page.contentType },
      }));
    } else {
      rows.push(failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'generic_page', sourceFamily: family, requestedUrl: linkedUrl, result: page }));
    }
  }
  return rows;
}

export async function collectStoryResearch({ editorialRunId, story } = {}) {
  const storyKey = String(story?.storyKey || '').trim();
  if (!storyKey) throw new Error('collectStoryResearch requires story.storyKey.');
  const rows = [];
  for (const candidate of Array.isArray(story?.candidates) ? story.candidates : []) {
    try {
      if (candidate.source === 'github') rows.push(...await enrichGitHub(editorialRunId, storyKey, candidate));
      else if (candidate.source === 'hn') rows.push(...await enrichHackerNews(editorialRunId, storyKey, candidate));
      else if (candidate.source === 'x') rows.push(...await enrichX(editorialRunId, storyKey, candidate));
      else if (candidate.url) {
        const page = await safeFetchResearchPage(candidate.url);
        const family = candidateFamily(candidate);
        rows.push(page.ok
          ? persistEvidence(editorialRunId, storyKey, candidate, {
              claim: `Controlled source page for ${candidate.title || candidate.key || ''}.`, claimType: 'other', status: 'source_claim',
              sourceKind: 'generic_page', sourceFamily: family, requestedUrl: page.requestedUrl, resolvedUrl: page.resolvedUrl,
              title: page.title, summary: boundedSummary(page.text), metadata: { contentType: page.contentType },
            })
          : failedEvidence(editorialRunId, storyKey, candidate, { sourceKind: 'generic_page', sourceFamily: family, requestedUrl: candidate.url, result: page }));
      }
    } catch (error) {
      rows.push(persistEvidence(editorialRunId, storyKey, candidate, {
        claim: `Controlled research failed for ${candidate?.title || candidate?.key || 'candidate'}.`, claimType: 'other', status: 'unresolved',
        sourceKind: String(candidate?.source || 'unknown'), sourceFamily: candidateFamily(candidate), requestedUrl: String(candidate?.url || ''),
        resolvedUrl: String(candidate?.url || ''), title: String(candidate?.title || ''), summary: error.message,
        metadata: { fetchFailure: 'research_exception' },
      }));
    }
  }
  return rows;
}

export async function attachEditorialResearchSource(recommendationId, { url, claim, claimType = 'other' } = {}) {
  const recommendation = getEditorialRecommendation(recommendationId);
  if (!recommendation) throw new Error(`Editorial recommendation not found: ${recommendationId}`);
  if (recommendation.decision !== 'RESEARCH_MORE') throw new Error('Manual editorial research sources may be attached only to RESEARCH_MORE recommendations.');
  const requestedUrl = String(url || '').trim();
  const requestedClaim = String(claim || '').trim();
  if (!requestedUrl || !requestedClaim) throw new Error('Manual editorial research requires url and claim.');
  const page = await safeFetchResearchPage(requestedUrl);
  const sourceFamily = researchSourceFamily(page.resolvedUrl || requestedUrl) || 'manual:unknown';
  if (!page.ok) {
    return saveResearchEvidence({
      editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey, claim: requestedClaim, claimType,
      status: 'unresolved', sourceKind: 'manual_url', sourceFamily, requestedUrl, resolvedUrl: page.resolvedUrl || requestedUrl,
      title: '', summary: page.message || 'Manual research source unavailable.', observedAt: Date.now(),
      metadata: { fetchFailure: page.reason || 'unavailable', statusCode: page.statusCode ?? null },
    });
  }
  return saveResearchEvidence({
    editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey, claim: requestedClaim, claimType,
    status: 'source_claim', sourceKind: 'manual_url', sourceFamily, requestedUrl: page.requestedUrl, resolvedUrl: page.resolvedUrl,
    title: page.title, summary: boundedSummary(page.text), observedAt: Date.now(), metadata: { contentType: page.contentType },
  });
}
