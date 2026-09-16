// Seed course + cohort data, ported verbatim from the static prototype.
import { shiftISO } from "./dates";
import type { CourseData } from "./types";

export const SEED: CourseData = {
  company: "Accounting Study Advice",
  className: "IAC Skills Course",
  term: "January 2027 cohort",
  cohorts: [
    { id: "jan27", name: "January 2027", starts: "Jan 2027", current: true },
    { id: "jun27", name: "June 2027", starts: "Jun 2027" },
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
      cohort: "jan27",
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
      cohort: "jan27",
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
      cohort: "jan27",
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
      cohort: "jan27",
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
      cohort: "jan27",
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
      cohort: "jun27",
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
      cohort: "jun27",
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
      cohort: "jun27",
      status: "paused",
      joined: "2 Jun 2026",
      lastActive: shiftISO(-48),
      completed: ["c1l1"],
      surveys: {},
      notes: [{ text: "Paused for work commitments, returning for the January 2027 cohort. Keep on roster, exclude from chasing.", at: "20 Jul 2026" }],
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
  communications: [
    {
      id: "n-seed-welcome",
      subject: "Welcome to the January 2027 cohort",
      body: "A short note so you know announcements will land here. Reply if you cannot make Thursday's live session.",
      at: "1 Sep 2026",
      audience: "cohort",
      audienceLabel: "January 2027 · 6 students",
      recipientIds: ["maya", "jordan", "alex", "sam", "priya", "tomas"],
      readBy: ["maya"],
      replies: [
        {
          id: "r-seed-jordan",
          from: "student",
          authorId: "jordan",
          text: "I will be ten minutes late to Thursday — still coming.",
          at: "2 Sep 2026",
        },
      ],
    },
  ],
};
