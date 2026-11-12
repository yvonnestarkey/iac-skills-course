import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("student screens can collapse the sidebar with double arrows", () => {
  const nav = readFileSync(resolve("lib/student-nav.tsx"), "utf8");
  const button = readFileSync(resolve("components/student/SidebarCollapseButton.tsx"), "utf8");
  const shell = readFileSync(resolve("components/student/StudentShell.tsx"), "utf8");
  const studentLayout = readFileSync(resolve("app/(student)/layout.tsx"), "utf8");
  const preview = readFileSync(resolve("components/coach/CoachPreviewShell.tsx"), "utf8");
  const styles = readFileSync(resolve("app/globals.css"), "utf8");

  assert.match(nav, /iac-sidebar-collapsed/);
  assert.match(nav, /collapsed/);
  assert.match(button, /ChevronsLeft/);
  assert.match(button, /ChevronsRight/);
  assert.match(button, /Collapse sidebar/);
  assert.match(button, /Expand sidebar/);
  assert.match(button, /title=\{label\}/);
  assert.match(shell, /SidebarCollapseButton/);
  assert.match(shell, /sidebar-collapsed/);
  assert.match(studentLayout, /SidebarCollapseButton/);
  assert.match(preview, /SidebarCollapseButton/);
  assert.match(styles, /grid-template-columns:\s*293px minmax\(0, 1fr\)/);
  assert.match(styles, /\.shell\.sidebar-collapsed[\s\S]*44px/);
});
