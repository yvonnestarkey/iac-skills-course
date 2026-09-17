import { WAITLIST_EXAMS, type WaitlistExam } from "./waitlist";

export const SALES_BADGE = "IAC Skills Board Course — January 2027 IAC Exam";

export const SALES_HEADLINE =
  "The only course that gives you individual feedback to build exam skills for the IAC exam, to help you get marks for your knowledge.";

export const SALES_AUDIENCE = "Suitable for SAICA, ICAZ, and ICAN candidates";

export const SALES_SUBHEAD =
  "The only IAC Prep course that gives you individual feedback on YOUR practice questions. We focus on the Skills you need to turn your knowledge into marks.";

export const SALES_VIDEO = {
  title: "What's costing you marks?",
  src: "https://player.vimeo.com/video/1015651602?badge=0&autopause=0&player_id=0&app_id=58479",
};

export const COURSE_FEATURES = [
  {
    title: "Submit Tasks & Get Individual Feedback",
    body: "You'll submit questions, and we'll give you feedback on YOUR attempt and how to improve your marks.",
    icon: "pen",
  },
  {
    title: "Step-by-Step Methods to Improve Application & Communication",
    body: "I'll give you practical tools to improve your answers. I'll show you HOW to improve your discussion questions, and the planning of your answers to get you the marks you deserve.",
    icon: "wrench",
  },
  {
    title: "One-on-One Sessions",
    body: "Online one-on-ones to help you with the stuff YOU'RE struggling with.",
    icon: "mic",
  },
  {
    title: "Script Evaluation Tools",
    body: "Script Evaluation Tools to help you evaluate the areas you need to work on for past attempts, both Skills and Topics.",
    icon: "clipboard",
  },
  {
    title: "Live Sessions",
    body: "General Feedback on tasks and exam technique. Motivation and encouragement.",
    icon: "video",
  },
  {
    title: "On-Demand Online Course",
    body: "Work through the content at your own pace.",
    icon: "laptop",
  },
  {
    title: "Study Guidance",
    body: "Study advice to help you reduce stress, improve performance, and approach your study sessions more effectively.",
    icon: "compass",
  },
] as const;

export const COURSE_SKILLS = [
  {
    title: "BMCR Tool: How to calculate whether you need revision",
    detail: "Diagnostic tool to quantify whether you lack theory or application skill.",
  },
  {
    title: "Skill: Planning your case study",
    detail: "How to index and structure scenario information during reading time.",
  },
  {
    title: "Skill: Reading the question (RTFQ)",
    detail: "Eliminating misread errors that cost up to 10% of available marks.",
  },
  {
    title: "Skill: Discussion Questions",
    detail: "Frameworks to structure discussion points clearly for full marks.",
  },
  {
    title: "Skill: Strategic Thinking",
    detail: "Staying mark-focused to secure pass marks under exam pressure.",
  },
  {
    title: "Skill: Structuring & Planning your Answer",
    detail: "Knowing what details to cover vs. what to leave out.",
  },
  {
    title: "Marking Tool: Improving Application & Communication",
    detail: "Self-marking methods to refine communication quality.",
  },
  {
    title: "Performance Tool: How to calm down on demand",
    detail: "Stress-management techniques to prevent exam freeze/panic.",
  },
] as const;

export const COURSE_DATES = {
  kicker: "Course Dates",
  title: "When does the course run?",
  body: "Official start end-October 2026, running until the exam in January. Students can start the course as soon as it's launched to allow more time to practice the Skills they'll learn here.",
} as const;

export const PRICING_TIERS = [
  {
    id: "once-off" as const,
    kicker: "Option 1",
    title: "Full Upfront Payment",
    price: "$327",
    detail: "Approx. R5,300 once-off",
    body: "Single payment for complete, unrestricted course access.",
  },
  {
    id: "installments" as const,
    kicker: "Option 2",
    title: "6-Month Installment Plan",
    price: "$60 / month",
    detail: "for 6 months (Approx. R970/mo)",
    body: "Fixed 6-month payment plan. Same full course access starting immediately upon registration.",
  },
] as const;

export const REFERRAL = {
  title: "Study Together & Save!",
  body: "We offer special referral discounts when you sign up with a peer or study group. Refer a friend, and both of you get an exclusive discount code at checkout! If you want to enrol a group of students from your firm, email me for rates.",
} as const;

export const FAQS = [
  {
    question: "Why is this course different?",
    answer:
      "This is the only IAC prep course that gives you individual feedback on YOUR practice questions. Other board courses spend more time on theory and classes. Here we take a deep dive into exam technique, communication, and building confidence in the knowledge you already have — so you get marks for what you do know.",
  },
  {
    question: "Why do we focus on individual feedback?",
    answer:
      "When I see your questions, it's a lot easier for me to evaluate what you need to work on and give you practical advice to improve it. This is way more than marking. I discuss your answer, your communication, your application, your approach, your understanding, and then provide guidance, advice or additional content to help you improve whatever you need to.",
  },
  {
    question: "How long is the course?",
    answer:
      "You need to work through 6 Skills and submit questions for each of them, plus a sim exam. 6 weeks is the shortest you can complete this and get value from it. Most students do a task a week. Live sessions run every two weeks (and every week closer to the exam), so even if you're finished the questions, the course is still running. You must have time after the course to make the Skills yours before you write.",
  },
  {
    question: "Will this help me pass?",
    answer:
      "Students pass when they do the work: submit questions, use the feedback, and practise the Skills until they are normal under stress. I will always help students who are putting the effort in. I often add students back to the next exam course for free if they worked this sitting and need another attempt. If they have done no questions and haven't touched the course, they need to pay for future access. I want you to pass NOW — so let's do the work together.",
  },
  {
    question: "When does the course start?",
    answer:
      "The course is on-demand, so you can work at your own pace. There is a live session in mid-October, and the January 2027 course will officially start the last week of October 2026. Latest registration is early to mid-December 2026.",
  },
  {
    question: "What about CTA content?",
    answer:
      "The course does NOT cover CTA / PGDA content. Students are either repeaters who have completed other courses or have just completed PGDA — either way, you have TONS of subject-matter and revision and questions. What you need are the Skills to get marks for all this. The questions and explanations use past IAC questions across all your subjects.",
  },
] as const;

export const WAITLIST_COHORT_OPTIONS = WAITLIST_EXAMS;

export function waitlistButtonLabel(exam: WaitlistExam): string {
  return `Join the Waitlist for ${exam}`;
}

export function waitlistSuccessCopy(_exam?: WaitlistExam | string): string {
  return "You're on the list! We will email you as soon as registration officially opens for the January 2027 IAC Exam.";
}
