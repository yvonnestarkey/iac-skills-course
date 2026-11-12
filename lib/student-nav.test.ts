import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { placeTiles } from "../components/student/StudentDashTiles";

test("student screens can collapse the sidebar with double arrows", () => {
  const nav = readFileSync(resolve("lib/student-nav.tsx"), "utf8");
  const button = readFileSync(resolve("components/student/SidebarCollapseButton.tsx"), "utf8");
  const shell = readFileSync(resolve("components/student/StudentShell.tsx"), "utf8");
  const studentLayout = readFileSync(resolve("app/(student)/layout.tsx"), "utf8");
  const preview = readFileSync(resolve("components/coach/CoachPreviewShell.tsx"), "utf8");
  const styles = readFileSync(resolve("app/globals.css"), "utf8");
  const tiles = readFileSync(resolve("components/student/StudentDashTiles.tsx"), "utf8");

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
  assert.match(styles, /\.student-dash-tiles/);
  assert.match(styles, /\.student-dash-tile/);
  assert.match(tiles, /collapsed \? 3 : 2/);
  assert.match(tiles, /placeTiles/);
});

test("dashboard tiles drop into the shortest column so feedback is not stuck under tasks", () => {
  const packed = placeTiles([360, 520, 780, 340, 260], 2, 300, 22);
  assert.equal(packed.positions[0].x, 0);
  assert.equal(packed.positions[1].x, 322);
  assert.equal(packed.positions[2].x, 0);
  assert.equal(packed.positions[4].x, 322);
  assert.ok(packed.positions[4].y < packed.positions[2].y + 780);
});
