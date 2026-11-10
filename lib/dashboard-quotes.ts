import { sastDateAndTimeToIso } from "./dates";

export type DashboardQuote = {
  text: string;
  source: string;
  color: string;
};

/** Sunday 8 Nov 2026 20:00 SAST — week 1 starts that Sunday night. */
export const DASHBOARD_QUOTE_EPOCH = sastDateAndTimeToIso("2026-11-08", "20:00") || "2026-11-08T18:00:00.000Z";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const DASHBOARD_QUOTES: DashboardQuote[] = [
  {
    text: "Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.",
    source: "Samuel Beckett",
    color: "#3f625c",
  },
  {
    text: "Failure is simply the opportunity to begin again, this time more intelligently.",
    source: "Henry Ford",
    color: "#990f49",
  },
  {
    text: "I’ve failed over and over and over again in my life. And that is why I succeed.",
    source: "Michael Jordan",
    color: "#184e77",
  },
  {
    text: "Fall seven times, stand up eight.",
    source: "Japanese proverb",
    color: "#7a3412",
  },
  {
    text: "Success is the sum of small efforts, repeated day in and day out.",
    source: "Robert Collier",
    color: "#1f7b70",
  },
  {
    text: "Drop by drop is the water pot filled.",
    source: "The Buddha (Dhammapada)",
    color: "#5c2d91",
  },
  {
    text: "Knowing is not enough; we must apply. Willing is not enough; we must do.",
    source: "Johann Wolfgang von Goethe",
    color: "#9a3412",
  },
  {
    text: "Practice does not make perfect. Only perfect practice makes perfect.",
    source: "Vince Lombardi",
    color: "#14532d",
  },
  {
    text: "The roots of education are bitter, but the fruit is sweet.",
    source: "Aristotle",
    color: "#9f1239",
  },
  {
    text: "Nothing in the world is worth having or worth doing unless it means effort, pain, difficulty.",
    source: "Theodore Roosevelt",
    color: "#1e3a5f",
  },
];

export function dashboardQuoteWeekIndex(now: Date = new Date()): number {
  const elapsed = now.getTime() - new Date(DASHBOARD_QUOTE_EPOCH).getTime();
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / WEEK_MS);
}

export function dashboardQuoteForDate(now: Date = new Date()): DashboardQuote {
  const index = dashboardQuoteWeekIndex(now) % DASHBOARD_QUOTES.length;
  return DASHBOARD_QUOTES[index] || DASHBOARD_QUOTES[0];
}
