import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { parseLessonTool, lessonToolOptions } from "./reading-drills";

test("Variance Bakery is a lesson tool with branded static HTML", () => {
  assert.deepEqual(parseLessonTool("variance-bakery"), { kind: "variance-bakery" });
  assert.ok(lessonToolOptions().some((option) => option.value === "variance-bakery"));

  const html = readFileSync(resolve("public/tools/variance-bakery.html"), "utf8");
  assert.match(html, /--accent:#990f49/);
  assert.match(html, /--bg:#eef3f1/);
  assert.match(html, /Iowan Old Style/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /variance-bakery:height/);
  assert.match(html, /variance-bakery:result/);

  const embed = readFileSync(resolve("components/lesson/VarianceBakeryEmbed.tsx"), "utf8");
  assert.match(embed, /\/tools\/variance-bakery\.html/);
  assert.match(embed, /variance-bakery:height/);

  const player = readFileSync(resolve("components/reading/LessonTool.tsx"), "utf8");
  assert.match(player, /VarianceBakeryEmbed/);

  const sql = readFileSync(resolve("supabase/variance-bakery-lesson.sql"), "utf8");
  assert.match(sql, /ch10-l2/);
  assert.match(sql, /Variance Bakery/);
});
