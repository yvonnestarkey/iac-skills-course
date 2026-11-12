"use client";

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useStudentNav } from "@/lib/student-nav";

const NARROW_QUERY = "(max-width: 860px)";
const TILE_GAP = 22;

function columnCount(collapsed: boolean): number {
  if (typeof window === "undefined") return collapsed ? 3 : 2;
  if (window.matchMedia(NARROW_QUERY).matches) return 1;
  return collapsed ? 3 : 2;
}

export function placeTiles(heights: number[], columns: number, colWidth: number, gap: number) {
  const colCount = Math.max(1, columns);
  const colHeights = Array.from({ length: colCount }, () => 0);
  const positions = heights.map((height) => {
    let col = 0;
    for (let i = 1; i < colCount; i++) {
      if (colHeights[i] < colHeights[col]) col = i;
    }
    const x = col * (colWidth + gap);
    const y = colHeights[col];
    colHeights[col] += height + gap;
    return { x, y, width: colWidth };
  });
  return {
    positions,
    height: Math.max(0, ...colHeights.map((value) => value - gap), 0),
  };
}

export default function StudentDashTiles({ children }: { children: ReactNode }) {
  const nav = useStudentNav();
  const collapsed = Boolean(nav?.collapsed);
  const [columns, setColumns] = useState(() => (collapsed ? 3 : 2));
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const items = Children.toArray(children);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number }[]>([]);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const update = () => setColumns(columnCount(collapsed));
    update();
    const media = window.matchMedia(NARROW_QUERY);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [collapsed]);

  const pack = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (!containerWidth) return;
    const colWidth = (containerWidth - TILE_GAP * (columns - 1)) / columns;
    tileRefs.current.forEach((el) => {
      if (el) el.style.width = `${colWidth}px`;
    });
    const heights = items.map((_, index) => tileRefs.current[index]?.offsetHeight || 0);
    const next = placeTiles(heights, columns, colWidth, TILE_GAP);
    setLayout(next.positions);
    setHeight(next.height);
  }, [columns, items.length]);

  useLayoutEffect(() => {
    pack();
    const container = containerRef.current;
    const observers: ResizeObserver[] = [];
    if (container) {
      const containerObs = new ResizeObserver(() => pack());
      containerObs.observe(container);
      observers.push(containerObs);
    }
    tileRefs.current.forEach((el) => {
      if (!el) return;
      const tileObs = new ResizeObserver(() => pack());
      tileObs.observe(el);
      observers.push(tileObs);
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [pack]);

  return (
    <div className={`student-dash-tiles cols-${columns}`} ref={containerRef} style={{ height: height || undefined }}>
      {items.map((item, index) => {
        const pos = layout[index];
        return (
          <div
            className="student-dash-tile"
            key={index}
            ref={(el) => {
              tileRefs.current[index] = el;
            }}
            style={
              pos
                ? {
                    width: pos.width,
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                  }
                : undefined
            }
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}
