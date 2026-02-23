'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ActivityDay } from '@/lib/streak-calculator';

interface ActivityHeatmapProps {
  activityDays: ActivityDay[];
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const LEFT_LABEL_WIDTH = 28;
const TOP_LABEL_HEIGHT = 16;

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS: Array<{ label: string; row: number }> = [
  { label: 'Mon', row: 1 },
  { label: 'Wed', row: 3 },
  { label: 'Fri', row: 5 },
];

function getColor(count: number): string {
  if (count === 0) return '#ebedf0';
  if (count <= 5) return '#9be9a8';
  if (count <= 15) return '#40c463';
  if (count <= 30) return '#30a14e';
  return '#216e39';
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface CellData {
  date: Date;
  dateStr: string;
  count: number;
  col: number;
  row: number;
}

export function ActivityHeatmap({ activityDays }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of activityDays) {
      map.set(day.date, day.questionsAnswered);
    }
    return map;
  }, [activityDays]);

  const { cells, totalCols, monthMarkers } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start 364 days ago (365 days total including today)
    const start = new Date(today);
    start.setDate(start.getDate() - 364);

    // Adjust start to the previous Sunday (column-aligned start)
    const startDow = start.getDay(); // 0=Sun
    start.setDate(start.getDate() - startDow);

    const cellList: CellData[] = [];
    const months: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;

    const current = new Date(start);
    let col = 0;

    while (current <= today || current.getDay() !== 0) {
      // Only add cells up to today
      if (current <= today) {
        const row = current.getDay(); // 0=Sun at top, 6=Sat at bottom
        const dateStr = current.toISOString().split('T')[0];
        const count = activityMap.get(dateStr) ?? 0;

        cellList.push({
          date: new Date(current),
          dateStr,
          count,
          col,
          row,
        });

        // Track month labels at first day of new month
        const month = current.getMonth();
        if (month !== lastMonth) {
          months.push({ label: MONTH_LABELS[month], col });
          lastMonth = month;
        }
      }

      // Advance to next day
      current.setDate(current.getDate() + 1);

      // When wrapping to a new week (Sunday), move to next column
      if (current.getDay() === 0) {
        col++;
      }
    }

    return {
      cells: cellList,
      totalCols: col,
      monthMarkers: months,
    };
  }, [activityMap]);

  const svgWidth = LEFT_LABEL_WIDTH + totalCols * CELL_STEP;
  const svgHeight = TOP_LABEL_HEIGHT + 7 * CELL_STEP;

  const handleMouseEnter = useCallback(
    (cell: CellData, event: React.MouseEvent<SVGRectElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const parentRect = event.currentTarget.closest('svg')?.getBoundingClientRect();
      if (!parentRect) return;

      setTooltip({
        x: rect.left - parentRect.left + CELL_SIZE / 2,
        y: rect.top - parentRect.top - 8,
        text: `${formatDateLabel(cell.date)}: ${cell.count} question${cell.count !== 1 ? 's' : ''}`,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative inline-block" style={{ minWidth: svgWidth }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          role="img"
          aria-label="Activity heatmap showing questions answered per day over the last year"
        >
          {/* Month labels */}
          {monthMarkers.map((m, i) => (
            <text
              key={`month-${i}`}
              x={LEFT_LABEL_WIDTH + m.col * CELL_STEP}
              y={TOP_LABEL_HEIGHT - 4}
              className="fill-muted-foreground"
              fontSize={10}
              fontFamily="system-ui, sans-serif"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels */}
          {DAY_LABELS.map((d) => (
            <text
              key={d.label}
              x={0}
              y={TOP_LABEL_HEIGHT + d.row * CELL_STEP + CELL_SIZE - 2}
              className="fill-muted-foreground"
              fontSize={9}
              fontFamily="system-ui, sans-serif"
            >
              {d.label}
            </text>
          ))}

          {/* Cells */}
          {cells.map((cell) => (
            <rect
              key={cell.dateStr}
              x={LEFT_LABEL_WIDTH + cell.col * CELL_STEP}
              y={TOP_LABEL_HEIGHT + cell.row * CELL_STEP}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              ry={2}
              fill={getColor(cell.count)}
              className="cursor-pointer"
              onMouseEnter={(e) => handleMouseEnter(cell, e)}
              onMouseLeave={handleMouseLeave}
            >
              <title>
                {formatDateLabel(cell.date)}: {cell.count} question
                {cell.count !== 1 ? 's' : ''}
              </title>
            </rect>
          ))}
        </svg>

        {/* Custom floating tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded bg-foreground px-2 py-1 text-xs text-background whitespace-nowrap"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <span>Less</span>
        {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map((color) => (
          <span
            key={color}
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
