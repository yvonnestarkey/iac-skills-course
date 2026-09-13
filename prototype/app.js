const STORAGE_KEY = "accounting-study-advice-v1";
const MAX_INLINE_BYTES = 3_000_000;

const SEED = {
  company: "Accounting Study Advice",
  className: "IAC Skills Course",
  term: "Autumn cohort · 6 weeks",
  cohorts: [
    { id: "autumn26", name: "Autumn 2026", starts: "Sep 2026", current: true },
    { id: "summer26", name: "Summer 2026", starts: "Jun 2026" },
  ],
  liveSessions: [
    {
      id: "live1",
      title: "Cohort Q&A · double entry and trial balances",
      date: shiftISO(3),
      time: "19:00",
      minutes: 60,
      zoom: "https://zoom.us/j/98765432101?pwd=iacskills",
    },
    {
      id: "live2",
      title: "Statements clinic · bring your workings",
      date: shiftISO(10),
      time: "19:00",
      minutes: 90,
      zoom: "https://zoom.us/j/98765432102?pwd=iacskills",
    },
    {
      id: "live3",
      title: "Mock debrief and interpretation practice",
      date: shiftISO(17),
      time: "19:00",
      minutes: 60,
      zoom: "https://zoom.us/j/98765432103?pwd=iacskills",
    },
  ],
  chapters: [
    {
      id: "ch1",
      title: "Chapter 1 · Foundations and double entry",
      summary: "Get the mechanics solid before the statements arrive.",
      lessons: [
        {
          id: "c1l1",
          type: "video",
          title: "Debits and credits without the mnemonics",
          duration: "8:24",
          seconds: 504,
          blurb:
            "Why the tricks you were taught at school stop working, and the one question to ask of every transaction instead.",
          body: [
            "Most students arrive with a rhyme for debits and credits, and most of those rhymes fail the moment a transaction touches more than two accounts. The reliable habit is slower and duller: name what the business received, name what it gave up, then place each side.",
            "In the worked example we post a part-exchange of a vehicle. Four accounts move. If you are relying on a mnemonic you will get two of them right and guess the rest, which is exactly how marks disappear in a mixed question.",
          ],
          takeaways: [
            "Name what was received and what was given up, every time",
            "Mnemonics break on three-or-more-account transactions",
            "Post the cash side last, not first",
          ],
        },
        {
          id: "c1l2",
          type: "reading",
          title: "Reading a trial balance line by line",
          duration: "6 min read",
          blurb: "A trial balance that adds up can still be wrong. Here is what to check.",
          body: [
            "A balanced trial balance only proves that debits equal credits. It says nothing about whether an item sits in the right place. Compensating errors, reversed entries, and omissions all survive the check.",
            "Work down the list and ask of each line: is this a real account or a nominal one, and would I expect this balance on this side? A credit balance in a receivables account is not fatal, but it always deserves a note.",
            "Build the habit of annotating as you read. In the exam you will not have time to form an opinion twice.",
          ],
          takeaways: [
            "Balanced does not mean correct",
            "Check each balance is on the side you would expect",
            "Annotate as you read, once",
          ],
        },
        {
          id: "c1l3",
          type: "assignment",
          title: "Assignment · Journal entries walkthrough",
          due: "Wednesday 17 Sep",
          brief:
            "Post the eight transactions from the lesson notes as journal entries. Type them here in the format Dr / Cr / amount, with a one-line narrative for each. Working is more useful to me than a tidy answer.",
        },
        {
          id: "c1l4",
          type: "upload",
          title: "Upload · Worked trial balance (PDF)",
          due: "Friday 19 Sep",
          brief:
            "Prepare your trial balance from the Chapter 1 data set and upload it as a single PDF. Handwritten and scanned is fine — I mark the working, not the presentation. I will return notes in your Ask the Coach thread.",
        },
        {
          id: "c1l5",
          type: "ask",
          title: "Ask the Coach",
          blurb: "If a posting will not balance, send me the entry before you spend an evening on it.",
        },
        {
          id: "c1l6",
          type: "survey",
          title: "Module survey · Chapter 1",
          blurb: "Two minutes of feedback so the next cohort gets a better chapter than you did.",
        },
      ],
    },
    {
      id: "ch2",
      title: "Chapter 2 · Financial statements that reconcile",
      summary: "From trial balance to a statement set that holds together.",
      lessons: [
        {
          id: "c2l1",
          type: "video",
          title: "From trial balance to statement of profit or loss",
          duration: "11:02",
          seconds: 662,
          blurb:
            "A full walkthrough with adjustments: accruals, prepayments, depreciation, and an irrecoverable debt.",
          body: [
            "We take one trial balance and build the statement of profit or loss in the order the marks are awarded. Revenue first, then cost of sales, then the adjustments that examiners plant deliberately.",
            "The adjustment students most often mishandle is the accrual that spans the year end. Watch the timeline drawn at the six-minute mark: if you can date the expense, you can place it, and if you cannot date it, you cannot accrue it.",
          ],
          takeaways: [
            "Build in the order marks are awarded",
            "Date every adjustment before you post it",
            "Depreciation follows policy, not instinct",
          ],
        },
        {
          id: "c2l2",
          type: "video",
          title: "Where the balance sheet stops balancing",
          duration: "6:47",
          seconds: 407,
          blurb: "Six common breaks, and the order to check them in when you are short on time.",
          body: [
            "When a statement of financial position does not balance, the difference itself is evidence. A difference divisible by nine often means transposed digits. A difference exactly twice a figure in your working means you posted a debit as a credit.",
            "Check in this order: the suspense account, the adjustments you made last, then the transfer of profit for the year. Nine times out of ten it is the last thing you touched.",
          ],
          takeaways: [
            "The size of the difference tells you the error type",
            "Divisible by nine suggests transposition",
            "Re-check the last adjustment you made first",
          ],
        },
        {
          id: "c2l3",
          type: "assignment",
          title: "Assignment · Draft statement of financial position",
          due: "Sunday 21 Sep",
          brief:
            "Type your statement of financial position from the Chapter 2 data, plus two or three lines on any figure you were unsure about. Send it even if it does not balance — the difference tells us both something.",
        },
        {
          id: "c2l4",
          type: "upload",
          title: "Upload · Full statement set (PDF)",
          due: "Tuesday 23 Sep",
          brief:
            "Upload your complete statement set as one PDF: profit or loss, financial position, and your workings schedule. Include the workings — most of my feedback lands there.",
        },
        {
          id: "c2l5",
          type: "ask",
          title: "Ask the Coach",
          blurb: "Send me the figure you keep recalculating. That is usually where the misunderstanding sits.",
        },
        {
          id: "c2l6",
          type: "survey",
          title: "Module survey · Chapter 2",
          blurb: "Tell me whether the statement walkthroughs were the right speed.",
        },
      ],
    },
    {
      id: "ch3",
      title: "Chapter 3 · Interpretation and exam technique",
      summary: "Turn correct numbers into marks under time pressure.",
      lessons: [
        {
          id: "c3l1",
          type: "video",
          title: "Ratio analysis under time pressure",
          duration: "9:15",
          seconds: 555,
          blurb: "Which ratios to calculate first, and how to comment without padding.",
          body: [
            "You will rarely have time for every ratio. Calculate the three the question implies, then comment on movement and cause. A ratio with no comment earns the calculation mark and nothing else.",
            "The phrasing that scores is plain: the figure moved, here is the likely cause in this business, here is what it means for the user of the accounts. Three sentences per ratio is usually enough.",
          ],
          takeaways: [
            "Calculate only the ratios the question implies",
            "Every ratio needs a cause and a consequence",
            "Three sentences per ratio, then move on",
          ],
        },
        {
          id: "c3l2",
          type: "reading",
          title: "Marking schemes: where marks are actually awarded",
          duration: "5 min read",
          blurb: "Read two real schemes and see how much credit sits in the working.",
          body: [
            "Method marks survive a wrong answer. That is the single most valuable thing to know going into a written paper: an incorrect figure carried consistently through a correct method still earns most of the marks.",
            "So show the working, label it, and never erase a line you have replaced. Cross it out lightly instead. Markers cannot award credit for reasoning they cannot see.",
          ],
          takeaways: [
            "Method marks survive a wrong final answer",
            "Label your workings so they can be followed",
            "Cross out, never erase",
          ],
        },
        {
          id: "c3l3",
          type: "assignment",
          title: "Assignment · Interpretation write-up",
          due: "Sunday 28 Sep",
          brief:
            "Type a short interpretation of the Chapter 3 accounts: four ratios, movement, likely cause, and what it means for a lender. Aim for around 400 words.",
        },
        {
          id: "c3l4",
          type: "upload",
          title: "Upload · Timed mock attempt (PDF)",
          due: "Wednesday 1 Oct",
          brief:
            "Sit the mock in one timed sitting, then scan or export the whole attempt as a single PDF and upload it here. Do not tidy it up afterwards — I need to see what you produced in the time available.",
        },
        {
          id: "c3l5",
          type: "ask",
          title: "Ask the Coach",
          blurb: "Bring your mock timings here if you are running out of time before the last question.",
        },
        {
          id: "c3l6",
          type: "survey",
          title: "Module survey · Chapter 3",
          blurb: "Last one. Did the exam technique material change how you sit a paper?",
        },
      ],
    },
  ],
  students: [
    {
      id: "maya",
      name: "Maya Chen",
      email: "maya@example.com",
      cohort: "autumn26",
      status: "active",
      joined: "1 Sep 2026",
      lastActive: shiftISO(-1),
      surveys: {
        c1l6: { clarity: 5, pace: 4, confidence: 4, support: 5, comment: "The part-exchange example was the moment it clicked. More of those." },
        c2l6: { clarity: 4, pace: 3, confidence: 4, support: 5, comment: "Adjustments went quickly. I rewatched the accruals section twice." },
      },
      notes: [
        {
          text: "Strong on mechanics, rushes interpretation. Push her to write fewer, better sentences.",
          at: "4 Sep 2026",
        },
      ],
      completed: ["c1l1", "c1l2", "c2l1", "c2l2"],
      submissions: {
        c1l3:
          "1. Dr Motor vehicles 14,200 / Cr Bank 14,200 — purchase of delivery van.\n2. Dr Bank 3,100 / Cr Motor vehicles 3,100 — part exchange of old van at agreed value.\n3. Dr Loss on disposal 640 / Cr Motor vehicles 640 — carrying amount above trade-in value.",
        c2l3:
          "Statement of financial position does balance, but I was unsure about the accrued electricity — I dated it to the invoice rather than the period, so it may sit in the wrong year. Non-current assets 68,400. Net current assets 12,150.",
      },
      uploads: {
        c1l4: {
          name: "maya-trial-balance-ch1.pdf",
          size: 486_233,
          at: "Friday",
          legacy: true,
        },
      },
    },
    {
      id: "jordan",
      name: "Jordan Patel",
      email: "jordan@example.com",
      cohort: "autumn26",
      status: "active",
      joined: "1 Sep 2026",
      lastActive: shiftISO(-9),
      surveys: {},
      notes: [
        {
          text: "Went quiet after week one. Two nudges sent, no reply yet. Try a phone call before the Chapter 2 deadline.",
          at: "9 Sep 2026",
        },
      ],
      completed: ["c1l1"],
      submissions: {},
      uploads: {},
      plan: {
        startDate: shiftISO(-16),
        hours: 5,
        slots: ["tue-evening", "thu-evening", "sat-morning"],
        makeups: [],
      },
    },
    {
      id: "alex",
      name: "Alex Rivera",
      email: "alex@example.com",
      cohort: "autumn26",
      status: "active",
      joined: "1 Sep 2026",
      lastActive: shiftISO(-2),
      surveys: {
        c1l6: { clarity: 4, pace: 5, confidence: 3, support: 4, comment: "Pace suited me. I still find the disposal entries slippery." },
      },
      notes: [],
      completed: ["c1l1", "c1l2", "c2l1"],
      submissions: {
        c1l3:
          "Posted all eight. Numbers 5 and 6 I am least sure of — I treated the settlement discount as a reduction in revenue rather than an expense, which I think is right but I could not find it in the notes.",
      },
      uploads: {
        c1l4: {
          name: "alex-tb-scan.pdf",
          size: 1_204_882,
          at: "Thursday",
          legacy: true,
        },
      },
    },
    {
      id: "sam",
      name: "Sam Okonkwo",
      email: "sam@example.com",
      cohort: "autumn26",
      status: "active",
      joined: "1 Sep 2026",
      lastActive: shiftISO(-4),
      surveys: {
        c1l6: { clarity: 3, pace: 2, confidence: 2, support: 4, comment: "Too fast for me. I needed a slower version of the four-account example." },
      },
      notes: [
        { text: "Asked for slower material in the survey. Send the extended double-entry walkthrough.", at: "8 Sep 2026" },
      ],
      completed: ["c1l1", "c1l2"],
      submissions: {
        c1l3: "Got through six of the eight. The part-exchange one defeated me — four accounts and I could only place three.",
      },
      uploads: {},
    },
    {
      id: "priya",
      name: "Priya Nair",
      email: "priya@example.com",
      cohort: "autumn26",
      status: "active",
      joined: "1 Sep 2026",
      lastActive: shiftISO(0),
      surveys: {
        c1l6: { clarity: 5, pace: 4, confidence: 5, support: 5, comment: "Clear and well sequenced. The annotation habit stuck." },
        c2l6: { clarity: 4, pace: 4, confidence: 3, support: 5, comment: "I need more practice on the balancing errors before the mock." },
        c3l6: { clarity: 5, pace: 5, confidence: 4, support: 5, comment: "Mark scheme reading changed how I lay out working. Wish it came in week one." },
      },
      notes: [],
      completed: ["c1l1", "c1l2", "c2l1", "c2l2", "c3l1"],
      plan: {
        startDate: shiftISO(-12),
        hours: 6,
        slots: ["mon-evening", "wed-evening", "sun-morning"],
        makeups: [],
      },
      submissions: {
        c1l3: "All eight posted with narratives. Checked the totals twice and they agree.",
        c2l3:
          "Mine is out by 1,890. I know that is twice the 945 depreciation charge, so I think I have posted the charge as a credit somewhere, but I could not find it before the deadline.",
      },
      uploads: {
        c1l4: { name: "priya-trial-balance.pdf", size: 322_901, at: "Wednesday", legacy: true },
        c2l4: { name: "priya-statements-ch2.pdf", size: 902_144, at: "Yesterday", legacy: true },
      },
    },
    {
      id: "dele",
      name: "Dele Adeyemi",
      email: "dele@example.com",
      cohort: "summer26",
      status: "active",
      joined: "2 Jun 2026",
      lastActive: shiftISO(-3),
      completed: ["c1l1", "c1l2", "c2l1", "c2l2", "c3l1", "c3l2"],
      surveys: {
        c1l6: { clarity: 5, pace: 4, confidence: 5, support: 4, comment: "Best explanation of double entry I have had." },
        c2l6: { clarity: 5, pace: 4, confidence: 4, support: 4, comment: "The divisible-by-nine trick saved me in the mock." },
        c3l6: { clarity: 4, pace: 4, confidence: 4, support: 4, comment: "Would like a second mock paper." },
      },
      notes: [{ text: "Ready for the exam. Offer the advanced interpretation set.", at: "1 Sep 2026" }],
      submissions: {
        c1l3: "All eight posted, totals agree.",
        c2l3: "Balances. Non-current assets 71,300, net current assets 9,480.",
        c3l3:
          "Gross margin down 2.1 points on a rising revenue line, which points to discounting rather than cost inflation. For a lender the interest cover figure matters more here, and at 3.4 times it is adequate but thinning.",
      },
      uploads: {
        c1l4: { name: "dele-tb.pdf", size: 410_223, at: "12 Jun", legacy: true },
        c2l4: { name: "dele-statements.pdf", size: 860_110, at: "26 Jun", legacy: true },
        c3l4: { name: "dele-mock-attempt.pdf", size: 1_640_882, at: "10 Jul", legacy: true },
      },
    },
    {
      id: "hana",
      name: "Hana Suzuki",
      email: "hana@example.com",
      cohort: "summer26",
      status: "active",
      joined: "2 Jun 2026",
      lastActive: shiftISO(-6),
      completed: ["c1l1", "c1l2", "c2l1", "c2l2"],
      surveys: {
        c1l6: { clarity: 4, pace: 3, confidence: 3, support: 5, comment: "Good, but I wanted more worked examples before the assignment." },
        c2l6: { clarity: 3, pace: 2, confidence: 3, support: 4, comment: "Chapter 2 felt like two chapters. The adjustments deserve their own module." },
      },
      notes: [],
      submissions: {
        c1l3: "Posted seven of eight. Missed the settlement discount.",
        c2l3: "Out by 450, which I think is the prepayment.",
      },
      uploads: { c1l4: { name: "hana-tb.pdf", size: 372_004, at: "14 Jun", legacy: true } },
    },
    {
      id: "tomas",
      name: "Tomás Duarte",
      email: "tomas@example.com",
      cohort: "summer26",
      status: "paused",
      joined: "2 Jun 2026",
      lastActive: shiftISO(-48),
      completed: ["c1l1"],
      surveys: {},
      notes: [{ text: "Paused for work commitments, returning for the Autumn cohort. Keep on roster, exclude from chasing.", at: "20 Jul 2026" }],
      submissions: {},
      uploads: {},
    },
  ],
  messages: {
    maya: [
      {
        from: "coach",
        text: "Trial balance is clean. On the part-exchange, check the disposal account — your loss is right but it is sitting in the wrong statement.",
        at: "Yesterday",
        context: "Chapter 1 · Upload",
      },
    ],
    jordan: [],
    alex: [
      {
        from: "coach",
        text: "Settlement discount treatment is correct. Your scan cuts off the right-hand column on page 2 — resend that page when you can.",
        at: "Yesterday",
        context: "Chapter 1 · Upload",
      },
    ],
    sam: [],
    dele: [],
    hana: [
      {
        from: "student",
        kind: "question",
        text: "Is the prepayment meant to reduce the expense in the year, or move it to the following year entirely?",
        at: "Last week",
        context: "Chapter 2 · Ask the Coach",
      },
    ],
    tomas: [],
    priya: [
      {
        from: "student",
        kind: "question",
        text: "My statement of financial position is out by exactly twice the depreciation charge. Should I post a suspense entry to balance it, or leave it out and show the difference?",
        at: "This morning",
        context: "Chapter 2 · Ask the Coach",
      },
    ],
  },
  chats: {},
};

