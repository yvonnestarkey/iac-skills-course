/**
 * Fixed wording for the student reports (Yvonne, 16 Oct 2026, from her edited PDF). Everything a student reads that is
 * not a table lives here, so the course, the chatbot and the script evaluator all say the same thing.
 */

export const PAPER_HOW_TO_READ = "Each Paper report follows the same five steps, so you can repeat it when you evaluate your own questions.";

export const PAPER_STEPS = [
  {
    key: "rtfq",
    title: "Step 1. RTFQ: did you answer the question?",
    asks: "Did you answer the question that was asked? This looks at three elements - the ‘shape’ of the answer they wanted; the ‘directions’ / instructions you were given; and the ‘lens’ you should’ve used, if there was a specific context or approach. The last column summarises your approach to that element.",
    how: "For each of the three dimensions, write what the question asked for, then judge whether your answer delivered it: yes, partly or no.",
  },
  {
    key: "buried_treasure",
    title: "Step 2. Buried Treasure: did you find the marks hiding in the case?",
    asks: "We categorise marks at three distances from the case study information: ‘Direct’ - the case almost hands you the point. ‘Indirect’ - the case gives a clue, and you must take a step or two. ‘Thinking’ - the case gives very little and you must generate the point.",
    how: "For each mark on the marker's report, ask how big the jump is from a case fact to the point. Count how many you earned at each distance.",
  },
  {
    key: "volume_accuracy",
    title: "Step 3. Volume and Accuracy: how much did you write, and how much of it earned?",
    asks: "Did you write enough points, and did enough of them earn marks? The two work together: the lower your accuracy, the more points you need to write.",
    how: "Count each separate point that you wrote as one volume point. A line that only introduces the points under it is not counted.",
  },
  {
    key: "components",
    title: "Step 4. Components and Core Issue: Did you break the question down? Did you see the red flags?",
    asks: "There are generally various components that need to be dealt with in order to answer the question. They may come from the case study, the required, or the underlying theory - you need to be able to identify these components and deal with them in order to earn marks.\n\nMost questions have a red flag, or some important component that requires more attention. You need to be able to identify issues that should be addressed in more detail, since these will have more marks allocated.",
    how: "list the layers, then for each count: available, recognised (you hunted there), exploited (you earned from it).",
  },
  {
    key: "communication",
    title: "Step 5. Communication: is what you wrote complete on the page?",
    asks: "Is what you wrote clear and complete? This step ignores whether your point was technically correct: it only asks whether what was in your head reached the page. The other steps ask whether it was right.",
    how: "take each point (the same points you counted in Step 3) and ask which of four it is:",
  },
] as const;
export type PaperStepKey = (typeof PAPER_STEPS)[number]["key"];

export const COMMUNICATION_DEFINITIONS = [
  ["Complete", "The thought is finished, and covers the necessary elements to convey the point"],
  ["Underdeveloped", "A partial thought, often a case fact without further explanation. eg: \"There is a risk of misstatement because the directors get performance bonuses\" - this doesn’t explain it is a risk or what could go wrong."],
  ["Miscommunicated", "I can see what you were trying to say, but it didn’t land, or didn’t say what you intended. Eg: Stating theory when you think you’re applying it - \"the client should have revalued the asset\"."],
  ["Unclear", "I cannot tell what you meant, or it makes no sense. \"The directors get bonuses\": is this good or bad?"],
] as const;
export const COMMUNICATION_KEY = "**Most** = more than 60%, **Many** = 40% to 60%, **Some** = 20% to under 40%, **A few** = under 20% (but at least one). A category with no points is not mentioned.";

export const OVERALL_STEPS = {
  bmcr: {
    title: "Step 1. Was theory your problem? (BMCR)",
    asks: "How many marks could your knowledge have earned, and how many did you actually get?",
    how: "Basic marks ÷ total marks = what your knowledge could earn. Marks awarded ÷ Basic marks = how much of it you converted. Enough theory = Basic is at least 50% of total. Converting = you got at least 70% of your Basic marks.",
  },
  type_pillar: {
    title: "Step 2. Question Type and Competency Pillar",
    asks: "What kind of question is each requirement, which SAICA topic area (pillar) does it belong to, and how much did you earn from each type and each pillar?",
    how: "Was it a Discussion (Compliance or non-compliance) or Calculation question? Then name the SAICA competency pillar. The professional marks (PVAAs: communication, critical thinking, integrative thinking, problem solving and the like) are marked separately on the mark report, so they are taken out of the requirements and totalled in their own row. Any pillar under 35% is marked High Risk.",
  },
  evaluation: {
    title: "Step 3. Overall Evaluation",
    intro: "Combining the findings from all three papers, this section identifies the main Skill signals that are costing you the most marks. A 'Signal' is the issue, and the Tool is where you will find the details in each papers’ report. The table shows how many requirements each skill issue shows up in, and lists only the most common issues. This tells us which Skill trends to work on. (If a signal shows up in more than half of the requirements you attempted, it is a very important skill to work on.)",
  },
} as const;

