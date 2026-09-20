Mindset Sandbox — Project Brief

Continuity checkpoint — 20 September 2026

# 1. North Star

Mindset Sandbox is being developed to capture and scale Yvonne’s educational methodology for accounting candidates. The long-term objective is not an AI that merely sounds like Yvonne, nor primarily an AI marker. The valuable IP is the reasoning system: how observable student evidence becomes hypotheses, Socratic probes, root-cause understanding, interventions and retesting.

Eve is the prospective scalable delivery mechanism. The immediate product is narrower: a teacher-side Script Evaluation / Feedback Generator that reduces repetitive feedback work while generating structured evidence that can later strengthen Eve.

# 2. Core Methodology

The human-facing framework has three interacting pillars: Mindset, Strategy and Skills. Technical accounting knowledge is generally an input students possess to varying degrees; the central problem is often conversion of knowledge into performance.

Core question: What is preventing this student from converting existing capability/knowledge into performance, and what needs to change in how they think, prepare, practise and execute?

Reasoning loop:
OBSERVATION → HYPOTHESIS → SOCRATIC PROBE → STUDENT RESPONSE → CONFIRM / REJECT / REFINE → ROOT CAUSE → INTERVENTION → RETEST

Rules: do not turn an exam weakness automatically into a root-cause diagnosis; a Skills symptom may be sustained by Strategy or Mindset; student self-diagnosis is data, not truth; knowing what to do does not imply ability/willingness to do it; interventions can function as diagnostic experiments; observe first and identify plausible causes second.

# 3. Research Foundation — Mindset Meaning System

Yvonne’s Mindset work is grounded in Carol Dweck’s Mindset Meaning System (MMS): implicit beliefs, goal orientation, effort beliefs and responses to setbacks/failure. The developing accounting-education hypothesis is that some at-risk students may display patterns consistent with fixed-mindset meaning systems, particularly performance-goal orientation, maladaptive interpretations of effort/struggle and helpless responses to setbacks.

The uploaded paper, “Tracing the Pipeline Leak: A Reverse-Diagnostic of the Accounting Student’s Mindset Meaning System,” applies the MMS as a conceptual reverse-diagnostic lens to accounting education. It explicitly distinguishes theoretically suggestive interpretation from causal evidence and identifies the lack of failure-based/performance-stratified accounting mindset research as a major gap.

Key ideas: effort is not the same as struggle; students may work hard while effort produces proportional results, then react differently when effort stops producing expected improvement. The failure-trigger hypothesis suggests mindset divergence may become visible when a challenge is perceived as unmanageable; successful samples may capture “untested optimism” rather than stress-tested beliefs. Eve must never infer “fixed mindset” directly from an observable behaviour.

Research/theory flow:
RESEARCH/THEORY → YVONNE INTERPRETATION → COACHING PRINCIPLE → DIAGNOSTIC RULE → STUDENT-FRIENDLY EXPLANATION → SOCRATIC PROBE → INTERVENTION.

Yvonne presented work on MMS in accounting education at two BAFA academic conferences in 2026 and has a research proposal concerning performance-goal orientation using retrospective BMCR and study-form data. Keep developing hypotheses distinct from established evidence.

# 4. Course Design Philosophy

The Skills course is not primarily technical teaching. It uses accounting questions as environments in which transferable performance Skills are developed. A hidden behavioural curriculum repeatedly exposes students to questions earlier and more often than many would choose.

Question meaning shifts from “a test of whether I am ready” toward “an environment in which I develop a Skill.”

Design rule: AUTOMATE ANALYSIS, NOT LEARNING BEHAVIOURS DELIBERATELY INTENDED FOR THE STUDENT TO PERFORM.

The repeatable study operating system is roughly QUESTION → MARK → BMCR → FIX → MOVE. “Fix” is bounded and prioritised; “Move” prevents waiting for a feeling of mastery.

# 5. Tool 1 — BMCR / Jump in the Pool

“Jump in the Pool” precedes BMCR: authentic performance evidence is required before useful diagnosis. Principle: No diagnosis without behaviour.

The student—not AI—classifies mark-plan points as Basic, Average or Higher Grade because only the student knows what they regard as accessible knowledge.

Basic knowledge available = Basic Markplan ÷ Question Total Markplan. Working course rule: >50% Basic suggests enough theory to pass that question.
Basic Mark Conversion Ratio = Basic My Marks ÷ Basic Markplan. Working threshold: <70% indicates weak conversion.

BMCR does not diagnose the alternative cause; it tests whether broad “I need more theory” is a sufficient explanation. Do not merge Basic/Average/Higher Grade with Direct/Indirect/Thinking case-study proximity.

# 6. Diagnostic Lenses

Volume vs Accuracy separates whether the student generated enough answer points from whether those points were mark-worthy.

Buried Treasure / Case Study Proximity: Direct = explicit scenario facts/givens; Indirect = short bridges from facts to rules; Thinking/Advanced = synthesis, integration, mechanics and judgment.

Application and Communication worksheets decompose vague labels into observable failures such as missed relevance, theory without taking it further, poor structure, tangents, insufficient volume, inaccurate points, misreading the required and time issues. Observation and possible cause must remain separate.

# 7. Script Evaluator — Near-Term Product

Definition: The Script Evaluator uses one past performance to identify the small number of transferable Skills most likely to restrict the student’s ability to turn what they know into marks—then the course makes them practise those Skills through repeated questions.

Task 1 happens first. Student attempts a question and performs their own BMCR. AI can then combine BMCR, marked script, mark report, Volume/Accuracy, Buried Treasure, competency evidence, case/required, solution/mark plan, examiner comments and Skills diagnostic rules.