const ICONS = {
  video: "▶",
  reading: "▤",
  assignment: "✎",
  upload: "⬆",
  ask: "✳",
  survey: "★",
};

const STARTER_PROMPTS = ["I'm struggling with procrastination", "How do I fix my communication?"];

const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const PERIODS = [
  { id: "morning", label: "morning" },
  { id: "evening", label: "evening" },
];

const DEFAULT_PLAN = { hours: 5, slots: ["tue-evening", "thu-evening", "sat-morning"] };

const SLOT_TIMES = { morning: [9, 0], evening: [18, 30] };

const SURVEY_QUESTIONS = [
  { id: "clarity", label: "How clear was this chapter?" },
  { id: "pace", label: "Was the pace right for you?" },
  { id: "confidence", label: "How confident do you feel on this material now?" },
  { id: "support", label: "How well supported did you feel by your coach?" },
];

const SCALE = ["1 — poor", "2", "3", "4", "5 — excellent"];

const KNOWLEDGE = [
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

const widget = {
  open: false,
  pending: "",
};

const sessionFiles = {};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(SEED);
    const parsed = JSON.parse(raw);
    if (!parsed.chapters) return structuredClone(SEED);
    parsed.chats = parsed.chats || {};
    return parsed;
  } catch {
    return structuredClone(SEED);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    return true;
  } catch {
    return false;
  }
}

const state = {
  data: load(),
  session: null,
  activeLessonId: "c2l1",
  coachAssignmentId: "c2l3",
  filter: "all",
  notice: "",
  planner: false,
  planDraft: null,
  adjust: false,
  modal: null,
  cohort: "autumn26",
  coachTab: "assignments",
  profileId: null,
};

const player = { lessonId: null, elapsed: 0, playing: false, timer: null };

function stopPlayer() {
  if (player.timer) clearInterval(player.timer);
  player.timer = null;
  player.playing = false;
}

function allLessons() {
  return state.data.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
}

function gradedLessons() {
  return allLessons().filter((l) => l.type === "assignment" || l.type === "upload");
}

function findLesson(id) {
  return allLessons().find((l) => l.id === id) || allLessons()[0];
}

function me() {
  return state.data.students.find((s) => s.id === state.session.id);
}

function textFor(student, lessonId) {
  return (student.submissions && student.submissions[lessonId]) || "";
}

function fileFor(student, lessonId) {
  return (student.uploads && student.uploads[lessonId]) || null;
}

function hasWork(student, lesson) {
  if (lesson.type === "upload") return Boolean(fileFor(student, lesson.id));
  return Boolean(textFor(student, lesson.id).trim());
}

function thread(id) {
  return state.data.messages[id] || [];
}

function unansweredQuestion(id) {
  let pending = null;
  for (const message of thread(id)) {
    if (message.from === "student" && message.kind === "question") pending = message;
    if (message.from === "coach") pending = null;
  }
  return pending;
}

function waitingQuestions() {
  return state.data.students.filter((s) => unansweredQuestion(s.id));
}

function progressFor(student) {
  const teaching = allLessons().filter((l) => l.type === "video" || l.type === "reading");
  const done = teaching.filter((l) => (student.completed || []).includes(l.id)).length;
  return { done, total: teaching.length, pct: Math.round((done / teaching.length) * 100) };
}

function chapterCode(chapter) {
  return chapter.title.split(" · ")[0];
}

function nowLabel() {
  return "Just now";
}

function formatTime(total) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileHref(studentId, lessonId, file) {
  if (file.dataUrl) return file.dataUrl;
  return sessionFiles[`${studentId}:${lessonId}`] || "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  stopPlayer();
  const app = document.getElementById("app");
  if (!state.session) {
    app.innerHTML = loginView();
    bindLogin();
    renderWidget();
    renderModal();
    return;
  }
  if (state.session.role === "coach") {
    app.innerHTML = topbar() + `<div class="shell coach-shell">${coachView()}</div>`;
    bindTopbar();
    bindCoach();
    renderWidget();
    renderModal();
    return;
  }
  const main = state.planner ? plannerView() : lessonView();
  app.innerHTML =
    topbar() + `<div class="shell"><aside class="sidebar">${sidebar()}</aside><main class="main">${main}</main></div>`;
  bindTopbar();
  bindSidebar();
  if (state.planner) bindPlanner();
  else bindLesson();
  renderWidget();
  renderModal();
}

function topbar() {
  const options = [
    ...state.data.students.map(
      (s) =>
        `<option value="${s.id}" ${state.session.id === s.id ? "selected" : ""}>Student · ${escapeHtml(s.name)}</option>`
    ),
    `<option value="coach" ${state.session.role === "coach" ? "selected" : ""}>Coach · Yvonne</option>`,
  ].join("");
  const waiting = waitingQuestions().length;
  return `
    <header class="topbar">
      <div class="mark">
        <span class="dot"></span>
        <div>
          <strong>${escapeHtml(state.data.company)}</strong>
          <span class="muted">${escapeHtml(state.data.className)}</span>
        </div>
      </div>
      <div class="topbar-right">
        ${state.session.role === "coach" && waiting ? `<span class="pill">${waiting} waiting</span>` : ""}
        <label class="role-chip">View as
          <select id="role">${options}</select>
        </label>
      </div>
    </header>
  `;
}

