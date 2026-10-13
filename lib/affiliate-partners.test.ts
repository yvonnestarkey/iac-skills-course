import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  findSeededProfessionalAffiliate,
  professionalPayoutCents,
  ROELIEN_AFFILIATE,
} from "./affiliate-partners";
import { FALLBACK_PRODUCT, referrerCreditCents } from "./commerce";

test("Roelien's professional code is 15% of the course price and is paid separately", () => {
  assert.equal(ROELIEN_AFFILIATE.code, "ROELIENJ21HD27");
  assert.equal(ROELIEN_AFFILIATE.rate_bps, 1500);
  assert.equal(ROELIEN_AFFILIATE.payout, "external");
  assert.equal(professionalPayoutCents(ROELIEN_AFFILIATE.rate_bps), 4905);
  assert.equal(findSeededProfessionalAffiliate("roelienj21hd27")?.name, "Roelien");
  assert.equal(referrerCreditCents("once_off", FALLBACK_PRODUCT), 3270);
});

test("coach tools expose Referrals instead of Waitlist", () => {
  const home = readFileSync(resolve("app/coach/page.tsx"), "utf8");
  const lists = readFileSync(resolve("app/coach/lists/page.tsx"), "utf8");
  const dash = readFileSync(resolve("components/student/StudentDashboard.tsx"), "utf8");
  assert.match(home, /\/coach\/referrals/);
  assert.match(home, /Referrals/);
  assert.doesNotMatch(home, /\/coach\/waitlist/);
  assert.match(lists, /label: "Referrals"/);
  assert.match(lists, /\/coach\/referrals/);
  assert.match(dash, /\/coach\/referrals/);
  assert.match(dash, />Referrals</);
});
