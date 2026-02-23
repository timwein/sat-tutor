'use client';

import { useMemo, useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SKILL_TAXONOMY } from '@/lib/types';
import type { SkillRating } from '@/lib/types';
import { getMasteryLevel } from '@/lib/elo';
import {
  SKILL_PREREQUISITES,
  getSkillTreeStatus,
  type SkillTreeStatus,
} from '@/lib/skill-prerequisites';
import { Lock, LayoutGrid, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface SkillMapProps {
  skillRatings: SkillRating[];
  onSkillClick: (skillId: string) => void;
  showTree?: boolean;
}

const MASTERY_STYLES: Record<string, string> = {
  Developing: 'bg-red-100 border-red-300 text-red-800',
  Progressing: 'bg-amber-100 border-amber-300 text-amber-800',
  Proficient: 'bg-blue-100 border-blue-300 text-blue-800',
  Mastered: 'bg-yellow-50 border-yellow-400 text-yellow-800 ring-1 ring-yellow-300',
  'Not Started': 'bg-gray-50 border-gray-200 text-gray-500',
};

const TREE_STATUS_STYLES: Record<SkillTreeStatus, string> = {
  locked: 'bg-gray-100 border-gray-200 text-gray-400 opacity-60',
  available: 'bg-gray-50 border-gray-200 text-gray-500 ring-2 ring-blue-300 animate-pulse-ring',
  in_progress: '', // handled by mastery level styles
  mastered: 'bg-yellow-50 border-yellow-400 text-yellow-800 ring-1 ring-yellow-300',
};

interface EdgePosition {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isActive: boolean;
  fromId: string;
  toId: string;
}

function groupByDomain(
  skills: ReadonlyArray<{ id: string; name: string; domain: string }>
): Map<string, Array<{ id: string; name: string; domain: string }>> {
  const groups = new Map<string, Array<{ id: string; name: string; domain: string }>>();
  for (const skill of skills) {
    const existing = groups.get(skill.domain);
    if (existing) {
      existing.push(skill);
    } else {
      groups.set(skill.domain, [skill]);
    }
  }
  return groups;
}

export function SkillMap({ skillRatings, onSkillClick, showTree = false }: SkillMapProps) {
  const [treeView, setTreeView] = useState(false);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [edgePositions, setEdgePositions] = useState<EdgePosition[]>([]);

  const ratingMap = useMemo(() => {
    const map = new Map<string, SkillRating>();
    for (const r of skillRatings) {
      map.set(r.sub_skill_id, r);
    }
    return map;
  }, [skillRatings]);

  const rwDomains = useMemo(
    () => groupByDomain(SKILL_TAXONOMY.reading_writing),
    []
  );
  const mathDomains = useMemo(
    () => groupByDomain(SKILL_TAXONOMY.math),
    []
  );

  const setCellRef = useCallback((skillId: string, el: HTMLButtonElement | null) => {
    if (el) {
      cellRefs.current.set(skillId, el);
    } else {
      cellRefs.current.delete(skillId);
    }
  }, []);

  const computeEdges = useCallback(() => {
    if (!treeView || !showTree || !containerRef.current) {
      setEdgePositions([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const edges: EdgePosition[] = [];

    for (const edge of SKILL_PREREQUISITES) {
      const fromEl = cellRefs.current.get(edge.from);
      const toEl = cellRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const fromStatus = getSkillTreeStatus(edge.from, ratingMap);
      const toStatus = getSkillTreeStatus(edge.to, ratingMap);
      const isActive =
        fromStatus !== 'locked' && toStatus !== 'locked';

      edges.push({
        fromX: fromRect.left + fromRect.width / 2 - containerRect.left,
        fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
        toX: toRect.left + toRect.width / 2 - containerRect.left,
        toY: toRect.top + toRect.height / 2 - containerRect.top,
        isActive,
        fromId: edge.from,
        toId: edge.to,
      });
    }

    setEdgePositions(edges);
  }, [treeView, showTree, ratingMap]);

  useLayoutEffect(() => {
    computeEdges();
  }, [computeEdges]);

  useEffect(() => {
    if (!treeView || !showTree || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      computeEdges();
    });

    observer.observe(containerRef.current);

    // Also recompute on window resize
    window.addEventListener('resize', computeEdges);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeEdges);
    };
  }, [treeView, showTree, computeEdges]);

  function getTreeCellStyle(skill: { id: string; name: string; domain: string }): string {
    const status = getSkillTreeStatus(skill.id, ratingMap);
    if (status === 'locked') return TREE_STATUS_STYLES.locked;
    if (status === 'mastered') return TREE_STATUS_STYLES.mastered;
    if (status === 'in_progress') {
      const rating = ratingMap.get(skill.id);
      const elo = rating?.elo_rating ?? 0;
      const mastery = getMasteryLevel(elo);
      return MASTERY_STYLES[mastery];
    }
    // available
    return TREE_STATUS_STYLES.available;
  }

  function renderCell(skill: { id: string; name: string; domain: string }) {
    const isTreeMode = showTree && treeView;
    const rating = ratingMap.get(skill.id);
    const hasRating = !!rating;
    const elo = rating?.elo_rating ?? 0;

    let styles: string;
    let isLocked = false;
    let statusLabel: string;

    if (isTreeMode) {
      const status = getSkillTreeStatus(skill.id, ratingMap);
      styles = getTreeCellStyle(skill);
      isLocked = status === 'locked';
      if (status === 'locked') {
        statusLabel = 'Locked';
      } else if (status === 'available') {
        statusLabel = 'Available';
      } else if (status === 'mastered') {
        statusLabel = 'Mastered';
      } else {
        statusLabel = getMasteryLevel(elo);
      }
    } else {
      const mastery = hasRating ? getMasteryLevel(elo) : 'Not Started';
      styles = MASTERY_STYLES[mastery];
      statusLabel = mastery;
    }

    return (
      <Tooltip key={skill.id}>
        <TooltipTrigger asChild>
          <button
            ref={(el) => setCellRef(skill.id, el)}
            onClick={() => {
              if (!isLocked) onSkillClick(skill.id);
            }}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              styles,
              isLocked && 'pointer-events-none cursor-default hover:shadow-none'
            )}
            aria-disabled={isLocked}
          >
            <span className="flex w-full items-center justify-between">
              <span className="text-xs font-semibold opacity-70">{skill.id}</span>
              {isLocked && <Lock className="size-3.5 opacity-50" />}
            </span>
            <span className="text-sm font-medium leading-tight line-clamp-2">
              {skill.name}
            </span>
            {hasRating && !isLocked && (
              <span className="mt-auto pt-1 text-xs font-mono opacity-60">
                {elo}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="font-medium">{skill.name}</p>
          <p className="text-xs opacity-80">
            {isLocked
              ? 'Complete prerequisites to unlock'
              : hasRating
                ? `Elo: ${elo} — ${statusLabel}`
                : statusLabel}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  function renderSection(
    title: string,
    domains: Map<string, Array<{ id: string; name: string; domain: string }>>
  ) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        <div className="space-y-6">
          {Array.from(domains.entries()).map(([domain, skills]) => (
            <div key={domain}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {domain}
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {skills.map((skill) => renderCell(skill))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderEdgesSVG() {
    if (edgePositions.length === 0) return null;

    // Find SVG bounds from edge positions
    let maxX = 0;
    let maxY = 0;
    for (const e of edgePositions) {
      maxX = Math.max(maxX, e.fromX, e.toX);
      maxY = Math.max(maxY, e.fromY, e.toY);
    }

    return (
      <svg
        className="pointer-events-none absolute inset-0 z-10"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker
            id="arrowhead-active"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgb(59 130 246)" />
          </marker>
          <marker
            id="arrowhead-locked"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgb(156 163 175)" />
          </marker>
        </defs>
        {edgePositions.map((edge) => (
          <line
            key={`${edge.fromId}-${edge.toId}`}
            x1={edge.fromX}
            y1={edge.fromY}
            x2={edge.toX}
            y2={edge.toY}
            stroke={edge.isActive ? 'rgb(59 130 246)' : 'rgb(156 163 175)'}
            strokeWidth={edge.isActive ? 2 : 1.5}
            strokeDasharray={edge.isActive ? 'none' : '6 4'}
            strokeOpacity={edge.isActive ? 0.6 : 0.4}
            markerEnd={
              edge.isActive
                ? 'url(#arrowhead-active)'
                : 'url(#arrowhead-locked)'
            }
          />
        ))}
      </svg>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {showTree && (
          <div className="flex items-center gap-2">
            <Button
              variant={treeView ? 'outline' : 'default'}
              size="sm"
              onClick={() => setTreeView(false)}
            >
              <LayoutGrid className="size-4" />
              Grid View
            </Button>
            <Button
              variant={treeView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTreeView(true)}
            >
              <GitBranch className="size-4" />
              Tree View
            </Button>
          </div>
        )}
        <div ref={containerRef} className="relative space-y-8">
          {showTree && treeView && renderEdgesSVG()}
          {renderSection('Reading & Writing', rwDomains)}
          {renderSection('Math', mathDomains)}
        </div>
      </div>
    </TooltipProvider>
  );
}
