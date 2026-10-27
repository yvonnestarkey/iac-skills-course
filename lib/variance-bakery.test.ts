import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { parseLessonTool, lessonToolOptions } from "./reading-drills";
import { isVarianceBakeryLesson } from "./variance-bakery";

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

  assert.equal(isVarianceBakeryLesson({ id: "ch10-l12", title: "Variance Bakery" }), true);
  const embed = readFileSync(resolve("components/lesson/VarianceBakeryEmbed.tsx"), "utf8");
  assert.match(embed, /\/tools\/variance-bakery\.html/);
  assert.match(embed, /variance-bakery:height/);

  const page = readFileSync(resolve("components/student/StudentLessonPage.tsx"), "utf8");
  assert.match(page, /\/tools\/variance-bakery\.html/);
  assert.match(page, /isVarianceBakeryLesson/);
  const lessonTool = readFileSync(resolve("components/reading/LessonTool.tsx"), "utf8");
  assert.match(lessonTool, /VarianceBakeryEmbed/);

  const sql = readFileSync(resolve("supabase/variance-bakery-lesson.sql"), "utf8");
  assert.match(sql, /ch10-l2/);
  assert.match(sql, /Variance Bakery/);
});