export const SIGNALS_GLOSSARY = `## What do the Signals and Tools mean?

**Buried Treasure: are you using the information in the case study effectively?**
- **Direct** marks are those where the information is explicitly mentioned in the case study, i.e. it could have, or should have, triggered you to deal with it and earn marks.
- **Indirect** marks are where there are one or two steps or inferences you have to make from the information provided in the case study.
- **Thinking** marks are where there was no information in the case study, and you were expected to consider, integrate and synthesise other information to come up with that point.
- **Signals** are given where you weren't able to earn half of the Direct and/or Indirect marks. The Per Paper reports give the breakdown per required. They also show whether we can see that you 'saw' the information, versus whether you 'earned' the marks for it.

**Volume or Accuracy: are you coming up with enough points for the question, and are they accurate?**
- **Volume** indicates whether you were able to generate enough points for the size of the question, i.e. could you generate 10 points for a 10 mark question?
- **Accuracy** indicates how many of the points you generated were valid.
- **Signals** are given separately: a Volume signal when your volume is below 60% for a required, and an Accuracy signal when your accuracy is below 60%. They are different issues.

**RTFQ: are you interpreting what the required asks of you?**
- **Shape** indicates whether you answered what was asked, i.e. you gave a 'critique' if asked, as opposed to an 'explanation'.
- **Direction** indicates whether you followed the specific instructions provided, i.e. include or exclude specific details.
- **Lens** refers to whether there was a specific context you were instructed to deal with, e.g. '... given the going concern issues' requires you to focus on the related implications and context, as opposed to perhaps the ethical issues.
- **Signals** are given where any of the three is not fully delivered.

**Communication: are you getting your thoughts across effectively?**
This tool evaluates your ability to convey a thought effectively. Note that this step IGNORES whether your point was correct or not (we dealt with that earlier). Here we simply focus on your ability to communicate whatever YOU'RE thinking. We evaluate whether your thoughts are:
- **Complete**: properly communicated.
- **Underdeveloped**: you start the thought but don't get to the point, mostly when students 'list' issues instead of explaining them.
- **Miscommunicated**: I can see what you're trying to get to, but you're not communicating properly.
- **Unclear**: your point doesn't make sense or doesn't actually communicate anything.
A **signal** is given where a specific trend is costing you marks across requireds.

**Components and Core Issues: are you breaking down the problem and identifying the 'red flags'?**
Most requireds comprise 'components', provided either in the case study, the required, or the underlying theory. Did you identify and exploit the marks for these? Most problems also have at least one 'core issue' you should have spotted and exploited: a red flag that should have been prioritised (e.g. a fraud indicator, or a highly risky assertion). A **signal** is given when you're not seeing or exploiting components, or core issues, across multiple requireds.`;

/** SAICA exam pillars with their typical exam weightings, in report order. */
export const PILLARS = [
  { name: "Audit & Assurance", weight: "15% to 25%" },
  { name: "Financial Accounting / Reporting (FREP / IFRS)", weight: "15% to 25%" },
  { name: "Strategy, Risk Management & Governance", weight: "10% to 15%" },
  { name: "Management Accounting & Finance", weight: "15% to 25%" },
  { name: "Ethics (including CPC)", weight: "5% to 15%, about 5% to 8%" },
  { name: "Taxation", weight: "15% to 25%" },
] as const;
export const PVAA_ROW = { name: "Effective Communication & PVAAs", weight: "5% to 7.5%" } as const;

/** Case-study names for the report headers, by paper id (June 2026 sitting). */
export const PAPER_NAMES: Record<string, string> = { "iac-2026-p1": "Inpahla", "iac-2026-p2": "Med4Me", "iac-2026-p3": "Beita" };

/** Brand (Yvonne, 16 Oct 2026): teal step headings, dark red part headings, Arial, logo watermark on every page. */
export const BRAND = { teal: "#124f5c", red: "#980000", text: "#212121" } as const;
