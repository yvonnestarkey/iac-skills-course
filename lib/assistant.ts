// Course assistant knowledge base, ported verbatim from the static prototype.
import { chapterCode, gradedLessons, allLessons, shortLessonTitle } from "./course";
import type { ChatEntry, CourseData } from "./types";

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer?: string[];
  dynamic?: string;
  lessonId?: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "procrastination",
    keywords: [
      "procrastinate",
      "procrastination",
      "putting it off",
      "put it off",
      "cannot start",
      "can't start",
      "avoiding",
      "motivation",
      "motivated",
      "lazy",
      "overwhelmed",
      "keep delaying",
      "leave it late",
      "last minute",
    ],
    lessonId: "c3l1",
    answer: [
      "Procrastination on this course is almost always a sizing problem, not a discipline problem. \"Do Chapter 2\" is too big to start; \"post the first three journal entries\" is not.",
      "Try this: open the assignment, set a timer for fifteen minutes, and do only the first sub-task. Accounting work rewards this because each piece is discrete — one journal entry, one ratio, one note. You are allowed to stop when the timer goes.",
      "The second habit that helps is submitting unfinished work on time rather than finished work late. A trial balance that does not balance still earns feedback, and the difference itself tells your coach where the misunderstanding is.",
    ],
  },
  {
    id: "communication",
    keywords: [
      "communication",
      "communicate",
      "explain",
      "explaining",
      "write up",
      "write-up",
      "writing",
      "wording",
      "phrase",
      "how do i ask",
      "asking questions",
      "talk to",
      "email",
      "speak",
      "presentation",
      "interpretation comment",
    ],
    lessonId: "c3l1",
    answer: [
      "In accounting, better communication usually means less padding and more structure. For any written comment, use three beats: what the figure did, why it likely did that in this business, and what it means for the person reading the accounts.",
      "When you ask a question — here or in Ask the Coach — include three things: what you were trying to do, what you actually got, and the specific line you are stuck on. That turns a vague \"I don't understand receivables\" into something your coach can answer in one reply.",
      "Label your workings in submitted work for the same reason. A marker or coach can only credit reasoning they can follow, so a labelled schedule communicates more than a tidy final answer.",
    ],
  },
  {
    id: "double-entry",
    keywords: [
      "debit",
      "credit",
      "double entry",
      "journal",
      "journal entry",
      "posting",
      "post a transaction",
      "which side",
      "mnemonic",
    ],
    lessonId: "c1l1",
    answer: [
      "Drop the mnemonic and ask two questions of every transaction: what did the business receive, and what did it give up? Name both, then place each side.",
      "That method holds when a transaction touches three or four accounts, which is exactly where rhymes fall apart. Post the cash side last so it acts as your check rather than your starting assumption.",
    ],
  },
  {
    id: "trial-balance",
    keywords: ["trial balance", "tb", "balanced but wrong", "suspense", "compensating error", "omission"],
    lessonId: "c1l2",
    answer: [
      "A trial balance that agrees only proves debits equal credits. Compensating errors, reversed entries, and complete omissions all survive that test.",
      "Read down each line and ask whether the balance sits on the side you would expect for that type of account. A credit balance sitting in receivables is not automatically wrong, but it always deserves a note.",
    ],
  },
  {
    id: "not-balancing",
    keywords: [
      "does not balance",
      "doesn't balance",
      "not balancing",
      "out by",
      "difference",
      "balance sheet wrong",
      "financial position wrong",
    ],
    lessonId: "c2l2",
    answer: [
      "The size of your difference is evidence. If it divides by nine, suspect transposed digits. If it is exactly twice a figure in your workings, you have posted a debit as a credit somewhere.",
      "Check in this order: the suspense account, the adjustment you made most recently, then the transfer of profit for the year. It is usually the last thing you touched.",
    ],
  },
  {
    id: "adjustments",
    keywords: [
      "accrual",
      "accruals",
      "prepayment",
      "prepaid",
      "depreciation",
      "irrecoverable",
      "bad debt",
      "year end adjustment",
      "adjustments",
    ],
    lessonId: "c2l1",
    answer: [
      "Date the adjustment before you post it. If you can say which period the expense belongs to, you can place it; if you cannot date it, you cannot accrue it.",
      "Depreciation follows the stated policy rather than instinct — read the policy line in the question and apply it exactly, even when it produces an awkward figure.",
    ],
  },
  {
    id: "ratios",
    keywords: ["ratio", "ratios", "interpretation", "analysis", "gross margin", "liquidity", "gearing", "comment on"],
    lessonId: "c3l1",
    answer: [
      "Calculate only the ratios the question implies, then comment on each. A ratio with no comment earns the calculation mark and nothing more.",
      "Three sentences per ratio is usually enough: the movement, the likely cause in this specific business, and the consequence for the user of the accounts.",
    ],
  },
  {
    id: "exam-technique",
    keywords: ["marks", "marking", "mark scheme", "exam", "revision", "revise", "timed", "run out of time", "technique"],
    lessonId: "c3l2",
    answer: [
      "Method marks survive a wrong answer, which is the most useful thing to know walking into a paper. An incorrect figure carried consistently through correct method still earns most of the credit.",
      "So show and label your working, and cross out rather than erase. If you are running out of time before the last question, start attempting parts in the order marks are densest instead of finishing perfectly in sequence.",
    ],
  },
  {
    id: "uploads",
    keywords: ["upload", "pdf", "scan", "scanned", "attach", "file", "handwritten", "photo of my work"],
    answer: [
      "Each chapter has a PDF upload lesson in the sidebar. Open it, choose your PDF, and it appears with the filename and time so you know it landed.",
      "Handwritten and scanned is fine — include your workings pages, because that is where most feedback lands. If your scan crops a column, upload the corrected page again; the newer file replaces the old one.",
    ],
  },
  {
    id: "deadlines",
    keywords: ["due", "deadline", "when is", "due date", "overdue", "late", "submit by"],
    dynamic: "deadlines",
  },
  {
    id: "coach",
    keywords: ["speak to yvonne", "talk to my coach", "human", "real person", "ask the coach", "escalate"],
    answer: [
      "You can send this to Yvonne directly. Use the escalate button below, or open the Ask the Coach lesson in any chapter — both land in the same thread, and she sees it under Questions waiting.",
    ],
  },
];

