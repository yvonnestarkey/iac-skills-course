"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useStudentNav } from "@/lib/student-nav";

export default function SidebarCollapseButton() {
  const nav = useStudentNav();
  if (!nav) return null;
  const label = nav.collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      className="sidebar-collapse-btn"
      title={label}
      aria-label={label}
      aria-expanded={!nav.collapsed}
      onClick={() => {
        const next = !nav.collapsed;
        nav.setCollapsed(next);
        if (next) nav.setOpen(false);
      }}
    >
      {nav.collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
    </button>
  );
}