function loginView() {
  const people = state.data.students
    .map((s) => {
      const p = progressFor(s);
      return `<button data-student="${s.id}"><strong>${escapeHtml(s.name)}</strong><span class="muted">${p.done}/${p.total} lessons</span></button>`;
    })
    .join("");
  return `
    <section class="card login">
      <h1 class="brand">${escapeHtml(SEED.company)}</h1>
      <p class="muted">${escapeHtml(SEED.className)} · ${escapeHtml(SEED.term)}</p>
      <h3 style="margin-top:22px">Enter as a student</h3>
      <div class="people">${people}</div>
      <div class="actions">
        <button class="ghost" id="as-coach">Coach view</button>
        <button class="ghost" id="reset">Reset demo data</button>
      </div>
    </section>
  `;
}

function sidebar() {
  const student = me();
  const p = progressFor(student);
  const chapters = state.data.chapters
    .map((chapter) => {
      const lessons = chapter.lessons
        .map((lesson) => {
          const active = lesson.id === state.activeLessonId;
          const done = (student.completed || []).includes(lesson.id);
          let meta = lesson.duration || "";
          if (lesson.type === "assignment") {
            meta = textFor(student, lesson.id).trim() ? "Submitted" : "Not submitted";
          }
          if (lesson.type === "upload") {
            const file = fileFor(student, lesson.id);
            meta = file ? "PDF uploaded" : "No PDF yet";
          }
          if (lesson.type === "ask") {
            meta = unansweredQuestion(student.id) ? "Waiting for coach" : "Open a question";
          }
          if (lesson.type === "survey") {
            meta = surveyFor(student, lesson.id) ? "Feedback sent" : "Give feedback";
          }
          return `
            <button class="lesson-link ${active ? "active" : ""} ${lesson.type}" data-lesson="${lesson.id}">
              <span class="icon">${done ? "✓" : ICONS[lesson.type]}</span>
              <span class="label">
                <span class="lesson-title">${escapeHtml(lesson.title)}</span>
                <span class="lesson-meta">${escapeHtml(meta)}</span>
              </span>
            </button>
          `;
        })
        .join("");
      return `
        <section class="chapter">
          <h3>${escapeHtml(chapter.title)}</h3>
          <p class="chapter-summary">${escapeHtml(chapter.summary)}</p>
          ${lessons}
        </section>
      `;
    })
    .join("");
  const plan = student.plan;
  const status = plan ? planStatus(student) : null;
  let planLine = "Tell us when you can study and we will date the whole course for you.";
  if (plan && status) {
    planLine = `${plan.hours} h a week · ${plan.slots.length} session${plan.slots.length === 1 ? "" : "s"}`;
    planLine += status.finish ? ` · finishes ${longDate(status.finish)}` : " · course complete";
    if (status.overdue.length) planLine += ` · ${status.overdue.length} behind`;
  }
  return `
    <div class="course-head">
      <h2>Course modules</h2>
      <p class="muted">${escapeHtml(state.data.className)} · ${escapeHtml(state.data.term)}</p>
      <div class="bar"><span style="width:${p.pct}%"></span></div>
      <p class="muted small">${p.done} of ${p.total} lessons complete</p>
    </div>
    <div class="plan-card ${state.planner ? "active" : ""} ${status && status.overdue.length ? "warn" : ""}">
      <strong>Personalised study planner</strong>
      <p>${escapeHtml(planLine)}</p>
      <button data-planner>${plan ? "Update My Study Plan" : "Create My Study Plan"}</button>
    </div>
    ${chapters}
  `;
}

function lessonView() {
  const lesson = findLesson(state.activeLessonId);
  if (lesson.type === "assignment") return assignmentLesson(lesson);
  if (lesson.type === "upload") return uploadLesson(lesson);
  if (lesson.type === "ask") return askLesson(lesson);
  if (lesson.type === "survey") return surveyLesson(lesson);
  return teachingLesson(lesson);
}

function lessonHeader(lesson, kicker) {
  return `
    <p class="kicker">${escapeHtml(lesson.chapter.title)} · ${escapeHtml(kicker)}</p>
    <h1>${escapeHtml(lesson.title)}</h1>
  `;
}

function nextLessonButton(lesson) {
  const lessons = allLessons();
  const index = lessons.findIndex((l) => l.id === lesson.id);
  const next = lessons[index + 1];
  if (!next) return "";
  return `<button class="ghost" data-goto="${next.id}">Next: ${escapeHtml(next.title)} →</button>`;
}

