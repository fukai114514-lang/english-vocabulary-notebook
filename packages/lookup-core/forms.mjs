// Productive rules are applied only to an attested lemma and grammatical class.
const doubled = new Set('admit ban begin clap drop fit forget get grab grip hop incur jog nod occur permit plan plug prefer refer regret rip rob run shop sit skip slip stop submit swim tap trip wrap'.split(' '));
const gradable = new Set('big bright cheap clean cold dark deep early easy fast fine great happy hard heavy high hot kind large late light long low narrow near new old quick rich safe short simple slow small soft strong tall thick thin warm weak wide young'.split(' '));
const regularS = (word) => /[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ies'
  : /(?:s|x|z|ch|sh)$/.test(word) ? word + 'es' : word + 's';
const doubledStem = (word) => doubled.has(word) ? word + word.at(-1) : word;
const regularPastAlternatives = new Set('burn dream hang knit learn spell speed spill spit spoil wake work show'.split(' '));
const irregularThird = { be: 'is', do: 'does', go: 'goes', have: 'has' };

export function buildForms(lemma, grammar) {
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(lemma)) return [];
  const parts = lemma.split('-');
  const word = parts.pop();
  const prefix = parts.length ? parts.join('-') + '-' : '';
  const forms = new Set();
  for (const [part, exceptions] of Object.entries(grammar)) {
    for (const form of exceptions) forms.add(form);
    if (part === 'noun' && exceptions.length === 0 && !word.endsWith('s')) forms.add(prefix + regularS(word));
    if (part !== 'verb' && part !== 'adj') continue;
    if (part === 'verb') {
      forms.add(prefix + (irregularThird[word] ?? regularS(word)));
      if (lemma === 'be') for (const form of ['am', 'are', 'is', 'was', 'were', 'been', 'being']) forms.add(form);
      const ing = word.endsWith('ie') ? word.slice(0, -2) + 'ying'
        : /[^eoy]e$/.test(word) && !['singe', 'dye'].includes(word) ? word.slice(0, -1) + 'ing'
        : doubledStem(word) + 'ing';
      if (lemma !== 'be') forms.add(prefix + ing);
    }
    // An attested non-suffix exception is evidence against a guessed regular past.
    const hasIrregularPast = exceptions.some((form) => !form.endsWith('ing') && !form.endsWith('ed'));
    if (part === 'verb' && (!hasIrregularPast || regularPastAlternatives.has(word)) && lemma !== 'be') {
      const ed = /[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ied' : doubledStem(word) + (word.endsWith('e') ? 'd' : 'ed');
      forms.add(prefix + ed);
    }
    if (part === 'adj' && exceptions.length === 0 && gradable.has(word)) {
      const stem = /[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'i'
        : word.endsWith('e') ? word.slice(0, -1)
        : /^(big|hot|thin)$/.test(word) ? word + word.at(-1) : word;
      forms.add(prefix + stem + 'er');
      forms.add(prefix + stem + 'est');
    }
  }
  forms.delete(lemma);
  return [...forms].sort();
}

const posCodes = {
  n: 'noun', v: 'verb', vt: 'verb', vi: 'verb', adj: 'adj', a: 'adj', adv: 'adv',
};

export function explicitGrammar(labels, observed) {
  const parts = new Set(labels.flatMap((label) => [...(label ?? '').matchAll(/\b(n|vt|vi|v|adj|adv|a)\./gi)]
    .map((match) => posCodes[match[1].toLowerCase()])));
  if (!parts.size) return observed;
  return Object.fromEntries([...parts].map((part) => [part, observed[part] ?? []]));
}