Prioritise roughly 2–4 evidence-backed transferable patterns, not a metric dump. Keep technical gaps in a smaller targeted-knowledge bucket unless evidence indicates a genuine broader knowledge constraint.

Feedback form: what we see → evidence → why it matters → relevant Skill/Tool → what to do next.

MVP loop: submission → current Task lens → analysis → Yvonne-style draft → Yvonne review/edit → student feedback → next attempt. Potential review controls: Keep / Edit / Remove / Wrong diagnosis.

# 8. Stage-Aware Evaluation

The evaluator must know the current Task. Early Tasks should not over-diagnose Skills not yet taught. Use Current Task Lens + Current Submission + Previous Observations rather than re-diagnosing the whole student each time. Later simulation tests transfer when scaffolding is removed.

# 9. Feedback Knowledge Base

Existing feedback has three layers: task-common feedback; conditional reusable branches; submission-specific feedback.

Near-term engine:
YVONNE FEEDBACK LIBRARY + TASK RULES + STUDENT EVIDENCE → PERSONALISED FEEDBACK DRAFT.

The LLM should not independently invent coaching from scratch.

# 10. Professional Assessment Alignment

SAICA examiner commentary provides an authoritative evidence layer for intended professional-assessment capabilities and recurring candidate breakdowns: application, discursive answers, time management, reading requirements, relevance, concise/logical thinking and examination technique. Genuine technical deficiencies also occur and must not be erased.

Mapping:
SAICA intended competency → SAICA observed failure → observable script evidence → Yvonne Skill/Tool.

# 11. Evidence and Research Programme

Historical student submissions plus Yvonne’s actual feedback are a blind validation opportunity. Preserve raw historical data before cleaning. Separate course completion, observable Skills change and final exam outcome.

A previously reported course result is approximately 75% pass rate among students completing at least 80% of the course. Treat as a promising historical outcome, not causal proof.

Emerging research/product loop:
THEORY → CONSTRUCT → HYPOTHESISED MECHANISM → OBSERVABLE SIGNAL → DIAGNOSTIC PROBE → INTERVENTION → BEHAVIOURAL CHANGE → PERFORMANCE OUTCOME.

Eve should not be designed to prove the methodology. Preserve competing hypotheses and disconfirming evidence.

# 12. Commercial / IP Architecture

Hierarchy:
1. Research foundations
2. Yvonne’s applied Mindset / Strategy / Skills methodology
3. Diagnostic reasoning system
4. Tools and interventions
5. Course implementations
6. AI implementation / Eve

Eve is not the core IP; it is a scalable implementation/delivery mechanism. This matters for future work with professional bodies, universities and education providers, including ICAZ and SAICA.

# 13. Supabase / Technical Status

Existing GPT proxy: iac.accountingstudyadvice.com/api. Existing actions include mark configuration retrieval/update, knowledge-base search and coaching-insight creation.

Known relevant tables include chapters, lessons, knowledge_base, mark_configurations, assignment_bmcr_evaluations, case_study_conversion_logs, mark_report_uploads, script_evaluations, student_submissions and volume_accuracy_entries.

Repository-confirmed course schema:
chapters: id, title, summary, position, created_at.
lessons: id, chapter_id, position, type, title, duration, seconds, blurb, body, takeaways, due, brief, created_at, plus video/PDF/Thinkific/duration/gating/survey/banner/unlock fields.
lessons.chapter_id → chapters.id (text relationship, no FK).
Order: chapters.position, then lessons.position.

Cursor created app/api/course-content/chapters/route.ts and public/openapi.yaml. GET /api/course-content/chapters returns safe course structure metadata only; no body, videos, PDFs, Storage or student rows. Local test: 19 chapters, 142 lessons.

Next: deploy; update/import GPT Action OpenAPI; test operationId listCourseStructure. Then expose selected lesson body/takeaways through a narrow read-only endpoint, followed later by course Storage. Never expose arbitrary SQL, generic table access or service-role credentials.

# 14. Earlier Supabase Caveats

January 2025 mark configuration retrieval previously returned exam metadata but not the expected detailed subquestion configuration. Several qualitative insights were seeded, but API/schema mismatches were observed and competency mappings were not confirmed. Do not claim persistence without verification. Mass seeding was paused until architecture is better understood.

# 15. Immediate Continuation Checklist

1. Deploy Cursor’s course-structure endpoint.
2. Update Mindset Sandbox GPT Action with the new OpenAPI schema.
3. Call listCourseStructure and verify 19 chapters / 142 lessons.
4. Give Cursor a narrow prompt to expose one lesson’s body and takeaways.
5. Systematically map the course.
6. For each Tool/Task reconstruct: research/theory → Yvonne interpretation → coaching principle → intervention → intended behaviour → evidence generated → diagnostic possibilities.
7. Preserve the MMS paper as a foundational research source.
8. Keep the January Script Evaluator MVP separate from full Eve so research ambition does not derail launch.

# 16. Guardrails for the Future Mini-Me

Do not confuse sounding like Yvonne with reasoning like Yvonne.
Do not turn conceptual alignment or correlation into causal diagnosis.
Do not diagnose mindset from a script symptom.
Do not assume more theory is the answer—or that knowledge is never the problem.
Do not automate student behaviours the course deliberately requires them to practise.
Do not bury students in metrics; prioritise actionable transferable patterns.
Do not let AI invent a methodology independently of Yvonne’s course, feedback, transcripts and research.
Preserve disagreement, uncertainty and counterexamples; they are valuable for research and product quality.
