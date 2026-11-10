import assert from "node:assert/strict";
import test from "node:test";
import { sastDateAndTimeToIso } from "./dates";
import { DASHBOARD_QUOTES, dashboardQuoteForDate, dashboardQuoteWeekIndex } from "./dashboard-quotes";

test("the first 10 dashboard quotes keep their authors and distinct colours", () => {
  assert.equal(DASHBOARD_QUOTES.length, 10);
  assert.equal(DASHBOARD_QUOTES[0].source, "Samuel Beckett");
  assert.equal(DASHBOARD_QUOTES[3].source, "Japanese proverb");
  assert.equal(DASHBOARD_QUOTES[9].source, "Theodore Roosevelt");
  const colors = new Set(DASHBOARD_QUOTES.map((quote) => quote.color));
  assert.equal(colors.size, 10);
});

test("quotes change on Sunday night SAST and then wrap after 10 weeks", () => {
  const week1 = new Date(sastDateAndTimeToIso("2026-11-10", "15:00") || "");
  const sundayBefore = new Date(sastDateAndTimeToIso("2026-11-15", "19:59") || "");
  const sundayNight = new Date(sastDateAndTimeToIso("2026-11-15", "20:00") || "");
  const week11 = new Date(sastDateAndTimeToIso("2027-01-17", "20:00") || "");

  assert.equal(dashboardQuoteWeekIndex(week1), 0);
  assert.equal(dashboardQuoteForDate(week1).source, "Samuel Beckett");
  assert.equal(dashboardQuoteWeekIndex(sundayBefore), 0);
  assert.equal(dashboardQuoteForDate(sundayNight).source, "Henry Ford");
  assert.equal(dashboardQuoteForDate(sundayNight).color, "#990f49");
  assert.equal(dashboardQuoteWeekIndex(week11), 10);
  assert.equal(dashboardQuoteForDate(week11).source, "Samuel Beckett");
});
