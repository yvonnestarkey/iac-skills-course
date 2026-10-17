import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { asAccessDate, isCourseAccessClosed, registrationLabel } from "./student-registration";

test("an expiry date keeps access through that SAST day and closes after it", () => {
  assert.equal(asAccessDate("2026-12-31"), "2026-12-31");
  assert.equal(asAccessDate("soon"), null);
  assert.equal(
    isCourseAccessClosed({ accessExpiresOn: "2026-12-31" }, new Date("2026-12-31T10:00:00+02:00")),
    false
  );
  assert.equal(
    isCourseAccessClosed({ accessExpiresOn: "2026-12-31" }, new Date("2027-01-01T00:30:00+02:00")),
    true
  );
});

test("immediate deregister closes access and keeps the student record", () => {
  assert.equal(isCourseAccessClosed({ deregisteredAt: "2026-10-17T12:00:00.000Z" }), true);
  assert.equal(registrationLabel({ deregisteredAt: "2026-10-17T12:00:00.000Z" }), "Deregistered");
  assert.equal(registrationLabel({ accessActive: true, accessExpiresOn: "2026-12-31" }), "Expires");
  const sql = readFileSync(resolve("supabase/student-access-expiry.sql"), "utf8");
  assert.match(sql, /access_expires_on/);
  assert.match(sql, /deregistered_at/);
  assert.doesNotMatch(sql, /delete from public\.profiles/i);
});

test("coach tools expose deregister and expiry on the list and profile", () => {
  const roster = readFileSync(resolve("components/coach/RosterTab.tsx"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  assert.match(roster, /StudentAccessPanel/);
  assert.match(profile, /StudentAccessPanel/);
  assert.match(readFileSync(resolve("app/api/coach/registration/route.ts"), "utf8"), /deregister|set_expiry|restore/);
  assert.match(readFileSync(resolve("app/api/student/outline/route.ts"), "utf8"), /accessActive/);
});
