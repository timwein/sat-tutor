'use client';

import { useEffect, useState } from 'react';
import { AnnotatablePassage } from '@/components/annotatable-passage';
import type { AnnotationMark } from '@/lib/types';

interface SelfAnnotatingPassageProps {
  text: string;
}

/**
 * AnnotatablePassage with self-contained annotation state, reset whenever the
 * passage changes. Highlighting/underlining is a per-question scratchpad -
 * marks are intentionally not persisted.
 */
export function SelfAnnotatingPassage({ text }: SelfAnnotatingPassageProps) {
  const [annotations, setAnnotations] = useState<AnnotationMark[]>([]);

  useEffect(() => {
    setAnnotations([]);
  }, [text]);

  return (
    <AnnotatablePassage
      text={text}
      annotations={annotations}
      onAnnotationAdd={(mark) => setAnnotations((prev) => [...prev, mark])}
      onAnnotationRemove={(index) =>
        setAnnotations((prev) => prev.filter((_, i) => i !== index))
      }
    />
  );
}
