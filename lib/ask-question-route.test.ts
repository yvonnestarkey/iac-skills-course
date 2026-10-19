import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ask-question waits for a request before creating Supabase", () => {
  const src = readFileSync(resolve("app/api/student/ask-question/route.ts"), "utf8");
  assert.doesNotMatch(src, /const supabase = createClient/);
  assert.match(src, /getServiceSupabase/);
});
