const wordPattern = /[$£€]\d+(?:[.,]\d+)*(?:[kmb])?|(?:[a-z]\.){2,}|(?:\p{Script=Latin}\p{M}*)+(?:['’‘\-‐‑](?:\p{Script=Latin}\p{M}*)+)*/giu;
const edgePunctuation = /^[\s\p{P}]+|[\s\p{P}]+$/gu;
const utf16WordCharacter = /[\p{L}\p{M}\p{N}_]/u;

export function tokenize(text) {
  const tokens = [];
  for (const match of text.matchAll(wordPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    const previous = Array.from(text.slice(Math.max(0, start - 2), start)).at(-1) ?? '';
    const next = String.fromCodePoint(text.codePointAt(end) ?? 32);
    if (utf16WordCharacter.test(previous) || utf16WordCharacter.test(next)) continue;
    const key = match[0].normalize('NFC').toLowerCase().replace(/[’‘]/gu, "'").replace(/[‐‑]/gu, '-');
    tokens.push({ start, end, key });
  }
  return tokens;
}

function clean(text, maxTokens) {
  if (typeof text !== 'string' || text.length > 256) return null;
  const tokens = tokenize(text);
  if (!tokens.length || tokens.length > maxTokens) return null;
  if (text.slice(0, tokens[0].start).replace(edgePunctuation, '') ||
      text.slice(tokens.at(-1).end).replace(edgePunctuation, '')) return null;
  for (let i = 1; i < tokens.length; i++) {
    if (!gapAllowed(text.slice(tokens[i - 1].end, tokens[i].start))) return null;
  }
  return tokens.map(({ key }) => key).join(' ');
}

export function gapAllowed(gap) {
  return /^[^\S\r\n\v\f\u0085\u2028\u2029]+$/u.test(gap);
}

export const normalizeToken = (text) => clean(text, 1);
export const normalizeExpression = (text) => clean(text, 17);
