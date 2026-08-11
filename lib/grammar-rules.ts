// Curated grammar rule taxonomy for Standard English Conventions
// (RW-10 Boundaries, RW-11 Form/Structure/Sense). Each rule carries a
// 60-second micro-lesson: the rule, a wrong/fixed pair, the SAT's trap,
// and the tell that identifies it in a question.

export interface GrammarRule {
  id: string;
  tag: string; // stored in questions.tags as `grammar:<tag>`
  name: string;
  subSkillId: 'RW-10' | 'RW-11';
  rule: string;
  wrongExample: string;
  fixedExample: string;
  trap: string;
  tell: string;
}

export const GRAMMAR_RULES: GrammarRule[] = [
  // ---- RW-10 · Boundaries ----
  {
    id: 'GR-01',
    tag: 'comma-splice',
    name: 'Comma splices & fused sentences',
    subSkillId: 'RW-10',
    rule: 'Two complete sentences cannot be joined by just a comma (splice) or nothing (fused). They need a period, a semicolon, or a comma plus a coordinating conjunction (for, and, nor, but, or, yet, so).',
    wrongExample: 'The reef was dying, scientists raced to find the cause.',
    fixedExample: 'The reef was dying, so scientists raced to find the cause.',
    trap: 'The comma-only choice sounds natural read aloud, so your ear approves it.',
    tell: 'Check both sides of the punctuation: if each side could stand alone as a sentence, a bare comma is never the answer.',
  },
  {
    id: 'GR-02',
    tag: 'semicolon-colon',
    name: 'Semicolons vs commas vs colons',
    subSkillId: 'RW-10',
    rule: 'A semicolon joins two complete sentences. A colon follows a complete sentence and introduces an explanation, list, or example. A comma alone cannot do either job.',
    wrongExample: 'The experiment had one flaw; a contaminated sample.',
    fixedExample: 'The experiment had one flaw: a contaminated sample.',
    trap: 'Semicolon and colon choices look interchangeable when you skim; only the completeness of each side separates them.',
    tell: 'Test each side for completeness. Complete + complete → semicolon. Complete + fragment that explains → colon.',
  },
  {
    id: 'GR-03',
    tag: 'dependent-clause',
    name: 'Punctuation with dependent clauses',
    subSkillId: 'RW-10',
    rule: 'A dependent clause before the main clause takes a comma after it. A dependent clause after the main clause usually takes no comma. Never use a semicolon to attach a dependent clause.',
    wrongExample: 'Although the data was incomplete; the team published anyway.',
    fixedExample: 'Although the data was incomplete, the team published anyway.',
    trap: 'The semicolon looks "stronger" and therefore more correct after a long clause.',
    tell: 'Words like although, because, when, while, since open a clause that can never stand alone — a semicolon next to one is automatically wrong.',
  },
  {
    id: 'GR-04',
    tag: 'nonessential',
    name: 'Nonessential elements (paired commas & dashes)',
    subSkillId: 'RW-10',
    rule: 'Extra information that could be lifted out without breaking the sentence is fenced by a PAIR of commas or a PAIR of dashes — never one of each, never just one side.',
    wrongExample: 'The novelist — famous for her short stories, wrote only one novel.',
    fixedExample: 'The novelist — famous for her short stories — wrote only one novel.',
    trap: 'The question shows only one fence post; the other is buried earlier or later in the sentence.',
    tell: 'Find the first fence post, then match its type. Read the sentence with the fenced part deleted — it must still work.',
  },
  {
    id: 'GR-05',
    tag: 'names-titles',
    name: 'Punctuation around names & titles',
    subSkillId: 'RW-10',
    rule: 'If the name/title identifies which one (essential), no commas. If it merely adds detail about an already-identified noun (nonessential), commas. "The chemist Marie Curie" — no commas; "Marie Curie, a chemist, ..." — commas.',
    wrongExample: 'The poem, "Ozymandias" was written in 1817.',
    fixedExample: 'The poem "Ozymandias" was written in 1817.',
    trap: 'A single comma before the name splits subject from verb while looking like polite pause punctuation.',
    tell: 'Ask: does the sentence still identify the specific thing without the name? If not, the name is essential — zero commas.',
  },
  {
    id: 'GR-06',
    tag: 'no-punctuation',
    name: 'No punctuation between core sentence parts',
    subSkillId: 'RW-10',
    rule: 'Never separate a subject from its verb, or a verb from its object, with a single comma. When in doubt on the SAT, the no-punctuation choice is correct more often than your ear expects.',
    wrongExample: 'The theory that microbes cause disease, transformed medicine.',
    fixedExample: 'The theory that microbes cause disease transformed medicine.',
    trap: 'Long subjects make you want to "breathe" with a comma right before the verb.',
    tell: 'Strip the sentence to subject + verb. If the comma sits between them with no paired partner, cut it.',
  },
  // ---- RW-11 · Form, Structure, and Sense ----
  {
    id: 'GR-07',
    tag: 'subject-verb',
    name: 'Subject–verb agreement (interrupted subjects)',
    subSkillId: 'RW-11',
    rule: 'The verb agrees with the grammatical subject, not with nouns inside phrases between them. Prepositional phrases (of the students, in the archives) never contain the subject.',
    wrongExample: 'The collection of rare manuscripts were digitized.',
    fixedExample: 'The collection of rare manuscripts was digitized.',
    trap: 'A plural noun is parked directly before the verb so proximity overrides grammar.',
    tell: 'Cross out every phrase between subject and verb, then read what remains: "The collection ... was."',
  },
  {
    id: 'GR-08',
    tag: 'verb-tense',
    name: 'Verb tense & sequence',
    subSkillId: 'RW-11',
    rule: 'Verb tense stays consistent with the time frame the passage establishes; shift only when the meaning shifts time. Match surrounding verbs unless a time cue (by 1900, today, since then) demands otherwise.',
    wrongExample: 'She earned her degree in 1972 and becomes a judge a decade later.',
    fixedExample: 'She earned her degree in 1972 and became a judge a decade later.',
    trap: 'The underlined verb sits far from the verb that sets the time frame.',
    tell: 'Find the nearest non-underlined verb and any date cues; the answer almost always matches them.',
  },
  {
    id: 'GR-09',
    tag: 'pronoun',
    name: 'Pronoun–antecedent agreement & ambiguity',
    subSkillId: 'RW-11',
    rule: 'A pronoun matches its antecedent in number, and the antecedent must be unambiguous. Singular nouns like "team," "committee," and "each" take singular pronouns (it, its).',
    wrongExample: 'The museum expanded their collection of Ming ceramics.',
    fixedExample: 'The museum expanded its collection of Ming ceramics.',
    trap: '"Their" sounds natural for organizations in everyday speech.',
    tell: 'Name the antecedent out loud. If it is one thing — even one made of people — the pronoun is it/its.',
  },
  {
    id: 'GR-10',
    tag: 'modifier',
    name: 'Modifier placement (dangling & misplaced)',
    subSkillId: 'RW-11',
    rule: 'An opening descriptive phrase must be immediately followed by the noun it describes. Whoever or whatever is doing the action in the modifier must come right after the comma.',
    wrongExample: 'Hiking the ridge trail, the storm forced the group back.',
    fixedExample: 'Hiking the ridge trail, the group was forced back by the storm.',
    trap: 'All four choices contain the same facts; only the noun after the comma changes.',
    tell: 'Ask "who is doing the -ing?" — that noun must be the very next thing after the comma.',
  },
  {
    id: 'GR-11',
    tag: 'parallel',
    name: 'Parallel structure in lists & comparisons',
    subSkillId: 'RW-11',
    rule: 'Items in a list or comparison take the same grammatical form: all nouns, all -ing verbs, all infinitives. Comparisons must compare like to like ("the paintings of Monet" to "those of Degas," not to "Degas").',
    wrongExample: 'The program teaches drafting, revising, and how to edit.',
    fixedExample: 'The program teaches drafting, revising, and editing.',
    trap: 'The first two items establish a rhythm; the flawed third item hides at the end.',
    tell: 'Read the list items in isolation against the shared opener — each must click into the same slot.',
  },
  {
    id: 'GR-12',
    tag: 'plural-possessive',
    name: 'Plurals vs possessives',
    subSkillId: 'RW-11',
    rule: "Plural = no apostrophe (scientists). Singular possessive = 's (scientist's). Plural possessive = s' (scientists'). Its = possessive; it's = it is.",
    wrongExample: "The satellites' orbit decayed after it's thrusters failed.",
    fixedExample: "The satellite's orbit decayed after its thrusters failed.",
    trap: 'Choices differ only in apostrophe position, so all four look identical at reading speed.',
    tell: 'Count the owners, then check ownership: one owner → ’s; many owners → s’; no ownership → no apostrophe.',
  },
];

export function getGrammarRule(idOrTag: string): GrammarRule | undefined {
  return GRAMMAR_RULES.find((r) => r.id === idOrTag || r.tag === idOrTag);
}

export const GRAMMAR_TAG_PREFIX = 'grammar:';
