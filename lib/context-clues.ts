// Curated content for the Word Detective: the five context-clue types,
// the charge test, and a crash course in high-yield SAT roots. Powers the
// two-step decode drill for Words in Context (RW-05).

export interface ClueType {
  id: string;
  tag: string; // stored in questions.tags as `clue:<tag>`
  name: string;
  shortLabel: string;
  definition: string;
  signalWords: string[];
  example: string;
}

export const CLUE_TYPES: ClueType[] = [
  {
    id: 'CL-01',
    tag: 'restatement',
    name: 'Restatement',
    shortLabel: 'Restatement',
    definition: 'The definition is hiding nearby - after a comma, dash, or colon, or in the next sentence saying the same thing another way.',
    signalWords: ['that is', 'in other words', '— (dash)', ': (colon)', 'meaning'],
    example: 'Her approach was methodical — careful, measured, and slow. → the dash restates the blank',
  },
  {
    id: 'CL-02',
    tag: 'contrast',
    name: 'Contrast',
    shortLabel: 'Contrast',
    definition: 'A pivot word flips the direction: the blank must OPPOSE what the rest of the sentence says.',
    signalWords: ['but', 'however', 'although', 'despite', 'whereas', 'unlike'],
    example: 'Although the manuscript looked chaotic, its organization was in fact ______. → opposite of chaotic',
  },
  {
    id: 'CL-03',
    tag: 'cause-effect',
    name: 'Cause → effect',
    shortLabel: 'Cause→Effect',
    definition: 'The blank must complete a logical chain - what follows from the stated cause, or causes the stated result.',
    signalWords: ['because', 'so', 'therefore', 'as a result', 'thus', 'led to'],
    example: 'Because the evidence was ______, the jury deliberated for only an hour. → evidence must be decisive',
  },
  {
    id: 'CL-04',
    tag: 'example',
    name: 'Example / list',
    shortLabel: 'Example',
    definition: 'Specific examples nearby show what the blank must generalize - the blank sums up the list.',
    signalWords: ['for example', 'for instance', 'such as', 'including', 'like'],
    example: 'The naturalist was ______, recording beetle counts, leaf sizes, even soil temperatures. → meticulous-ish',
  },
  {
    id: 'CL-05',
    tag: 'parallel',
    name: 'Parallel structure',
    shortLabel: 'Parallel',
    definition: 'The blank sits in a list or paired structure and must match the direction and tone of its neighbors.',
    signalWords: ['and', 'both ... and', 'not only ... but also', 'as ... as'],
    example: 'The review praised the film as inventive, moving, and ______. → another positive word',
  },
];

export function getClueType(idOrTag: string): ClueType | undefined {
  return CLUE_TYPES.find((c) => c.id === idOrTag || c.tag === idOrTag);
}

export const CLUE_TAG_PREFIX = 'clue:';
export const CHARGE_TAG_PREFIX = 'charge:';
export const CHARGES = ['positive', 'negative', 'neutral'] as const;
export type Charge = (typeof CHARGES)[number];

export interface RootEntry {
  root: string;
  meaning: string;
  examples: string;
}

// High-yield roots and prefixes: partial decodes that, combined with the
// charge test, settle most unknown-word choices.
export const SAT_ROOTS: RootEntry[] = [
  { root: 'ben- / bene-', meaning: 'good', examples: 'benevolent, benefactor, benign' },
  { root: 'mal-', meaning: 'bad', examples: 'malevolent, malign, malady' },
  { root: 'eu-', meaning: 'good, pleasant', examples: 'euphonious, eulogy, euphemism' },
  { root: 'dys-', meaning: 'bad, difficult', examples: 'dysfunction, dystopia' },
  { root: '-cred-', meaning: 'believe', examples: 'credulous, incredulous, credible' },
  { root: '-dict-', meaning: 'say, speak', examples: 'contradict, edict, dictum' },
  { root: '-loc- / -loq-', meaning: 'speak, talk', examples: 'loquacious, circumlocution, eloquent' },
  { root: '-voc- / -vok-', meaning: 'call, voice', examples: 'vociferous, equivocate, invoke' },
  { root: '-ver-', meaning: 'truth', examples: 'veracity, verify, verisimilitude' },
  { root: '-fid-', meaning: 'faith, trust', examples: 'perfidious, fidelity, confide' },
  { root: '-mut-', meaning: 'change', examples: 'mutable, immutable, permutation' },
  { root: '-plac-', meaning: 'please, calm', examples: 'placate, implacable, complacent' },
  { root: '-tract-', meaning: 'pull, drag', examples: 'intractable, retract, protracted' },
  { root: '-pug-', meaning: 'fight', examples: 'pugnacious, impugn, repugnant' },
  { root: '-bell-', meaning: 'war', examples: 'bellicose, belligerent, antebellum' },
  { root: '-am- / -amic-', meaning: 'love, friend', examples: 'amiable, amicable, enamored' },
  { root: '-path-', meaning: 'feeling, suffering', examples: 'antipathy, empathy, apathetic' },
  { root: '-anim-', meaning: 'mind, spirit', examples: 'equanimity, magnanimous, unanimous' },
  { root: 'circum-', meaning: 'around', examples: 'circumspect, circumscribe, circumvent' },
  { root: 'e- / ex-', meaning: 'out, from', examples: 'exculpate, expunge, evince' },
  { root: 'in- / im- (1)', meaning: 'not', examples: 'ineffable, implacable, incontrovertible' },
  { root: 'in- / im- (2)', meaning: 'in, into', examples: 'inundate, imbue, incise' },
  { root: 'ob-', meaning: 'against, blocking', examples: 'obdurate, obstreperous, obfuscate' },
  { root: 'sub-', meaning: 'under, below', examples: 'subjugate, surreptitious, subordinate' },
  { root: '-fic / -fy', meaning: 'make, do', examples: 'edify, ossify, proficient' },
];
