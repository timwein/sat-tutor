// Curated logic-relationship taxonomy for the Transition & Rhetoric Gym
// (RW-09 Transitions, RW-08 Rhetorical Synthesis). The gym's two-step
// drill asks the student to classify the relationship before answering.

export interface LogicRelationship {
  id: string;
  tag: string; // stored in questions.tags as `logic:<tag>`
  name: string;
  shortLabel: string;
  definition: string;
  signalWords: string[];
  example: string;
}

export const LOGIC_RELATIONSHIPS: LogicRelationship[] = [
  {
    id: 'LR-01',
    tag: 'contrast',
    name: 'Contrast',
    shortLabel: 'Contrast',
    definition: 'The second idea opposes or diverges from the first.',
    signalWords: ['however', 'in contrast', 'on the other hand', 'nevertheless', 'by contrast', 'instead'],
    example: 'Early critics dismissed the novel. ______, modern scholars consider it a masterpiece. → however',
  },
  {
    id: 'LR-02',
    tag: 'cause-effect',
    name: 'Cause → effect',
    shortLabel: 'Cause→Effect',
    definition: 'The second idea is a result or consequence of the first.',
    signalWords: ['therefore', 'as a result', 'consequently', 'thus', 'accordingly', 'hence'],
    example: 'The dam blocked sediment flow. ______, the delta began to shrink. → as a result',
  },
  {
    id: 'LR-03',
    tag: 'example',
    name: 'Example / illustration',
    shortLabel: 'Example',
    definition: 'The second idea is a specific instance of the first, more general one.',
    signalWords: ['for example', 'for instance', 'specifically', 'in particular', 'to illustrate'],
    example: 'Some spiders hunt without webs. ______, wolf spiders chase prey on foot. → for instance',
  },
  {
    id: 'LR-04',
    tag: 'continuation',
    name: 'Continuation / addition',
    shortLabel: 'Addition',
    definition: 'The second idea extends or adds to the first in the same direction.',
    signalWords: ['moreover', 'furthermore', 'in addition', 'additionally', 'likewise', 'similarly'],
    example: 'The vaccine proved safe in trials. ______, it was inexpensive to produce. → moreover',
  },
  {
    id: 'LR-05',
    tag: 'concession',
    name: 'Concession',
    shortLabel: 'Concession',
    definition: 'The writer grants a point that cuts against the main claim before reasserting it.',
    signalWords: ['granted', 'admittedly', 'of course', 'to be sure', 'while it is true that'],
    example: '______, the method is slow. Its accuracy, though, justifies the wait. → admittedly',
  },
  {
    id: 'LR-06',
    tag: 'sequence',
    name: 'Sequence / time',
    shortLabel: 'Sequence',
    definition: 'The second idea follows the first in time or in the steps of a process.',
    signalWords: ['then', 'subsequently', 'afterward', 'finally', 'meanwhile', 'next'],
    example: 'The larvae feed for two weeks. ______, they spin cocoons. → subsequently',
  },
];

export function getLogicRelationship(idOrTag: string): LogicRelationship | undefined {
  return LOGIC_RELATIONSHIPS.find((r) => r.id === idOrTag || r.tag === idOrTag);
}

export const LOGIC_TAG_PREFIX = 'logic:';