function teachingLesson(lesson) {
  const student = me();
  const done = (student.completed || []).includes(lesson.id);
  const body = lesson.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const takeaways = (lesson.takeaways || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const stage =
    lesson.type === "video"
      ? `
      <div class="player" id="player">
        <div class="player-art">
          <button class="play" id="play" aria-label="Play lesson">▶</button>
          <span class="player-badge">Lesson video · ${escapeHtml(lesson.duration)}</span>
        </div>
        <div class="player-bar">
          <button class="play-small" id="play-small">▶</button>
          <div class="track" id="track"><span id="fill" style="width:0%"></span></div>
          <span class="time" id="time">0:00 / ${escapeHtml(lesson.duration)}</span>
        </div>
      </div>`
      : `<div class="reading-hero"><span>${escapeHtml(lesson.duration)}</span><p>${escapeHtml(lesson.blurb)}</p></div>`;
  return `
    ${stage}
    <article class="lesson-body">
      ${lessonHeader(lesson, lesson.type === "video" ? "Video lesson" : "Reading")}
      <p class="lead">${escapeHtml(lesson.blurb)}</p>
      ${body}
      ${takeaways ? `<div class="takeaways"><h3>Takeaways</h3><ul>${takeaways}</ul></div>` : ""}
      <div class="actions">
        <button class="${done ? "ghost" : "primary"}" id="complete">${done ? "Completed ✓" : "Mark as complete"}</button>
        ${nextLessonButton(lesson)}
      </div>
    </article>
  `;
}

function assignmentLesson(lesson) {
  const student = me();
  const current = textFor(student, lesson.id);
  const words = current.trim() ? current.trim().split(/\s+/).length : 0;
  return `
    <article class="lesson-body wide">
      ${lessonHeader(lesson, "Written assignment")}
      <p class="lead">Due ${escapeHtml(lesson.due)}</p>
      ${current ? `<div class="notice">Submitted. You can still update it before the deadline.</div>` : ""}
      <p>${escapeHtml(lesson.brief)}</p>
      <textarea id="draft" rows="12" placeholder="Type your working here…">${escapeHtml(current)}</textarea>
      <div class="wordcount">${words} words</div>
      <div class="actions">
        <button class="primary" id="submit">${current ? "Update submission" : "Submit assignment"}</button>
        ${nextLessonButton(lesson)}
      </div>
    </article>
  `;
}

function uploadLesson(lesson) {
  const student = me();
  const file = fileFor(student, lesson.id);
  const href = file ? fileHref(student.id, lesson.id, file) : "";
  const card = file
    ? `
      <div class="file-card">
        <span class="file-icon">PDF</span>
        <div class="file-meta">
          <strong>${escapeHtml(file.name)}</strong>
          <span class="muted small">${formatSize(file.size)} · uploaded ${escapeHtml(file.at)}</span>
        </div>
        ${
          href
            ? `<a class="ghost" href="${href}" target="_blank" rel="noopener">Open PDF</a>`
            : `<span class="muted small">Not viewable in this browser</span>`
        }
        <button class="ghost" id="remove-file">Remove</button>
      </div>`
    : "";
  return `
    <article class="lesson-body wide">
      ${lessonHeader(lesson, "PDF upload")}
      <p class="lead">Due ${escapeHtml(lesson.due)}</p>
      ${file ? `<div class="notice">PDF received. Upload a new file to replace it.</div>` : ""}
      ${state.notice ? `<div class="waiting">${escapeHtml(state.notice)}</div>` : ""}
      <p>${escapeHtml(lesson.brief)}</p>
      ${card}
      <label class="dropzone" for="pdf">
        <strong>${file ? "Replace your PDF" : "Choose a PDF to upload"}</strong>
        <span class="muted small">PDF only · up to about 3 MB · scans are fine</span>
        <input id="pdf" type="file" accept="application/pdf" />
      </label>
      <div class="actions">
        ${nextLessonButton(lesson)}
      </div>
    </article>
  `;
}

function askLesson(lesson) {
  const student = me();
  const pending = unansweredQuestion(student.id);
  const messages = thread(student.id)
    .map((m) => {
      const label = m.kind === "question" ? "You asked" : "Coach";
      return `
        <div class="bubble ${m.from} ${m.kind === "question" ? "question" : ""}">
          ${escapeHtml(m.text)}
          <div class="muted small">${escapeHtml(m.at)} · ${label}${m.context ? " · " + escapeHtml(m.context) : ""}</div>
        </div>`;
    })
    .join("");
  return `
    <article class="lesson-body wide">
      ${lessonHeader(lesson, "Ask the Coach")}
      <p class="lead">${escapeHtml(lesson.blurb)}</p>
      ${pending ? `<div class="waiting">Your question is waiting for the coach.</div>` : ""}
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      <textarea id="ask-text" rows="4" placeholder="What do you need help with?"></textarea>
      <div class="actions">
        <button class="primary" id="ask-coach">Ask the Coach</button>
      </div>
      <h3 style="margin-top:24px">Your thread</h3>
      <div class="thread">${messages || `<p class="empty">No questions yet.</p>`}</div>
    </article>
  `;
}

function surveyLesson(lesson) {
  const student = me();
  const existing = surveyFor(student, lesson.id);
  const rows = SURVEY_QUESTIONS.map((q) => {
    const current = existing ? existing[q.id] : 0;
    const options = SCALE.map((label, i) => {
      const value = i + 1;
      return `
        <label class="scale-opt ${current === value ? "on" : ""}">
          <input type="radio" name="q-${q.id}" value="${value}" ${current === value ? "checked" : ""} />
          <span>${escapeHtml(label)}</span>
        </label>`;
    }).join("");
    return `
      <div class="survey-q">
        <strong>${escapeHtml(q.label)}</strong>
        <div class="scale">${options}</div>
      </div>`;
  }).join("");
  return `
    <article class="lesson-body wide">
      ${lessonHeader(lesson, "Module survey")}
      <p class="lead">${escapeHtml(lesson.blurb)}</p>
      ${existing ? `<div class="notice">Thank you — your feedback is in. Submitting again replaces it.</div>` : ""}
      ${rows}
      <div class="plan-field">
        <label for="survey-comment"><strong>Anything else?</strong></label>
        <textarea id="survey-comment" rows="4" placeholder="What worked, what did not…">${escapeHtml(existing ? existing.comment || "" : "")}</textarea>
      </div>
      <div class="actions">
        <button class="primary" id="send-survey">${existing ? "Update my feedback" : "Send feedback"}</button>
        ${nextLessonButton(lesson)}
      </div>
    </article>
  `;
}

/* ---------- Coach / admin dashboard ---------- */

function cohortName(id) {
  const c = (state.data.cohorts || []).find((x) => x.id === id);
  return c ? c.name : "Unassigned";
}

function cohortStudents() {
  const all = state.data.students;
  if (state.cohort === "all") return all;
  return all.filter((s) => s.cohort === state.cohort);
}

function surveyFor(student, lessonId) {
  return (student.surveys && student.surveys[lessonId]) || null;
}

function surveyLessons() {
  return allLessons().filter((l) => l.type === "survey");
}

function surveyScore(answer) {
  const values = SURVEY_QUESTIONS.map((q) => answer[q.id]).filter((v) => typeof v === "number");
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function averageSurveyScore(students) {
  const scores = [];
  students.forEach((s) => {
    surveyLessons().forEach((l) => {
      const answer = surveyFor(s, l.id);
      const score = answer ? surveyScore(answer) : null;
      if (score !== null) scores.push(score);
    });
  });
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function overallProgress(student) {
  const tasks = courseTasks();
  const done = tasks.filter((t) => isDone(student, t.lesson)).length;
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
}

function pendingSubmissions(students) {
  let count = 0;
  students
    .filter((s) => s.status !== "paused")
    .forEach((s) => {
      gradedLessons().forEach((l) => {
        if (!hasWork(s, l)) count += 1;
      });
    });
  return count;
}

function submittedCount(student) {
  return gradedLessons().filter((l) => hasWork(student, l)).length;
}

function daysAgo(iso) {
  if (!iso) return null;
  return Math.round((today() - parseISO(iso)) / 86400000);
}

function lastActiveLabel(student) {
  const days = daysAgo(student.lastActive);
  if (days === null) return "unknown";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return longDate(parseISO(student.lastActive));
}

function coachView() {
  if (state.profileId) return profileView();

  const students = cohortStudents();
  const active = students.filter((s) => s.status !== "paused");
  const completion = students.length
    ? Math.round(students.reduce((sum, s) => sum + overallProgress(s).pct, 0) / students.length)
    : 0;
  const avgSurvey = averageSurveyScore(students);
  const waiting = students.filter((s) => unansweredQuestion(s.id));

  const cohortOptions = [
    `<option value="all" ${state.cohort === "all" ? "selected" : ""}>All cohorts</option>`,
    ...(state.data.cohorts || []).map(
      (c) =>
        `<option value="${c.id}" ${state.cohort === c.id ? "selected" : ""}>${escapeHtml(c.name)}${c.current ? " (current)" : ""}</option>`
    ),
  ].join("");

  const tabs = [
    { id: "assignments", label: "Assignments" },
    { id: "surveys", label: "Module Surveys" },
    { id: "roster", label: "Student Roster" },
  ]
    .map(
      (t) =>
        `<button class="tab ${state.coachTab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`
    )
    .join("");

  let panel = "";
  if (state.coachTab === "surveys") panel = surveysTab(students);
  else if (state.coachTab === "roster") panel = rosterTab(students);
  else panel = assignmentsTab(students);

  return `
    <div class="coach-page">
      <div class="coach-head">
        <div>
          <h1>Coach dashboard</h1>
          <p class="muted">${escapeHtml(state.data.className)} · ${escapeHtml(
            state.cohort === "all" ? "all cohorts" : cohortName(state.cohort)
          )}</p>
        </div>
        <label class="role-chip">Cohort
          <select id="cohort">${cohortOptions}</select>
        </label>
      </div>
      <div class="stats">
        <div class="stat">
          <b>${completion}%</b><span>Cohort completion</span>
          <div class="stat-bar"><span style="width:${completion}%"></span></div>
        </div>
        <div class="stat"><b>${active.length}</b><span>Active students${
          students.length - active.length ? ` · ${students.length - active.length} paused` : ""
        }</span></div>
        <div class="stat"><b>${pendingSubmissions(students)}</b><span>Pending submissions</span></div>
        <div class="stat"><b>${avgSurvey === null ? "—" : `${avgSurvey.toFixed(1)} / 5`}</b><span>Average survey score</span></div>
      </div>
      ${
        waiting.length
          ? `<div class="dash-alert">${waiting.length} student${waiting.length === 1 ? "" : "s"} waiting on a reply: ${waiting
              .map((s) => `<button class="link-btn" data-profile="${s.id}">${escapeHtml(s.name)}</button>`)
              .join(", ")}</div>`
          : ""
      }
      <div class="tabs">${tabs}</div>
      ${panel}
    </div>
  `;
}

function assignmentsTab(students) {
  const list = gradedLessons();
  const lesson = list.find((a) => a.id === state.coachAssignmentId) || list[0];
  const done = students.filter((s) => hasWork(s, lesson)).length;
  const options = list
    .map(
      (a) =>
        `<option value="${a.id}" ${a.id === lesson.id ? "selected" : ""}>${escapeHtml(chapterCode(a.chapter))} · ${escapeHtml(a.title.replace(/^(Assignment|Upload) · /, ""))}${a.type === "upload" ? " (PDF)" : ""}</option>`
    )
    .join("");
  const rows = students
    .filter((s) => {
      if (state.filter === "submitted") return hasWork(s, lesson);
      if (state.filter === "missing") return !hasWork(s, lesson);
      if (state.filter === "questions") return unansweredQuestion(s.id);
      return true;
    })
    .map((s) => {
      const ok = hasWork(s, lesson);
      const ask = unansweredQuestion(s.id);
      const file = lesson.type === "upload" ? fileFor(s, lesson.id) : null;
      const detail = ok
        ? lesson.type === "upload"
          ? `${escapeHtml(file.name)} · ${formatSize(file.size)}`
          : `${textFor(s, lesson.id).trim().split(/\s+/).length} words`
        : "—";
      return `
        <tr data-profile="${s.id}">
          <td><strong>${escapeHtml(s.name)}</strong><span class="cell-sub">${escapeHtml(cohortName(s.cohort))}</span></td>
          <td><span class="badge ${ok ? "ok" : "warn"}">${ok ? (lesson.type === "upload" ? "PDF in" : "Submitted") : "Missing"}</span></td>
          <td class="muted small">${detail}</td>
          <td>${ask ? `<span class="badge ask">Question</span>` : `<span class="muted small">—</span>`}</td>
          <td class="muted small">${overallProgress(s).pct}%</td>
          <td class="row-go">Open profile →</td>
        </tr>`;
    })
    .join("");

  return `
    <section class="card">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(lesson.title.replace(/^(Assignment|Upload) · /, ""))}</h2>
          <p class="muted small">${escapeHtml(chapterCode(lesson.chapter))} · due ${escapeHtml(lesson.due)} · ${done} of ${students.length} received</p>
        </div>
        <label class="role-chip">Assignment
          <select id="assignment">${options}</select>
        </label>
      </div>
      <div class="filters">
        <button data-filter="all" class="${state.filter === "all" ? "active" : ""}">All</button>
        <button data-filter="missing" class="${state.filter === "missing" ? "active" : ""}">Missing</button>
        <button data-filter="questions" class="${state.filter === "questions" ? "active" : ""}">Questions</button>
        <button data-filter="submitted" class="${state.filter === "submitted" ? "active" : ""}">Received</button>
      </div>
      ${
        rows
          ? `<table class="data-table">
              <thead><tr><th>Student</th><th>Status</th><th>Submission</th><th>Waiting</th><th>Course</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`
          : `<p class="empty">No students in this filter.</p>`
      }
      <div class="actions">
        <button class="primary" id="nudge">Nudge everyone missing</button>
      </div>
    </section>
  `;
}

function surveysTab(students) {
  const cards = surveyLessons()
    .map((lesson) => {
      const responses = students
        .map((s) => ({ student: s, answer: surveyFor(s, lesson.id) }))
        .filter((r) => r.answer);
      const perQuestion = SURVEY_QUESTIONS.map((q) => {
        const values = responses.map((r) => r.answer[q.id]).filter((v) => typeof v === "number");
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
        return { q, avg, count: values.length };
      });
      const bars = perQuestion
        .map(
          (p) => `
          <div class="survey-bar">
            <span class="survey-bar-label">${escapeHtml(p.q.label)}</span>
            <div class="survey-track"><span style="width:${p.avg ? (p.avg / 5) * 100 : 0}%"></span></div>
            <span class="survey-val">${p.avg ? p.avg.toFixed(1) : "—"}</span>
          </div>`
        )
        .join("");
      const comments = responses
        .filter((r) => r.answer.comment)
        .map(
          (r) => `
          <li>
            <button class="link-btn" data-profile="${r.student.id}">${escapeHtml(r.student.name)}</button>
            <span class="muted small">scored ${surveyScore(r.answer).toFixed(1)} / 5</span>
            <p>${escapeHtml(r.answer.comment)}</p>
          </li>`
        )
        .join("");
      return `
        <section class="card survey-card">
          <div class="panel-head">
            <div>
              <h2>${escapeHtml(lesson.title)}</h2>
              <p class="muted small">${responses.length} of ${students.length} responded</p>
            </div>
            <span class="score-chip">${
              responses.length
                ? (responses.reduce((sum, r) => sum + surveyScore(r.answer), 0) / responses.length).toFixed(1) + " / 5"
                : "no data"
            }</span>
          </div>
          ${responses.length ? bars : `<p class="empty">No responses yet for this module.</p>`}
          ${comments ? `<h3 class="comments-head">Comments</h3><ul class="comment-list">${comments}</ul>` : ""}
        </section>`;
    })
    .join("");
  return `<div class="survey-grid">${cards}</div>`;
}

function rosterTab(students) {
  const rows = students
    .map((s) => {
      const p = overallProgress(s);
      const ask = unansweredQuestion(s.id);
      const surveys = surveyLessons().filter((l) => surveyFor(s, l.id)).length;
      const stale = (daysAgo(s.lastActive) || 0) >= 7 && s.status !== "paused";
      return `
        <tr data-profile="${s.id}">
          <td>
            <strong>${escapeHtml(s.name)}</strong>
            <span class="cell-sub">${escapeHtml(s.email)}</span>
          </td>
          <td class="muted small">${escapeHtml(cohortName(s.cohort))}</td>
          <td>
            <div class="mini-bar"><span style="width:${p.pct}%"></span></div>
            <span class="cell-sub">${p.done} of ${p.total} · ${p.pct}%</span>
          </td>
          <td class="muted small">${submittedCount(s)} of ${gradedLessons().length}</td>
          <td class="muted small">${surveys} of ${surveyLessons().length}</td>
          <td>${ask ? `<span class="badge ask">Question</span>` : `<span class="muted small">—</span>`}</td>
          <td class="muted small ${stale ? "stale" : ""}">${escapeHtml(lastActiveLabel(s))}</td>
          <td><span class="badge ${s.status === "paused" ? "warn" : "ok"}">${s.status === "paused" ? "Paused" : "Active"}</span></td>
          <td class="row-go">Open profile →</td>
        </tr>`;
    })
    .join("");
  return `
    <section class="card">
      <div class="panel-head">
        <div>
          <h2>Student roster</h2>
          <p class="muted small">${students.length} student${students.length === 1 ? "" : "s"} · click any row for the full profile</p>
        </div>
      </div>
      <table class="data-table roster">
        <thead>
          <tr><th>Student</th><th>Cohort</th><th>Course progress</th><th>Submitted</th><th>Surveys</th><th>Waiting</th><th>Last active</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function profileView() {
  const student = state.data.students.find((s) => s.id === state.profileId);
  if (!student) {
    state.profileId = null;
    return coachView();
  }
  const p = overallProgress(student);
  const status = student.plan ? planStatus(student) : null;
  const pending = unansweredQuestion(student.id);

  const planBlock = student.plan
    ? `
      <dl class="fact-list">
        <div><dt>Start date</dt><dd>${escapeHtml(longDate(parseISO(student.plan.startDate)))}</dd></div>
        <div><dt>Hours per week</dt><dd>${escapeHtml(student.plan.hours)}</dd></div>
        <div><dt>Sessions</dt><dd>${student.plan.slots.map((s) => escapeHtml(slotLabel(s))).join(", ")}</dd></div>
        <div><dt>Session length</dt><dd>${planCapacity(student.plan)} min</dd></div>
        <div><dt>Make-up sessions</dt><dd>${
          (student.plan.makeups || []).length
            ? student.plan.makeups.map((m) => `${escapeHtml(longDate(parseISO(m.date)))} (${m.minutes} min)`).join(", ")
            : "none"
        }</dd></div>
        <div><dt>Projected finish</dt><dd>${status && status.finish ? escapeHtml(longDate(status.finish)) : "course complete"}</dd></div>
        <div><dt>Behind by</dt><dd>${
          status && status.overdue.length ? `${status.overdue.length} item${status.overdue.length === 1 ? "" : "s"}` : "on track"
        }</dd></div>
      </dl>`
    : `<p class="empty">No study plan created yet.</p>`;

  const work = gradedLessons()
    .map((lesson) => {
      const text = textFor(student, lesson.id);
      const file = fileFor(student, lesson.id);
      let body;
      if (lesson.type === "upload") {
        const href = file ? fileHref(student.id, lesson.id, file) : "";
        body = file
          ? `<div class="file-card compact">
              <span class="file-icon">PDF</span>
              <div class="file-meta">
                <strong>${escapeHtml(file.name)}</strong>
                <span class="muted small">${formatSize(file.size)} · uploaded ${escapeHtml(file.at)}</span>
              </div>
              ${
                href
                  ? `<a class="primary" href="${href}" target="_blank" rel="noopener">Open PDF</a>`
                  : `<span class="muted small">Uploaded in an earlier session</span>`
              }
            </div>`
          : `<div class="submission empty">No PDF uploaded.</div>`;
      } else {
        body = `<div class="submission ${text.trim() ? "" : "empty"}">${text.trim() ? escapeHtml(text) : "Nothing submitted."}</div>`;
      }
      return `
        <div class="work-item">
          <div class="work-head">
            <strong>${escapeHtml(lesson.title.replace(/^(Assignment|Upload) · /, ""))}</strong>
            <span class="muted small">${escapeHtml(chapterCode(lesson.chapter))} · due ${escapeHtml(lesson.due)}</span>
          </div>
          ${body}
        </div>`;
    })
    .join("");

  const surveys = surveyLessons()
    .map((lesson) => {
      const answer = surveyFor(student, lesson.id);
      if (!answer) {
        return `<div class="work-item"><div class="work-head"><strong>${escapeHtml(lesson.title)}</strong><span class="muted small">no response</span></div></div>`;
      }
      const scores = SURVEY_QUESTIONS.map(
        (q) => `<div class="score-row"><span>${escapeHtml(q.label)}</span><b>${answer[q.id] || "—"} / 5</b></div>`
      ).join("");
      return `
        <div class="work-item">
          <div class="work-head">
            <strong>${escapeHtml(lesson.title)}</strong>
            <span class="score-chip small">${surveyScore(answer).toFixed(1)} / 5</span>
          </div>
          ${scores}
          ${answer.comment ? `<p class="survey-comment">“${escapeHtml(answer.comment)}”</p>` : ""}
        </div>`;
    })
    .join("");

  const notes = (student.notes || [])
    .map(
      (n, i) => `
      <li>
        <p>${escapeHtml(n.text)}</p>
        <div class="note-foot">
          <span class="muted small">${escapeHtml(n.at)}</span>
          <button class="link-btn" data-drop-note="${i}">Delete</button>
        </div>
      </li>`
    )
    .join("");

  const messages = thread(student.id)
    .map((m) => {
      const label = m.kind === "question" ? "Asked the coach" : m.from === "coach" ? "You" : student.name;
      return `
        <div class="bubble ${m.from} ${m.kind === "question" ? "question" : ""}">
          ${escapeHtml(m.text)}
          <div class="muted small">${escapeHtml(m.at)} · ${escapeHtml(label)}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="coach-page">
      <button class="back-link" id="back-dash">← Back to dashboard</button>
      <div class="profile-head">
        <div class="avatar">${escapeHtml(student.name.split(" ").map((w) => w[0]).join(""))}</div>
        <div class="profile-id">
          <h1>${escapeHtml(student.name)}</h1>
          <p class="muted">${escapeHtml(student.email)} · ${escapeHtml(cohortName(student.cohort))} · joined ${escapeHtml(student.joined || "—")}</p>
        </div>
        <div class="profile-tags">
          <span class="badge ${student.status === "paused" ? "warn" : "ok"}">${student.status === "paused" ? "Paused" : "Active"}</span>
          <span class="muted small">Last active ${escapeHtml(lastActiveLabel(student))}</span>
        </div>
      </div>

      <section class="card">
        <div class="panel-head"><div><h2>Progress</h2><p class="muted small">${p.done} of ${p.total} course items complete</p></div><span class="score-chip">${p.pct}%</span></div>
        <div class="progress-wide"><span style="width:${p.pct}%"></span></div>
        <div class="progress-legend">
          <span>${submittedCount(student)} of ${gradedLessons().length} submissions in</span>
          <span>${surveyLessons().filter((l) => surveyFor(student, l.id)).length} of ${surveyLessons().length} surveys</span>
          <span>${thread(student.id).filter((m) => m.kind === "question").length} questions asked</span>
        </div>
      </section>

      <div class="profile-grid">
        <section class="card">
          <h2>Study planner settings</h2>
          ${planBlock}
        </section>
        <section class="card notes-card">
          <h2>Coach notes</h2>
          <p class="muted small">Private to you — students never see these.</p>
          <textarea id="note-text" rows="4" placeholder="Add a private note about ${escapeHtml(student.name.split(" ")[0])}…"></textarea>
          <div class="actions">
            <button class="primary" id="save-note">Save note</button>
          </div>
          ${notes ? `<ul class="note-list">${notes}</ul>` : `<p class="empty">No notes yet.</p>`}
        </section>
      </div>

      <section class="card">
        <h2>Assignment submissions</h2>
        <div class="work-list">${work}</div>
      </section>

      <section class="card">
        <h2>Module survey responses</h2>
        <div class="work-list">${surveys}</div>
      </section>

      <section class="card">
        <h2>Ask the Coach</h2>
        ${pending ? `<div class="waiting">Waiting on you: ${escapeHtml(pending.text)}</div>` : ""}
        <div class="thread">${messages || `<p class="empty">No questions or messages yet.</p>`}</div>
        <div class="compose">
          <input id="coach-msg" type="text" placeholder="${pending ? "Answer this question…" : "Feedback for " + escapeHtml(student.name.split(" ")[0]) + "…"}" />
          <button class="primary" id="send-coach">${pending ? "Reply" : "Send"}</button>
        </div>
      </section>
    </div>
  `;
}

function bindLogin() {
  document.getElementById("as-coach").onclick = () => {
    state.session = { role: "coach", id: "coach" };
    render();
  };
  document.getElementById("reset").onclick = () => {
    state.data = structuredClone(SEED);
    save();
    render();
  };
  document.querySelectorAll("[data-student]").forEach((btn) => {
    btn.onclick = () => {
      state.session = { role: "student", id: btn.dataset.student };
      maybePromptBehind();
      render();
    };
  });
}

function bindTopbar() {
  document.getElementById("role").onchange = (event) => {
    const value = event.target.value;
    state.notice = "";
    state.planner = false;
    state.planDraft = null;
    state.adjust = false;
    state.profileId = null;
    if (value === "coach") {
      state.session = { role: "coach", id: "coach" };
    } else {
      state.session = { role: "student", id: value };
      maybePromptBehind();
    }
    render();
  };
}

function bindSidebar() {
  document.querySelectorAll("[data-lesson]").forEach((btn) => {
    btn.onclick = () => {
      state.activeLessonId = btn.dataset.lesson;
      state.planner = false;
      state.notice = "";
      render();
    };
  });
  const planner = document.querySelector("[data-planner]");
  if (planner) {
    planner.onclick = () => {
      state.planner = true;
      state.planDraft = null;
      state.notice = "";
      render();
    };
  }
}

function bindLesson() {
  const lesson = findLesson(state.activeLessonId);
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.onclick = () => {
      state.activeLessonId = btn.dataset.goto;
      state.notice = "";
      render();
    };
  });
  if (lesson.type === "video") bindPlayer(lesson);
  if (lesson.type === "video" || lesson.type === "reading") {
    document.getElementById("complete").onclick = () => {
      const student = me();
      student.completed = student.completed || [];
      if (!student.completed.includes(lesson.id)) student.completed.push(lesson.id);
      save();
      render();
    };
  }
  if (lesson.type === "assignment") {
    const draft = document.getElementById("draft");
    const count = document.querySelector(".wordcount");
    draft.addEventListener("input", () => {
      const words = draft.value.trim() ? draft.value.trim().split(/\s+/).length : 0;
      count.textContent = `${words} words`;
    });
    document.getElementById("submit").onclick = () => {
      const student = me();
      student.submissions = student.submissions || {};
      student.submissions[lesson.id] = draft.value.trim();
      save();
      render();
    };
  }
  if (lesson.type === "upload") bindUpload(lesson);
  if (lesson.type === "survey") {
    document.querySelectorAll(".scale-opt input").forEach((radio) => {
      radio.onchange = () => {
        radio.closest(".scale").querySelectorAll(".scale-opt").forEach((opt) => opt.classList.remove("on"));
        radio.closest(".scale-opt").classList.add("on");
      };
    });
    document.getElementById("send-survey").onclick = () => {
      const student = me();
      const answer = { comment: document.getElementById("survey-comment").value.trim() };
      SURVEY_QUESTIONS.forEach((q) => {
        const picked = document.querySelector(`input[name="q-${q.id}"]:checked`);
        if (picked) answer[q.id] = Number(picked.value);
      });
      student.surveys = student.surveys || {};
      student.surveys[lesson.id] = answer;
      save();
      render();
    };
  }
  if (lesson.type === "ask") {
    document.getElementById("ask-coach").onclick = () => sendQuestion(lesson);
    document.getElementById("ask-text").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendQuestion(lesson);
    });
  }
}

function bindUpload(lesson) {
  const input = document.getElementById("pdf");
  const remove = document.getElementById("remove-file");
  if (remove) {
    remove.onclick = () => {
      const student = me();
      delete student.uploads[lesson.id];
      delete sessionFiles[`${student.id}:${lesson.id}`];
      save();
      state.notice = "";
      render();
    };
  }
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      state.notice = "That file is not a PDF. Export or scan your work as a PDF and try again.";
      render();
      return;
    }
    const student = me();
    student.uploads = student.uploads || {};
    const key = `${student.id}:${lesson.id}`;
    const record = { name: file.name, size: file.size, at: nowLabel() };

    const finish = (message) => {
      student.uploads[lesson.id] = record;
      const stored = save();
      state.notice = stored ? message : "Uploaded for this session. The file was too large to keep after a refresh.";
      render();
    };

    if (file.size > MAX_INLINE_BYTES) {
      sessionFiles[key] = URL.createObjectURL(file);
      finish("Uploaded. This file is large, so it stays available until you refresh.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      record.dataUrl = reader.result;
      sessionFiles[key] = reader.result;
      finish("");
    };
    reader.onerror = () => {
      state.notice = "That file could not be read. Try exporting it again.";
      render();
    };
    reader.readAsDataURL(file);
  };
}

function sendQuestion(lesson) {
  const input = document.getElementById("ask-text");
  const text = input.value.trim();
  if (!text) return;
  const id = state.session.id;
  state.data.messages[id] = thread(id);
  state.data.messages[id].push({
    from: "student",
    kind: "question",
    text,
    at: nowLabel(),
    context: `${chapterCode(lesson.chapter)} · Ask the Coach`,
  });
  save();
  state.notice = "Sent. Your coach sees this under Questions waiting.";
  render();
}

function bindCoach() {
  if (state.profileId) return bindProfile();

  const cohort = document.getElementById("cohort");
  cohort.onchange = (event) => {
    state.cohort = event.target.value;
    render();
  };
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.onclick = () => {
      state.coachTab = btn.dataset.tab;
      render();
    };
  });
  document.querySelectorAll("[data-profile]").forEach((el) => {
    el.onclick = (event) => {
      event.stopPropagation();
      state.profileId = el.dataset.profile;
      state.notice = "";
      render();
    };
  });

  const assignment = document.getElementById("assignment");
  if (assignment) {
    assignment.onchange = (event) => {
      state.coachAssignmentId = event.target.value;
      render();
    };
  }
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.onclick = () => {
      state.filter = btn.dataset.filter;
      render();
    };
  });
  const nudge = document.getElementById("nudge");
  if (nudge) {
    nudge.onclick = () => {
      const list = gradedLessons();
      const lesson = list.find((a) => a.id === state.coachAssignmentId) || list[0];
      const missing = cohortStudents().filter((s) => !hasWork(s, lesson) && s.status !== "paused");
      if (!missing.length) return;
      const what = lesson.title.replace(/^(Assignment|Upload) · /, "");
      missing.forEach((s) => {
        state.data.messages[s.id] = thread(s.id);
        state.data.messages[s.id].push({
          from: "coach",
          text:
            lesson.type === "upload"
              ? `Reminder: ${what} is due ${lesson.due}. A scan of your working is fine — I would rather see it rough than late.`
              : `Reminder: ${what} is due ${lesson.due}. Send it even if it does not balance, and I will work through it with you.`,
          at: nowLabel(),
          context: `${chapterCode(lesson.chapter)} · ${lesson.type === "upload" ? "Upload" : "Assignment"}`,
        });
      });
      save();
      render();
    };
  }
}

function bindProfile() {
  document.getElementById("back-dash").onclick = () => {
    state.profileId = null;
    render();
  };
  const student = state.data.students.find((s) => s.id === state.profileId);
  document.getElementById("save-note").onclick = () => {
    const box = document.getElementById("note-text");
    const text = box.value.trim();
    if (!text) return;
    student.notes = student.notes || [];
    student.notes.unshift({ text, at: longDate(today()) });
    save();
    render();
  };
  document.querySelectorAll("[data-drop-note]").forEach((btn) => {
    btn.onclick = () => {
      student.notes.splice(Number(btn.dataset.dropNote), 1);
      save();
      render();
    };
  });
  document.getElementById("send-coach").onclick = sendCoachMessage;
  document.getElementById("coach-msg").addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendCoachMessage();
  });
}

function sendCoachMessage() {
  const input = document.getElementById("coach-msg");
  const text = input.value.trim();
  if (!text) return;
  const id = state.profileId;
  if (!id) return;
  state.data.messages[id] = thread(id);
  state.data.messages[id].push({ from: "coach", text, at: nowLabel() });
  save();
  render();
}

/* ---------- Personalised study planner ---------- */

function midnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function today() {
  return midnight(new Date());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date) {
  const d = midnight(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function parseISO(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return today();
  return new Date(y, m - 1, d);
}

function shiftISO(days) {
  return isoDate(addDays(new Date(), days));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function longDate(date) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function shortDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function mondayOf(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function slotLabel(slotId) {
  const [dayId, periodId] = slotId.split("-");
  const day = DAYS.find((d) => d.id === dayId);
  const period = PERIODS.find((p) => p.id === periodId);
  return `${day ? day.label : dayId} ${period ? period.label : periodId}`;
}

function sortSlots(slots) {
  const order = (slotId) => {
    const [dayId, periodId] = slotId.split("-");
    return DAYS.findIndex((d) => d.id === dayId) * 2 + PERIODS.findIndex((p) => p.id === periodId);
  };
  return [...slots].sort((a, b) => order(a) - order(b));
}

function estimateMinutes(lesson) {
  if (lesson.type === "video") return Math.ceil(lesson.seconds / 60) + 12;
  if (lesson.type === "reading") return (parseInt(lesson.duration, 10) || 6) * 2 + 6;
  if (lesson.type === "assignment") return 60;
  if (lesson.type === "upload") return 40;
  return 0;
}

function taskAction(lesson) {
  if (lesson.type === "video") return "Watch and take notes";
  if (lesson.type === "reading") return "Read and annotate";
  if (lesson.type === "assignment") return "Write up and submit";
  if (lesson.type === "upload") return "Scan and upload PDF";
  return "";
}

function isDone(student, lesson) {
  if (lesson.type === "video" || lesson.type === "reading") return (student.completed || []).includes(lesson.id);
  return hasWork(student, lesson);
}

// The whole course, in order, so a plan can show a finish date. Ask the Coach
// and surveys are not scheduled work.
function courseTasks() {
  return allLessons()
    .filter((l) => ["video", "reading", "assignment", "upload"].includes(l.type))
    .map((l) => ({ lesson: l, minutes: estimateMinutes(l) }));
}

function planCapacity(plan) {
  const slots = plan.slots.length || 1;
  const hours = Math.max(0.5, Number(plan.hours) || 1);
  return Math.max(20, Math.floor((hours * 60) / slots));
}

// Every session the plan implies, in date order, including one-off make-ups.
function planSessions(plan, weeks) {
  const start = parseISO(plan.startDate);
  const capacity = planCapacity(plan);
  const sessions = [];
  sortSlots(plan.slots).forEach((slotId) => {
    const [dayId, period] = slotId.split("-");
    const targetJs = WEEKDAYS.indexOf(DAYS.find((d) => d.id === dayId).label);
    const delta = (targetJs - start.getDay() + 7) % 7;
    for (let w = 0; w < weeks; w += 1) {
      sessions.push({ date: addDays(start, delta + w * 7), period, capacity, slotId });
    }
  });
  (plan.makeups || []).forEach((m) => {
    sessions.push({
      date: parseISO(m.date),
      period: m.period,
      capacity: Math.max(20, Number(m.minutes) || capacity),
      slotId: `${m.date}-${m.period}`,
      makeup: true,
    });
  });
  const rank = (s) => s.date.getTime() + (s.period === "morning" ? 0 : 1);
  return sessions.sort((a, b) => rank(a) - rank(b));
}

function packPlan(tasks, sessions) {
  const queue = tasks.map((t) => ({ ...t, remaining: t.minutes }));
  const filled = [];

  for (const session of sessions) {
    if (!queue.length) break;
    const cell = { ...session, items: [], used: 0 };
    while (queue.length) {
      const free = cell.capacity - cell.used;
      const task = queue[0];
      if (task.remaining <= free) {
        cell.items.push({ lesson: task.lesson, minutes: task.remaining });
        cell.used += task.remaining;
        queue.shift();
        continue;
      }
      // Split only when both halves are worth sitting down for, or when the
      // session is empty and the task would otherwise never fit.
      if (cell.used === 0 || (free >= 30 && task.remaining - free >= 20)) {
        cell.items.push({ lesson: task.lesson, minutes: free });
        task.remaining -= free;
        cell.used = cell.capacity;
      }
      break;
    }
    if (cell.items.length) filled.push(cell);
  }

  const counts = {};
  filled.forEach((c) => c.items.forEach((i) => {
    counts[i.lesson.id] = (counts[i.lesson.id] || 0) + 1;
  }));
  const seen = {};
  filled.forEach((c) => c.items.forEach((item) => {
    if (counts[item.lesson.id] > 1) {
      seen[item.lesson.id] = (seen[item.lesson.id] || 0) + 1;
      item.part = seen[item.lesson.id];
      item.parts = counts[item.lesson.id];
    }
  }));

  return { sessions: filled, unplaced: queue.length };
}

function planStatus(student, planOverride) {
  const plan = planOverride || student.plan;
  if (!plan || !plan.slots.length) return null;
  const packed = packPlan(courseTasks(), planSessions(plan, 16));
  const cells = packed.sessions;
  const now = today();
  const overdue = [];
  const seen = {};
  cells.forEach((cell) => {
    if (cell.date >= now) return;
    cell.items.forEach((item) => {
      if (isDone(student, item.lesson) || seen[item.lesson.id]) return;
      seen[item.lesson.id] = true;
      overdue.push({ lesson: item.lesson, date: cell.date });
    });
  });
  const remaining = courseTasks().filter((t) => !isDone(student, t.lesson)).length;
  return {
    plan,
    cells,
    overdue,
    remaining,
    unplaced: packed.unplaced,
    finish: cells.length ? cells[cells.length - 1].date : null,
  };
}

// Cohort Zoom calls are fixed dates, so they show and export regardless of
// where a student's own plan has got to.
function upcomingLiveSessions() {
  const now = today();
  return (state.data.liveSessions || [])
    .map((s) => ({ ...s, when: parseISO(s.date) }))
    .filter((s) => s.when >= now)
    .sort((a, b) => a.when - b.when);
}

function draftPlan() {
  return {
    startDate: state.planDraft.startDate,
    hours: state.planDraft.hours,
    slots: state.planDraft.slots,
    makeups: state.planDraft.makeups,
  };
}

function scheduleHtml() {
  const student = me();
  const draft = draftPlan();

  if (!draft.slots.length) {
    return `<div class="card plan-empty"><p class="empty">Pick at least one session above and your dated schedule will appear here.</p></div>`;
  }

  const status = planStatus(student, draft);
  const cells = status.cells;
  if (!cells.length) {
    return `<div class="card plan-empty"><h3>Nothing left to schedule</h3><p>Every lesson, assignment, and upload on the course is complete.</p></div>`;
  }

  const start = parseISO(draft.startDate);
  const live = upcomingLiveSessions();

  const entries = [
    ...cells.map((c) => ({ kind: "study", date: c.date, period: c.period, cell: c })),
    ...live.map((s) => ({ kind: "live", date: s.when, period: "evening", live: s })),
  ].sort((a, b) => a.date - b.date || (a.period === "morning" ? -1 : 1));

  const groups = [];
  entries.forEach((entry) => {
    const key = isoDate(mondayOf(entry.date));
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, monday: mondayOf(entry.date), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  });

  const now = today();
  const weekBlocks = groups
    .map((group, index) => {
      const rows = group.entries
        .map((entry) => {
          if (entry.kind === "live") {
            return `
              <div class="plan-row live">
                <div class="plan-slot">
                  <strong>${escapeHtml(longDate(entry.date))}</strong>
                  <span class="muted small">${escapeHtml(entry.live.time)} · live on Zoom</span>
                </div>
                <ul class="plan-items">
                  <li>
                    <span class="plan-icon live">◉</span>
                    <span class="plan-item-text">
                      <strong>${escapeHtml(entry.live.title)}</strong>
                      <span class="muted small">${entry.live.minutes} min · <a href="${escapeHtml(entry.live.zoom)}" target="_blank" rel="noopener">Join Zoom</a></span>
                    </span>
                  </li>
                </ul>
              </div>`;
          }
          const cell = entry.cell;
          const past = cell.date < now;
          const items = cell.items
            .map((item) => {
              const done = isDone(student, item.lesson);
              const late = past && !done;
              return `
                <li class="${done ? "done" : ""} ${late ? "late" : ""}">
                  <span class="plan-icon ${item.lesson.type}">${done ? "✓" : ICONS[item.lesson.type]}</span>
                  <span class="plan-item-text">
                    <strong>${escapeHtml(item.lesson.title)}${item.parts ? ` — part ${item.part} of ${item.parts}` : ""}</strong>
                    <span class="muted small">${escapeHtml(chapterCode(item.lesson.chapter))} · ${escapeHtml(taskAction(item.lesson))} · ${item.minutes} min${late ? " · missed" : ""}</span>
                  </span>
                </li>`;
            })
            .join("");
          return `
            <div class="plan-row ${past ? "past" : ""}">
              <div class="plan-slot">
                <strong>${escapeHtml(longDate(cell.date))}</strong>
                <span class="muted small">${escapeHtml(cell.period)}${cell.makeup ? " · make-up" : ""} · ${cell.used} of ${cell.capacity} min</span>
              </div>
              <ul class="plan-items">${items}</ul>
            </div>`;
        })
        .join("");
      const end = addDays(group.monday, 6);
      return `
        <section class="card plan-week">
          <div class="plan-week-head">
            <h3>Week ${index + 1}</h3>
            <span class="muted small">${escapeHtml(shortDate(group.monday))} – ${escapeHtml(shortDate(end))}</span>
          </div>
          ${rows}
        </section>`;
    })
    .join("");

  const hours = Math.max(0.5, Number(draft.hours) || 1);
  const finishLine = status.finish
    ? `At ${hours} hours a week you finish the whole course on <strong>${escapeHtml(longDate(status.finish))}</strong> — ${groups.length} week${groups.length === 1 ? "" : "s"} from ${escapeHtml(longDate(start))}.`
    : "";
  const behindLine = status.overdue.length
    ? `<div class="plan-behind">You are <strong>${status.overdue.length} item${status.overdue.length === 1 ? "" : "s"}</strong> behind this plan. Use <em>Adjust me</em> to add make-up sessions or move your start date.</div>`
    : "";

  return `
    ${behindLine}
    <div class="plan-summary">${finishLine} Sessions are capped at ${planCapacity(draft)} minutes each so nothing overruns.</div>
    ${weekBlocks}
    <p class="muted small plan-note">Ask the Coach is not scheduled — it stays open whenever you get stuck. Live Zoom sessions are shown in place.</p>
  `;
}

function plannerView() {
  const student = me();
  if (!state.planDraft) {
    const saved = student.plan;
    state.planDraft = {
      startDate: saved && saved.startDate ? saved.startDate : isoDate(today()),
      hours: saved ? saved.hours : DEFAULT_PLAN.hours,
      slots: saved ? [...saved.slots] : [...DEFAULT_PLAN.slots],
      makeups: saved && saved.makeups ? saved.makeups.map((m) => ({ ...m })) : [],
    };
  }
  const draft = state.planDraft;
  const slotGrid = DAYS.map((day) => {
    const boxes = PERIODS.map((period) => {
      const id = `${day.id}-${period.id}`;
      const on = draft.slots.includes(id);
      return `
        <label class="slot ${on ? "on" : ""}">
          <input type="checkbox" data-slot="${id}" ${on ? "checked" : ""} />
          <span>${period.label}</span>
        </label>`;
    }).join("");
    return `<div class="slot-day"><span class="slot-day-label">${day.label}</span>${boxes}</div>`;
  }).join("");

  const makeupList = draft.makeups.length
    ? `<ul class="makeup-list">${draft.makeups
        .map(
          (m, i) =>
            `<li><span>${escapeHtml(longDate(parseISO(m.date)))} · ${escapeHtml(m.period)} · ${m.minutes} min</span><button class="link-btn" data-drop-makeup="${i}">Remove</button></li>`
        )
        .join("")}</ul>`
    : `<p class="muted small">No make-up sessions yet.</p>`;

  const adjustPanel = state.adjust
    ? `
      <section class="card adjust-panel">
        <h3>Adjust me</h3>
        <p class="muted small">Quick changes to catch up without rebuilding the plan from scratch.</p>
        <div class="adjust-actions">
          <button class="ghost" id="adj-today">Move start to today</button>
          <button class="ghost" id="adj-hour">Add an hour a week</button>
          <button class="ghost" id="adj-catchup">Add 2 make-up sessions</button>
        </div>
        <h4>Make-up sessions</h4>
        ${makeupList}
        <div class="makeup-add">
          <input type="date" id="makeup-date" value="${escapeHtml(shiftISO(2))}" />
          <select id="makeup-period">
            <option value="morning">morning</option>
            <option value="evening" selected>evening</option>
          </select>
          <input type="number" id="makeup-min" min="20" max="240" step="10" value="90" />
          <button class="ghost" id="add-makeup">Add session</button>
        </div>
      </section>`
    : "";

  return `
    <div class="plan-hero">
      <p class="kicker-light">Personalised study planner</p>
      <h1>Create My Study Plan</h1>
      <p>Set your start date and the sessions you can keep. We date the whole course — every video, reading, assignment, and upload — so you can see exactly when you finish.</p>
      <div class="plan-hero-actions">
        <button class="download-btn" id="subscribe-plan">${
          student.calendar && student.calendar.subscribed ? "↻ Update my calendar feed" : "🗓 Subscribe to calendar"
        }</button>
        <button class="hero-ghost" id="download-plan">⤓ Download Planner</button>
        <button class="hero-ghost" id="toggle-adjust">${state.adjust ? "Hide Adjust me" : "Adjust me"}</button>
      </div>
    </div>
    <div class="plan-page">
      <div class="plan-left">
        ${subscribePanel(student)}
        <section class="card plan-form">
          <div class="plan-field">
            <label for="start"><strong>Study start date</strong></label>
            <input id="start" type="date" class="select-line" value="${escapeHtml(draft.startDate)}" />
          </div>
          <div class="plan-field">
            <label for="hours"><strong>Hours available per week</strong></label>
            <div class="hours-row">
              <input id="hours" type="number" min="1" max="40" step="0.5" value="${escapeHtml(draft.hours)}" />
              <span class="muted small">hours per week</span>
            </div>
          </div>
          <div class="plan-field">
            <label><strong>When can you study?</strong></label>
            <p class="muted small">Tick each session you can realistically keep, for example Mon evening or Sat morning.</p>
            <div class="slot-grid">${slotGrid}</div>
          </div>
          <div class="actions">
            <button class="primary" id="save-plan">Save my plan</button>
            ${student.plan ? `<button class="ghost" id="clear-plan">Clear saved plan</button>` : ""}
          </div>
          ${state.notice ? `<div class="notice" style="margin-top:14px">${escapeHtml(state.notice)}</div>` : ""}
        </section>
        ${adjustPanel}
      </div>
      <div id="schedule" class="plan-schedule">${scheduleHtml()}</div>
    </div>
  `;
}

function refreshSchedule() {
  document.getElementById("schedule").innerHTML = scheduleHtml();
}

function bindPlanner() {
  const hours = document.getElementById("hours");
  hours.addEventListener("input", () => {
    state.planDraft.hours = hours.value;
    refreshSchedule();
  });
  const start = document.getElementById("start");
  start.addEventListener("change", () => {
    state.planDraft.startDate = start.value || isoDate(today());
    refreshSchedule();
  });
  document.querySelectorAll("[data-slot]").forEach((box) => {
    box.onchange = () => {
      const id = box.dataset.slot;
      if (box.checked) state.planDraft.slots.push(id);
      else state.planDraft.slots = state.planDraft.slots.filter((s) => s !== id);
      box.closest(".slot").classList.toggle("on", box.checked);
      refreshSchedule();
    };
  });
  document.getElementById("save-plan").onclick = () => {
    const student = me();
    student.plan = {
      startDate: state.planDraft.startDate,
      hours: Math.max(0.5, Number(state.planDraft.hours) || 1),
      slots: sortSlots(state.planDraft.slots),
      makeups: state.planDraft.makeups.map((m) => ({ ...m })),
    };
    save();
    if (student.calendar && student.calendar.subscribed) {
      state.notice = "Plan saved. Republishing your calendar feed…";
      render();
      publishFeed(student, { silent: true }).then((okay) => {
        if (okay) {
          state.notice = "Plan saved and your subscribed calendar updated.";
          render();
        }
      });
      return;
    }
    state.notice = "Plan saved. It shows in your sidebar and you can adjust it any time.";
    render();
  };
  const clear = document.getElementById("clear-plan");
  if (clear) {
    clear.onclick = () => {
      const student = me();
      delete student.plan;
      save();
      state.planDraft = null;
      state.notice = "";
      render();
    };
  }
  document.getElementById("toggle-adjust").onclick = () => {
    state.adjust = !state.adjust;
    render();
  };
  document.getElementById("download-plan").onclick = downloadPlanner;
  document.getElementById("subscribe-plan").onclick = () => {
    publishFeed(me());
  };
  bindSubscribe();
  bindAdjust();
}

function bindSubscribe() {
  const copy = document.getElementById("copy-feed");
  if (copy) {
    copy.onclick = () => {
      const field = document.getElementById("feed-url");
      field.select();
      if (navigator.clipboard) navigator.clipboard.writeText(field.value).catch(() => {});
      copy.textContent = "Copied";
    };
  }
  const stop = document.getElementById("unsubscribe");
  if (stop) {
    stop.onclick = () => {
      const student = me();
      const token = student.calendar.token;
      fetch(feedUrls(token).http, { method: "DELETE" }).catch(() => {});
      student.calendar = { token, subscribed: false };
      save();
      state.notice = "Feed stopped. Remove the subscription in your calendar app too.";
      render();
    };
  }
}

function bindAdjust() {
  if (!state.adjust) return;
  const draft = state.planDraft;
  document.getElementById("adj-today").onclick = () => {
    draft.startDate = isoDate(today());
    render();
  };
  document.getElementById("adj-hour").onclick = () => {
    draft.hours = Math.round((Number(draft.hours) + 1) * 10) / 10;
    render();
  };
  document.getElementById("adj-catchup").onclick = () => {
    [2, 3].forEach((offset) => {
      const date = shiftISO(offset);
      if (!draft.makeups.some((m) => m.date === date)) {
        draft.makeups.push({ date, period: "evening", minutes: 90 });
      }
    });
    render();
  };
  document.getElementById("add-makeup").onclick = () => {
    const date = document.getElementById("makeup-date").value;
    const period = document.getElementById("makeup-period").value;
    const minutes = Math.max(20, Number(document.getElementById("makeup-min").value) || 90);
    if (!date) return;
    draft.makeups.push({ date, period, minutes });
    render();
  };
  document.querySelectorAll("[data-drop-makeup]").forEach((btn) => {
    btn.onclick = () => {
      draft.makeups.splice(Number(btn.dataset.dropMakeup), 1);
      render();
    };
  });
}

/* ---------- Calendar export ---------- */

function icsEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsFold(line) {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function icsStamp(date, hours, minutes) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function lessonLink(lessonId) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#lesson=${lessonId}`;
}

function buildIcs(student, planOverride) {
  const draft = planOverride || (state.planDraft ? draftPlan() : student.plan);
  const status = planStatus(student, draft);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(state.data.company)}//${icsEscape(state.data.className)}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${state.data.className} study plan`)}`,
    `X-WR-CALDESC:${icsEscape(`${student.name}'s study plan. Updates when the plan changes.`)}`,
    // Ask subscribed clients to re-check hourly.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const stampNow = icsStamp(new Date(), new Date().getHours(), new Date().getMinutes());

  const push = (event) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stampNow}`);
    lines.push(`DTSTART:${event.start}`);
    lines.push(`DTEND:${event.end}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(event.summary)}`));
    lines.push(icsFold(`DESCRIPTION:${icsEscape(event.description)}`));
    if (event.location) lines.push(icsFold(`LOCATION:${icsEscape(event.location)}`));
    if (event.url) lines.push(icsFold(`URL:${icsEscape(event.url)}`));
    lines.push("END:VEVENT");
  };

  (status ? status.cells : []).forEach((cell, ci) => {
    const [h, m] = SLOT_TIMES[cell.period] || SLOT_TIMES.evening;
    let offset = 0;
    cell.items.forEach((item, ii) => {
      const startMinutes = h * 60 + m + offset;
      const endMinutes = startMinutes + item.minutes;
      offset += item.minutes;
      const part = item.parts ? ` (part ${item.part} of ${item.parts})` : "";
      const description = [
        `${taskAction(item.lesson)} · ${item.minutes} minutes`,
        `${chapterCode(item.lesson.chapter)} — ${item.lesson.chapter.title}`,
        `Course content: ${lessonLink(item.lesson.id)}`,
        item.lesson.type === "upload" || item.lesson.type === "assignment"
          ? `Due ${item.lesson.due}`
          : "",
        `Ask the Coach if you get stuck: ${lessonLink(item.lesson.chapter.lessons.filter((l) => l.type === "ask").map((l) => l.id)[0] || item.lesson.id)}`,
      ]
        .filter(Boolean)
        .join("\n");
      push({
        // Stable per lesson and part, so a rescheduled session moves in a
        // subscribed calendar instead of duplicating.
        uid: `${feedId}-${item.lesson.id}-p${item.part || 1}@accountingstudyadvice`,
        start: icsStamp(cell.date, Math.floor(startMinutes / 60), startMinutes % 60),
        end: icsStamp(cell.date, Math.floor(endMinutes / 60), endMinutes % 60),
        summary: `${state.data.className}: ${item.lesson.title}${part}`,
        description,
        location: lessonLink(item.lesson.id),
        url: lessonLink(item.lesson.id),
      });
    });
  });

  upcomingLiveSessions().forEach((live) => {
    const [h, m] = live.time.split(":").map(Number);
    const endMinutes = h * 60 + m + live.minutes;
    push({
      uid: `${feedId}-${live.id}@accountingstudyadvice`,
      start: icsStamp(live.when, h, m),
      end: icsStamp(live.when, Math.floor(endMinutes / 60), endMinutes % 60),
      summary: `${state.data.className} live: ${live.title}`,
      description: [
        `Live session with ${state.data.company}.`,
        `Zoom: ${live.zoom}`,
        `Course portal: ${location.origin}${location.pathname}`,
      ].join("\n"),
      location: live.zoom,
      url: live.zoom,
    });
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* ---------- Calendar subscription ---------- */

function feedToken(student) {
  if (student.calendar && student.calendar.token) return student.calendar.token;
  const random = Math.random().toString(36).slice(2, 10);
  return `${student.id}-${random}`;
}

function feedUrls(token) {
  const base = `${location.origin}/calendar/${token}.ics`;
  const webcal = base.replace(/^https?:/, "webcal:");
  return {
    http: base,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

// The browser owns the .ics generator, so it publishes the finished feed to the
// server and the server just hosts it for subscribers.
function publishFeed(student, { silent } = {}) {
  const token = feedToken(student);
  student.calendar = { ...(student.calendar || {}), token };
  const ics = buildIcs(student);
  return fetch(feedUrls(token).http, {
    method: "PUT",
    headers: { "Content-Type": "text/calendar" },
    body: ics,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      student.calendar = {
        token,
        subscribed: true,
        updatedAt: `${longDate(today())}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        events: (ics.match(/BEGIN:VEVENT/g) || []).length,
      };
      save();
      if (!silent) state.notice = "Calendar feed published. Subscribe once and it stays up to date.";
      render();
      return true;
    })
    .catch(() => {
      student.calendar = { ...(student.calendar || {}), token, failed: true };
      save();
      state.notice =
        "Could not reach the feed service, so subscribing is unavailable. Start the app with `ruby server.rb`, or use Download Planner instead.";
      render();
      return false;
    });
}

