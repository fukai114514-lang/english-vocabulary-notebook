// Original bilingual lookup notes. Slot grammar is private to the matcher.
const records = [
  ['take into account', 'word-pattern', ['@take into account', '@take NP into account'], '把……考虑在内', 'Include a factor when making a decision.'],
  ['take for granted', 'idiom', ['@take NP for granted', '@take for granted'], '视为理所当然；想当然地认为', 'Assume something is true or expect it without appreciating it.'],
  ['in charge of', 'fixed-expression', ['in charge of'], '负责；主管', 'Have responsibility for an activity or a group.'],
  ['at odds with', 'idiom', ['at odds with'], '与……不一致；与……有分歧', 'Conflict with a view, fact or person.'],
  ['by no means', 'fixed-expression', ['by no means'], '决不；一点也不', 'Emphasize that a statement does not hold.'],
  ['in light of', 'fixed-expression', ['in light of', 'in the light of'], '鉴于；考虑到', 'Consider a fact when interpreting or deciding something.'],
  ['put off', 'phrasal-verb', ['@put off', '@put NP off'], '推迟；使反感', 'Delay an event, or make someone less willing or interested.'],
  ['pick up', 'phrasal-verb', ['@pick up', '@pick NP up'], '拿起；接人；学会等，具体义项取决于宾语', 'Lift something, collect someone, or acquire a skill, among other uses.'],
  ['prevent somebody from doing something', 'word-pattern', ['@prevent NP from GERUND NP', '@prevent NP from GERUND'], '阻止某人做某事', 'Stop an agent from carrying out an action.'],
  ['come up with', 'phrasal-verb', ['@come up with'], '想出；提出；设法提供', 'Produce an idea, solution or resource.'],
  ['bank account', 'collocation', ['bank account', 'bank accounts'], '银行账户', 'An arrangement for holding money with a bank.'],
];

export const constructions = records.map(([lemma, category, patterns, meaningZh, definitionEn]) => ({
  id: 'construction:' + lemma.replaceAll(' ', '-'), lemma, category, patterns, meaningZh, definitionEn,
}));
