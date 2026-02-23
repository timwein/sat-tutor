'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Highlighter, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnnotationMark } from '@/lib/types';

interface AnnotatablePassageProps {
  text: string;
  annotations: AnnotationMark[];
  onAnnotationAdd: (annotation: AnnotationMark) => void;
  onAnnotationRemove: (index: number) => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

interface SelectionRange {
  start: number;
  end: number;
}

export function AnnotatablePassage({
  text,
  annotations,
  onAnnotationAdd,
  onAnnotationRemove,
}: AnnotatablePassageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      setToolbar(null);
      setSelectionRange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      setSelectionRange(null);
      return;
    }

    // Calculate offset within the text content
    const preRange = document.createRange();
    preRange.selectNodeContents(containerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    const endOffset = startOffset + range.toString().length;

    if (endOffset <= startOffset) {
      setToolbar(null);
      setSelectionRange(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setToolbar({
      top: rect.top - containerRect.top - 40,
      left: rect.left - containerRect.left + rect.width / 2,
    });
    setSelectionRange({ start: startOffset, end: endOffset });
  }, []);

  // Close toolbar when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setToolbar(null);
        setSelectionRange(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addAnnotation(type: 'highlight' | 'underline') {
    if (!selectionRange) return;

    onAnnotationAdd({
      startOffset: selectionRange.start,
      endOffset: selectionRange.end,
      type,
      color: type === 'highlight' ? '#fef08a' : '#93c5fd',
    });

    setToolbar(null);
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  }

  // Build rendered segments from text and annotations
  function renderAnnotatedText() {
    if (annotations.length === 0) {
      return <span>{text}</span>;
    }

    // Create boundary points
    const boundaries = new Set<number>();
    boundaries.add(0);
    boundaries.add(text.length);
    for (const ann of annotations) {
      boundaries.add(ann.startOffset);
      boundaries.add(ann.endOffset);
    }
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    const segments: React.ReactNode[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const segStart = sortedBoundaries[i];
      const segEnd = sortedBoundaries[i + 1];
      const segText = text.slice(segStart, segEnd);

      // Find all annotations covering this segment
      const covering = annotations
        .map((ann, idx) => ({ ann, idx }))
        .filter(({ ann }) => ann.startOffset <= segStart && ann.endOffset >= segEnd);

      if (covering.length === 0) {
        segments.push(<span key={`seg-${i}`}>{segText}</span>);
      } else {
        const hasHighlight = covering.some(({ ann }) => ann.type === 'highlight');
        const hasUnderline = covering.some(({ ann }) => ann.type === 'underline');
        const highlightColor = covering.find(({ ann }) => ann.type === 'highlight')?.ann.color;

        // Find the index of the first annotation in this segment for removal
        const firstIndex = covering[0].idx;

        segments.push(
          <span
            key={`seg-${i}`}
            className="cursor-pointer"
            style={{
              backgroundColor: hasHighlight ? highlightColor : undefined,
              textDecoration: hasUnderline ? 'underline' : undefined,
              textDecorationColor: hasUnderline ? '#3b82f6' : undefined,
              textUnderlineOffset: '3px',
            }}
            onClick={() => onAnnotationRemove(firstIndex)}
            title="Click to remove annotation"
          >
            {segText}
          </span>
        );
      }
    }

    return <>{segments}</>;
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-gray-800"
      >
        {renderAnnotatedText()}
      </div>

      {toolbar && (
        <div
          className="absolute z-40 flex items-center gap-1 rounded-lg border bg-white px-2 py-1 shadow-lg"
          style={{
            top: toolbar.top,
            left: toolbar.left,
            transform: 'translateX(-50%)',
          }}
        >
          <Button
            variant="ghost"
            size="xs"
            onClick={() => addAnnotation('highlight')}
            className="gap-1 text-yellow-600 hover:bg-yellow-50"
          >
            <Highlighter className="h-3.5 w-3.5" />
            Highlight
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => addAnnotation('underline')}
            className="gap-1 text-blue-600 hover:bg-blue-50"
          >
            <Underline className="h-3.5 w-3.5" />
            Underline
          </Button>
        </div>
      )}
    </div>
  );
}
