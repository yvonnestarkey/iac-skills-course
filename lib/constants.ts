// Lesson icons, planner slots, survey scale — ported from the prototype.
export const ICONS: Record<string, string> = {
  video: "▶",
  reading: "▤",
  assignment: "✎",
  upload: "⬆",
  ask: "✳",
  survey: "★",
};

export const STARTER_PROMPTS = ["I'm struggling with procrastination", "How do I fix my communication?"];

export const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

export const PERIODS = [
  { id: "morning", label: "morning" },
  { id: "evening", label: "evening" },
];

export const DEFAULT_PLAN = { hours: 5, slots: ["tue-evening", "thu-evening", "sat-morning"] };

export const SLOT_TIMES: Record<string, number[]> = { morning: [9, 0], evening: [18, 30] };

export const SURVEY_QUESTIONS = [
  { id: "clarity", label: "How clear was this chapter?" },
  { id: "pace", label: "Was the pace right for you?" },
  { id: "confidence", label: "How confident do you feel on this material now?" },
  { id: "support", label: "How well supported did you feel by your coach?" },
];

export const SCALE = ["1 — poor", "2", "3", "4", "5 — excellent"];

/** Where a student lands after signing in, and the coach's default assignment. */
export const DEFAULT_LESSON_ID = "c2l1";
export const DEFAULT_ASSIGNMENT_ID = "c2l3";