function subscribePanel(student) {
  const cal = student.calendar;
  if (!cal || !cal.subscribed) {
    return `
      <section class="card subscribe-card">
        <h3>Subscribe to calendar</h3>
        <p class="muted small">A subscription is a live link rather than a one-off import. Save a change here and your calendar picks it up on its next refresh, so you never re-import a file.</p>
        ${cal && cal.failed ? `<div class="waiting">The feed service is not running. Use <strong>Download Planner</strong> for a one-off file instead.</div>` : ""}
      </section>`;
  }
  const urls = feedUrls(cal.token);
  return `
    <section class="card subscribe-card live">
      <div class="panel-head">
        <div>
          <h3>Calendar subscription</h3>
          <p class="muted small">${cal.events} events · updated ${escapeHtml(cal.updatedAt || "just now")}</p>
        </div>
        <span class="score-chip small">Live</span>
      </div>
      <label class="feed-label" for="feed-url">Your private feed address</label>
      <div class="feed-row">
        <input id="feed-url" type="text" readonly value="${escapeHtml(urls.http)}" />
        <button class="ghost" id="copy-feed">Copy</button>
      </div>
      <div class="actions">
        <a class="primary" href="${escapeHtml(urls.webcal)}">Add to Apple Calendar / Outlook</a>
        <a class="ghost" href="${escapeHtml(urls.google)}" target="_blank" rel="noopener">Add to Google Calendar</a>
        <button class="ghost" id="unsubscribe">Stop the feed</button>
      </div>
      <p class="muted small feed-note">Saving your plan republishes this feed automatically. Calendar apps re-check roughly hourly, so a change may take a little while to appear. Google needs a publicly reachable address, so on this local prototype use the Apple Calendar or Outlook link.</p>
    </section>`;
}

