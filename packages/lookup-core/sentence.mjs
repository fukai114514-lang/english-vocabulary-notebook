// Inputs are one eligible reading block. Offsets always refer to the original UTF-16 text.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
const fallbackEnd = /(?:[!?。！？]+|\.(?=\s|$))["'”’)]*\s+|[\r\n\u2028\u2029]+/gu;

export function sentenceAt(text, anchor) {
  if (typeof text !== 'string' || !Number.isSafeInteger(anchor?.start) || !Number.isSafeInteger(anchor?.end) ||
      anchor.start < 0 || anchor.start >= text.length || anchor.end < anchor.start || anchor.end > text.length) return null;
  let start = 0;
  let end = text.length;
  if (segmenter) {
    const sentence = segmenter.segment(text).containing(anchor.start);
    start = sentence.index;
    end = start + sentence.segment.length;
  }
  const offset = start;
  const portion = text.slice(start, end);
  for (const boundary of portion.matchAll(fallbackEnd)) {
    const dot = offset + boundary.index;
    const before = text.slice(Math.max(0, dot - 12), dot);
    if (boundary[0][0] === '.' && (/\b(?:mr|mrs|ms|dr|prof|jr|sr|st|vs|etc)$/iu.test(before) ||
        /(?:\b[A-Z]|(?:[A-Za-z]\.)+[A-Za-z])$/u.test(before))) continue;
    const after = dot + boundary[0].length;
    if (after <= anchor.start) start = after;
    else { end = after; break; }
  }
  return anchor.end <= end ? { start, end, text: text.slice(start, end) } : null;
}
