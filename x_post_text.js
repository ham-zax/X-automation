// Raw X text normalization. Display ranges are not applied to full authored text.
export function decodeText(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, token) => {
    if (token[0] !== '#') return named[token.toLowerCase()] ?? match;
    const hex = token[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

export function textFromRaw(raw) {
  const note = raw?.note_tweet?.note_tweet_results?.result
    || raw?.note_tweet_results?.result
    || raw?.note_tweet?.result;
  if (typeof note?.text === 'string' && note.text.trim()) {
    return { text: decodeText(note.text).trim(), textSource: 'note_tweet' };
  }
  return { text: decodeText(raw?.legacy?.full_text ?? raw?.legacy?.text ?? '').trim(), textSource: 'legacy_full_text' };
}


// The map belongs to one reader. Quotes and visibility wrappers retain exact IDs.
export function captureNoteTexts(value, texts) {
  if (!value || typeof value !== 'object') return;
  if (value.legacy) {
    const id = String(value.legacy.id_str || value.rest_id || '');
    const normalized = textFromRaw(value);
    if (id && normalized.textSource === 'note_tweet') texts.set(id, normalized);
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') captureNoteTexts(child, texts);
  }
}