function deadlineAnswer(data: CourseData) {
  const lines = gradedLessons(data).map(
    (l) => `${chapterCode(l.chapter)} — ${shortLessonTitle(l)}: due ${l.due}`
  );
  return ["Here is everything currently set, in order:", lines.join("\n"), "Nothing is closed off — send late work anyway and Yvonne will still mark it."];
}

function scoreEntry(query: string, keywords: string[]) {
  let score = 0;
  keywords.forEach((keyword) => {
    if (query.includes(keyword)) score += keyword.includes(" ") ? 3 : 2;
  });
  return score;
}

function searchLessons(data: CourseData, query: string) {
  const words = query.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (!words.length) return null;
  let best = null;
  allLessons(data)
    .filter((l) => l.body || l.blurb)
    .forEach((lesson) => {
      const haystack = [lesson.title, lesson.blurb || "", ...(lesson.body || []), ...(lesson.takeaways || [])]
        .join(" ")
        .toLowerCase();
      const score = words.reduce((sum, word) => (haystack.includes(word) ? sum + 1 : sum), 0);
      if (score && (!best || score > best.score)) best = { lesson, score };
    });
  return best && best.score >= 2 ? best : null;
}

export function botReply(data: CourseData, rawQuery: string): ChatEntry {
  const query = rawQuery.toLowerCase();
  let best = null;
  KNOWLEDGE.forEach((entry) => {
    const score = scoreEntry(query, entry.keywords);
    if (score && (!best || score > best.score)) best = { entry, score };
  });

  if (best) {
    const entry = best.entry;
    const paragraphs = entry.dynamic === "deadlines" ? deadlineAnswer(data) : entry.answer;
    return {
      from: "bot",
      paragraphs,
      lessonId: entry.lessonId,
      offerEscalate: entry.id === "coach" || entry.id === "procrastination" || entry.id === "communication",
    };
  }

  const hit = searchLessons(data, query);
  if (hit) {
    const lesson = hit.lesson;
    return {
      from: "bot",
      paragraphs: [
        `The closest material is ${lesson.title}. ${lesson.blurb || ""}`.trim(),
        lesson.takeaways && lesson.takeaways.length
          ? `Key points: ${lesson.takeaways.join("; ")}.`
          : "Open the lesson and the detail is in the body text.",
      ],
      lessonId: lesson.id,
      offerEscalate: true,
    };
  }

  return {
    from: "bot",
    paragraphs: [
      "I could not find that in the course material, so I would rather not guess at it.",
      "Send it to Yvonne and she will answer in your Ask the Coach thread.",
    ],
    offerEscalate: true,
    unknown: true,
  };
}
