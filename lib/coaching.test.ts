import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { COACHING_BOOKING_NOTE } from "./coaching";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("student coaching page shows the one-session booking note under the heading", () => {
  const source = readFileSync(join(root, "components/student/StudentCoachingPage.tsx"), "utf8");
  assert.match(source, /<h1>\{config\.title\}<\/h1>\s*<p className="coaching-booking-note">\{COACHING_BOOKING_NOTE\}<\/p>/);
  assert.match(
    COACHING_BOOKING_NOTE,
    /set up ONE session\. Additional sessions will be agreed upon if they're needed and if you're submitting tasks\./,
  );
});
