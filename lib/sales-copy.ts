import { WAITLIST_COHORTS, type WaitlistCohort } from "./waitlist";

export const SALES_BADGE = "IAC Skills Board Course — January 2027 & June 2027 Cohorts";

export const SALES_HEADLINE = "The only course that gives you individual feedback to build exam skills, not just theory.";

export const SALES_SUBHEAD =
  "The only IAC Prep course that gives you individual feedback on YOUR practice questions. We focus on the Skills you need to turn your knowledge into marks.";

export const SALES_VIDEO = {
  title: "What's costing you marks?",
  src: "https://player.vimeo.com/video/1015651602?badge=0&autopause=0&player_id=0&app_id=58479",
};

export const VALUE_PROPS = [
  {
    title: "Individual Feedback",
    body: "You submit questions, I give you personalised feedback on YOUR question. How and where to improve your communication, application and marks. This is way more than marking — I discuss your answer, your approach, and then give you practical advice to improve it.",
  },
  {
    title: "Step-by-Step Question Methods",
    body: "I give you practical steps to improve your discussion questions, how to structure and plan your answer, and how to decide whether you need more revision. You WILL improve your marks, for ALL topics.",
  },
  {
    title: "BMCR Tool",
    body: "The BMCR (Basic Mark Conversion Ratio) proves whether you need theory or not. It shows you just how much you know, and whether you're getting marks for ANYTHING you know — so you stop defaulting to more revision when the leak is application.",
  },
  {
    title: "Planning Case Studies",
    body: "Task 2 is about planning your case study and required: slowing down, reading instead of browsing, and tagging what the examiner is actually asking before you start writing.",
  },
  {
    title: "Question Misread Prevention",
    body: "RTFQ: Read The F-ing Question. Extra tools for nasty wording, the power of 'thing', and spotting what the examiner is doing so you stop bleeding marks to misreads.",
  },
] as const;

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

export const WAITLIST_COHORT_OPTIONS = WAITLIST_COHORTS;

export function waitlistButtonLabel(cohort: WaitlistCohort): string {
  return `Join the Waitlist for ${cohort.replace(" Cohort", "")}`;
}

export function waitlistSuccessCopy(cohort: WaitlistCohort | string): string {
  return `You're on the list! We will email you as soon as enrollment officially opens for the ${cohort} cohort.`;
}
