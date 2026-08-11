'use client';

import { SKILL_TAXONOMY } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export interface EvidenceQuestion {
  question_id: string;
  question_text: string;
  sub_skill_id: string;
  section: string;
}

export type EvidenceMap = Record<string, EvidenceQuestion>;

const skillNames = new Map<string, string>(
  [...SKILL_TAXONOMY.math, ...SKILL_TAXONOMY.reading_writing].map((s) => [s.id, s.name])
);

interface EvidenceListProps {
  questionIds: string[];
  evidenceMap: EvidenceMap;
}

/** Expandable list of the actual questions behind an insight finding. */
export function EvidenceList({ questionIds, evidenceMap }: EvidenceListProps) {
  const resolved = questionIds
    .map((id) => evidenceMap[id])
    .filter((q): q is EvidenceQuestion => Boolean(q));

  if (resolved.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Based on {questionIds.length} question{questionIds.length !== 1 ? 's' : ''}
      </p>
    );
  }

  return (
    <details className="group text-sm">
      <summary className="cursor-pointer text-xs font-medium text-blue-700 hover:underline">
        Based on {resolved.length} question{resolved.length !== 1 ? 's' : ''} — view them
      </summary>
      <ul className="mt-2 space-y-2">
        {resolved.map((q) => (
          <li key={q.question_id} className="rounded-lg border bg-gray-50 px-3 py-2">
            <p className="line-clamp-2 text-xs text-gray-700">{q.question_text}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {skillNames.get(q.sub_skill_id) ?? q.sub_skill_id}
            </Badge>
          </li>
        ))}
      </ul>
    </details>
  );
}
