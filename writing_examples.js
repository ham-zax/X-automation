import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractViralStyleFeatures } from './viral_style.js';

const corpusRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs/research/x_creator_phase2');
const cache = new Map();
const stopWords = new Set('the and this that with from have will your they what when would should about into more some just than then their there does make real only source builder developers developer'.split(' '));
const tokens = value => new Set((String(value || '').toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).filter(word => !stopWords.has(word)));

function loadRows(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > 32 * 1024 * 1024) return { rows: [], status: 'size_limit' };
    const saved = cache.get(file);
    if (saved?.mtime === stat.mtimeMs && saved.size === stat.size) return saved;
    const rows = [];
    let malformed = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { malformed++; }
    }
    const entry = { rows, mtime: stat.mtimeMs, size: stat.size, status: malformed ? 'partial' : 'available', malformed };
    cache.set(file, entry);
    return entry;
  } catch (error) {
    if (error.code === 'ENOENT') return { rows: [], status: 'missing' };
    return { rows: [], status: 'unreadable' };
  }
}

export function getCurrentPatternFreshness({ dataDirectory = path.resolve(process.env.VIRAL_STYLE_DIR || '.viral-style-research'), now = Date.now(), days = 21 } = {}) {
  const dataset = loadRows(path.join(dataDirectory, 'posts.jsonl'));
  const dates = dataset.rows.map(row => Number(row.createdAt)).filter(value => Number.isFinite(value) && value > 0 && value <= now);
  const latestPostAt = dates.length ? Math.max(...dates) : null;
  const windowPostCount = dates.filter(value => value >= now - days * 86_400_000).length;
  return { state: !dates.length ? dataset.status === 'available' ? 'empty' : dataset.status : windowPostCount ? 'within_window' : 'stale',
    observedAt: now, windowDays: days, totalStoredPosts: dataset.rows.length, latestPostAt, windowPostCount,
    interpretation: 'Recency only; supported patterns additionally require mature observations and comparable outcomes.' };
}

export function getHistoricalWritingExamples({ candidate, behavior, pipeline, directory = corpusRoot } = {}) {
  const file = path.join(directory, pipeline === 'reply' ? 'replies.jsonl' : 'authored_posts.jsonl');
  const dataset = loadRows(file);
  const topic = tokens(`${candidate?.text || ''} ${(candidate?.niche?.tags || []).join(' ')}`);
  const sourceId = String(candidate?.url || '').match(/\/status\/(\d+)/)?.[1];
  const rows = dataset.rows.filter(row => row.id !== sourceId && !row.textPossiblyClipped && row.text && row.url
    && (pipeline === 'reply' ? row.postType === 'reply' : pipeline === 'quote' ? row.postType === 'quote' : row.postType === 'original')
    && (pipeline !== 'thread' || String(row.text).length > 280));
  const ranked = rows.map(row => {
    const words = tokens(`${row.text} ${row.lane || ''}`);
    const overlap = [...topic].filter(word => words.has(word)).length;
    const questionFit = behavior?.primaryPurpose === 'learning' && String(row.text).includes('?') ? 1 : 0;
    return { row, score: overlap + questionFit, overlap };
  }).filter(item => item.overlap >= 2).sort((a, b) => b.score - a.score || String(a.row.id).localeCompare(String(b.row.id)));
  const authors = new Set();
  const examples = [];
  for (const { row, score } of ranked) {
    if (authors.has(row.authorHandle)) continue;
    authors.add(row.authorHandle);
    const features = extractViralStyleFeatures({ text: row.text });
    examples.push({ id: String(row.id), url: row.url, author: row.authorHandle,
      format: pipeline === 'thread' ? 'long_form_post_not_verified_thread' : row.postType,
      postedAt: row.postedAt, observedAt: row.observedAt,
      text: String(row.text).slice(0, 1000), truncated: String(row.text).length > 1000,
      hookLabels: features.hookLabels, styleLabels: features.styleLabels,
      selectionReason: `Route and topic overlap (${score}); no performance or causal claim.` });
    if (examples.length === 3) break;
  }
  return { corpus: path.basename(file), status: dataset.status, storedRecords: dataset.rows.length,
    observationalShapeOnly: true, examples,
    limitation: 'Historical examples guide presentation only. Never copy wording, infer owner experience, reuse their facts or claim that their shape causes reach.' };
}