function downloadPlanner() {
  const student = me();
  const ics = buildIcs(student);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "iac-skills-study-plan.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  state.notice = "Planner downloaded. Import iac-skills-study-plan.ics into Google Calendar, Outlook, or Apple Calendar.";
  render();
}

/* ---------- Behind-schedule prompt ---------- */

function maybePromptBehind() {
  if (!state.session || state.session.role !== "student") return;
  const student = me();
  const status = planStatus(student);
  if (status && status.overdue.length) state.modal = "behind";
}

function renderModal() {
  const host = document.getElementById("modal");
  if (state.modal !== "behind" || !state.session || state.session.role !== "student") {
    host.innerHTML = "";
    return;
  }
  const student = me();
  const status = planStatus(student);
  if (!status || !status.overdue.length) {
    host.innerHTML = "";
    return;
  }
  const items = status.overdue
    .slice(0, 4)
    .map(
      (o) =>
        `<li><strong>${escapeHtml(o.lesson.title)}</strong><span class="muted small">${escapeHtml(chapterCode(o.lesson.chapter))} · was scheduled ${escapeHtml(longDate(o.date))}</span></li>`
    )
    .join("");
  const more = status.overdue.length > 4 ? `<p class="muted small">and ${status.overdue.length - 4} more.</p>` : "";
  host.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-label="You are behind your study plan">
        <h2>Welcome back, ${escapeHtml(student.name.split(" ")[0])}</h2>
        <p>You are <strong>${status.overdue.length} item${status.overdue.length === 1 ? "" : "s"}</strong> behind your study plan. Nothing is lost — you can reschedule it or carry on from where you are.</p>
        <ul class="modal-list">${items}</ul>
        ${more}
        <div class="modal-actions">
          <button class="primary" id="modal-revise">Revise my plan</button>
          <button class="ghost" id="modal-continue">Just keep learning</button>
        </div>
      </section>
    </div>
  `;
  document.getElementById("modal-revise").onclick = () => {
    state.modal = null;
    state.planner = true;
    state.planDraft = null;
    state.adjust = true;
    state.notice = "";
    render();
  };
  document.getElementById("modal-continue").onclick = () => {
    state.modal = null;
    renderModal();
  };
}

/* ---------- Course assistant ---------- */

function chatKey() {
  return state.session ? state.session.id : "guest";
}

function chatLog() {
  state.data.chats = state.data.chats || {};
  state.data.chats[chatKey()] = state.data.chats[chatKey()] || [];
  return state.data.chats[chatKey()];
}

function deadlineAnswer() {
  const lines = gradedLessons().map(
    (l) => `${chapterCode(l.chapter)} — ${l.title.replace(/^(Assignment|Upload) · /, "")}: due ${l.due}`
  );
  return ["Here is everything currently set, in order:", lines.join("\n"), "Nothing is closed off — send late work anyway and Yvonne will still mark it."];
}

function scoreEntry(query, keywords) {
  let score = 0;
  keywords.forEach((keyword) => {
    if (query.includes(keyword)) score += keyword.includes(" ") ? 3 : 2;
  });
  return score;
}

function searchLessons(query) {
  const words = query.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (!words.length) return null;
  let best = null;
  allLessons()
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

function botReply(rawQuery) {
  const query = rawQuery.toLowerCase();
  let best = null;
  KNOWLEDGE.forEach((entry) => {
    const score = scoreEntry(query, entry.keywords);
    if (score && (!best || score > best.score)) best = { entry, score };
  });

  if (best) {
    const entry = best.entry;
    const paragraphs = entry.dynamic === "deadlines" ? deadlineAnswer() : entry.answer;
    return {
      paragraphs,
      lessonId: entry.lessonId,
      offerEscalate: entry.id === "coach" || entry.id === "procrastination" || entry.id === "communication",
    };
  }

  const hit = searchLessons(query);
  if (hit) {
    const lesson = hit.lesson;
    return {
      paragraphs: [
        `The closest material is ${lesson.title}. ${lesson.blurb || ""}`.trim(),
        (lesson.takeaways && lesson.takeaways.length
          ? `Key points: ${lesson.takeaways.join("; ")}.`
          : "Open the lesson and the detail is in the body text."),
      ],
      lessonId: lesson.id,
      offerEscalate: true,
    };
  }

  return {
    paragraphs: [
      "I could not find that in the course material, so I would rather not guess at it.",
      "Send it to Yvonne and she will answer in your Ask the Coach thread.",
    ],
    offerEscalate: true,
    unknown: true,
  };
}

function renderWidget() {
  const host = document.getElementById("widget");
  if (!widget.open) {
    host.innerHTML = `<button class="widget-fab" id="fab" aria-label="Open course assistant"><span>💬</span> Ask a question</button>`;
    document.getElementById("fab").onclick = () => {
      widget.open = true;
      renderWidget();
    };
    return;
  }

  const log = chatLog();
  const isStudent = state.session && state.session.role === "student";
  const bubbles = log
    .map((m) => {
      if (m.from === "you") {
        return `<div class="chat-bubble you">${escapeHtml(m.text)}</div>`;
      }
      const body = m.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      const lesson = m.lessonId ? findLesson(m.lessonId) : null;
      const actions = [];
      if (lesson && isStudent) {
        actions.push(`<button class="chat-action" data-open="${lesson.id}">Open ${escapeHtml(lesson.title)}</button>`);
      }
      if (m.offerEscalate && isStudent && !m.escalated) {
        actions.push(`<button class="chat-action escalate" data-escalate="${escapeHtml(m.about || "")}">Send to Yvonne</button>`);
      }
      if (m.escalated) {
        actions.push(`<span class="chat-sent">Sent to Yvonne ✓</span>`);
      }
      return `<div class="chat-bubble bot">${body}${actions.length ? `<div class="chat-actions">${actions.join("")}</div>` : ""}</div>`;
    })
    .join("");

  const starters = STARTER_PROMPTS.map(
    (p) => `<button class="chat-starter" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`
  ).join("");

  host.innerHTML = `
    <section class="widget-panel" role="dialog" aria-label="Course assistant">
      <header class="widget-head">
        <div>
          <strong>Course assistant</strong>
          <span class="widget-sub">Answers from your ${escapeHtml(state.data.className)} material</span>
        </div>
        <button class="widget-close" id="close-widget" aria-label="Close">×</button>
      </header>
      <div class="widget-body" id="widget-body">
        ${
          log.length
            ? bubbles
            : `<div class="chat-bubble bot"><p>Ask me anything about the ${escapeHtml(state.data.className)} — lessons, deadlines, uploads, or study habits. If I cannot answer it, I will pass it to Yvonne.</p></div>`
        }
        ${log.length ? "" : `<div class="chat-starters">${starters}</div>`}
      </div>
      <div class="widget-foot">
        <input id="chat-input" type="text" placeholder="Type your question…" autocomplete="off" />
        <button class="primary" id="chat-send">Send</button>
      </div>
    </section>
  `;

  bindWidget();
  const body = document.getElementById("widget-body");
  body.scrollTop = body.scrollHeight;
}

function bindWidget() {
  document.getElementById("close-widget").onclick = () => {
    widget.open = false;
    renderWidget();
  };
  const input = document.getElementById("chat-input");
  document.getElementById("chat-send").onclick = () => askBot(input.value);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") askBot(input.value);
  });
  document.querySelectorAll("[data-prompt]").forEach((btn) => {
    btn.onclick = () => askBot(btn.dataset.prompt);
  });
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.onclick = () => {
      state.activeLessonId = btn.dataset.open;
      state.planner = false;
      widget.open = false;
      render();
    };
  });
  document.querySelectorAll("[data-escalate]").forEach((btn) => {
    btn.onclick = () => escalate(btn.dataset.escalate);
  });
  input.focus();
}

function askBot(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return;
  const log = chatLog();
  log.push({ from: "you", text });
  const reply = botReply(text);
  log.push({ from: "bot", ...reply, about: text });
  save();
  renderWidget();
}

function escalate(question) {
  if (!state.session || state.session.role !== "student") return;
  const id = state.session.id;
  const text = question || "A student asked the course assistant for help and wanted this passed on.";
  state.data.messages[id] = thread(id);
  state.data.messages[id].push({
    from: "student",
    kind: "question",
    text,
    at: nowLabel(),
    context: "Course assistant",
  });
  const log = chatLog();
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].from === "bot" && log[i].about === question) {
      log[i].escalated = true;
      break;
    }
  }
  log.push({
    from: "bot",
    paragraphs: [
      "Sent. Yvonne sees this under Questions waiting, and her reply will appear in your Ask the Coach thread.",
    ],
  });
  save();
  render();
  widget.open = true;
  renderWidget();
}

// Calendar entries link back with #lesson=<id>, so honour that on load.
const deepLink = /lesson=([a-z0-9]+)/i.exec(location.hash);
if (deepLink && allLessons().some((l) => l.id === deepLink[1])) state.activeLessonId = deepLink[1];

render();
