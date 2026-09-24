import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  COURSE_DATES,
  ENROLMENT_BODY,
  ENROLMENT_CTA,
  PRICING_TIERS,
  REGISTRATION_PAYMENT,
} from "./sales-copy";

const publicLandingFiles = [
  "components/sales/SalesLanding.tsx",
  "components/sales/RegistrationLanding.tsx",
  "components/sales/EnrolmentOffer.tsx",
  "app/page.tsx",
  "app/login/page.tsx",
];

test("public landing pages no longer ask students to join a waitlist", () => {
  for (const file of publicLandingFiles) {
    const source = readFileSync(resolve(file), "utf8");
    assert.doesNotMatch(source, /WaitlistForm|Join the waitlist|Course waitlist|sales-webinar-banner/i);
  }
});

test("enrolment offer shows the live prices and sends new visitors to register", () => {
  const source = readFileSync(resolve("components/sales/EnrolmentOffer.tsx"), "utf8");
  assert.match(source, /href="\/register"/);
  assert.doesNotMatch(source, /\/checkout|\/api\/checkout/);
  assert.equal(ENROLMENT_CTA, "Start the course");
  assert.match(PRICING_TIERS[0].detail, /US\$327 once-off/);
  assert.match(PRICING_TIERS[1].detail, /6 monthly instalments of US\$60/);
  assert.equal(REGISTRATION_PAYMENT, "Full course: US$327 once-off or US$60 × 6 payments");
  assert.match(COURSE_DATES.body, /Free Preview now/);
  assert.match(ENROLMENT_BODY, /create your account/);
  assert.match(ENROLMENT_BODY, /complete your purchase/);
  const registration = readFileSync(resolve("components/sales/RegistrationLanding.tsx"), "utf8");
  assert.doesNotMatch(registration, /sales-contact-card|WEBINAR/);
  assert.match(registration, /SALES_VIDEO[\s\S]*EnrolmentOffer/);
});
