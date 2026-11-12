"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { useStudentNav } from "@/lib/student-nav";

const NARROW_QUERY = "(max-width: 860px)";

function columnCount(collapsed: boolean): number {
  if (typeof window === "undefined") return collapsed ? 3 : 2;
  if (window.matchMedia(NARROW_QUERY).matches) return 1;
  return collapsed ? 3 : 2;
}

export default function StudentDashTiles({ children }: { children: ReactNode }) {
  const nav = useStudentNav();
  const collapsed = Boolean(nav?.collapsed);
  const [columns, setColumns] = useState(() => (collapsed ? 3 : 2));

  useEffect(() => {
    const update = () => setColumns(columnCount(collapsed));
    update();
    const media = window.matchMedia(NARROW_QUERY);
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [collapsed]);

  const items = Children.toArray(children);
  const cols = Array.from({ length: columns }, () => [] as ReactNode[]);
  items.forEach((item, index) => {
    cols[index % columns].push(item);
  });

  return (
    <div className={`student-dash-tiles cols-${columns}`}>
      {cols.map((col, index) => (
        <div className="student-dash-tiles-col" key={index}>
          {col}
        </div>
      ))}
    </div>
  );
}
