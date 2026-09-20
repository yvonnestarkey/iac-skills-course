Mindset Sandbox — Continuation Document

*Working continuation from the 20 September 2026 continuity checkpoint*

# 1. Purpose of this continuation

This document picks up directly from the saved Project Brief. It is deliberately narrower than the full project history: its job is to preserve the next working state so development can continue without reconstructing the methodology from scratch.

# 2. Current working position

The immediate build priority remains the teacher-side Script Evaluation / Feedback Generator, while Eve remains the longer-term Socratic delivery mechanism. The evaluator should reduce repetitive feedback work, preserve Yvonne’s diagnostic reasoning, and create structured evidence that can later strengthen Eve.

The system must reason from observable evidence toward hypotheses and probes rather than jumping from a script symptom to a root-cause diagnosis. Mindset, Strategy and Skills remain interacting lenses; technical knowledge is neither assumed to be the problem nor ruled out.

# 3. Non-negotiable distinctions

- __BMCR vs case-study proximity: __Basic / Average / Higher Grade is the student’s classification of knowledge accessibility. Direct / Indirect / Thinking is a separate classification of how close a mark is to the case-study evidence. Never merge the two.
- __Observation vs diagnosis: __A missed mark, weak application, low volume or poor conversion is evidence. It is not by itself a root cause.
- __Mindset evidence: __Do not infer a fixed mindset directly from behaviour. Use the Mindset Meaning System as a hypothesis-generating lens and test interpretations through Socratic probing.
- __Automation boundary: __Automate analysis and repetitive teacher work, not learning behaviours deliberately intended for the student to practise.
- __Research boundary: __Keep conceptual alignment, correlation and developing hypotheses separate from causal evidence.

# 4. Script Evaluator — working architecture

Task 1 precedes meaningful evaluation: the student attempts the question and performs their own BMCR. The evaluator can then combine the marked script, mark report, BMCR, Volume/Accuracy, Buried Treasure, competency evidence, case/required, solution or mark plan, examiner commentary and the Skills diagnostic rules.

The output should prioritise roughly 2–4 evidence-backed transferable patterns rather than produce a metric dump. Technical gaps should normally sit in a smaller, targeted-knowledge bucket unless the evidence supports a broader knowledge constraint.

Preferred feedback chain: What we see → Evidence → Why it matters → Relevant Skill/Tool → What to do next.

# 5. Stage-aware evaluation rule

Every evaluation must know the student’s current Task. Use Current Task Lens + Current Submission + Previous Observations. Do not repeatedly re-diagnose the whole student and do not penalise early-task students for Skills that have not yet been taught. Later simulations should test whether the Skill transfers when scaffolding is removed.

# 6. Course-mapping programme

The next substantive knowledge-engineering task is to map the course systematically. For each Tool or Task, reconstruct the chain below and preserve the evidence source for each link:

Research/Theory → Yvonne Interpretation → Coaching Principle → Intervention → Intended Behaviour → Evidence Generated → Diagnostic Possibilities

This mapping should become the bridge between course content, historical feedback, examiner evidence and Eve’s future Socratic diagnostics. The LLM should retrieve and reason over this material rather than independently inventing coaching methodology.

# 7. Supabase / API continuation

1. Deploy the narrow course-structure endpoint already created in Cursor.
2. Update/import the GPT Action OpenAPI schema.
3. Call listCourseStructure and verify the expected course structure (checkpoint expectation: 19 chapters / 142 lessons).
4. Expose selected lesson body and takeaways through a narrow read-only endpoint.
5. Begin systematic course mapping from the returned structure and approved lesson fields.
6. Only later consider controlled course Storage access; do not expose arbitrary SQL, generic table access or service-role credentials.

# 8. Supabase persistence caution

Do not assume that an analysis has persisted merely because an API call appeared to succeed. Earlier work showed schema/API mismatches, including incomplete January 2025 mark-configuration detail and unconfirmed competency mappings. Verify reads after writes. Mass seeding should remain controlled until the architecture and fields are confirmed.

# 9. Past-paper distillation protocol

When a past paper is processed, the intended workflow is dual: first re-classify mark allocations using the three-tier Case Study Proximity framework; second extract reusable qualitative coaching insights.

For each sub-question, Direct + Indirect + Thinking/Advanced + macro communication marks must reconcile to total marks. Qualitative insights should capture the exact scenario fact candidates miss, why it is easy to overlook, why it is required for the answer premise, and the binary Socratic probe that can test the omission.

Competency mapping should connect the sub-question and insight to the relevant professional competency framework where the underlying mapping is actually available and verified.

# 10. Research thread to preserve

The MMS paper remains a foundational research source. The important developing hypotheses include the distinction between effort and struggle, the possibility that mindset divergence becomes more visible under perceived unmanageable challenge, and the possibility that successful samples can reflect untested optimism. These are research hypotheses and interpretive lenses, not student diagnoses.

# 11. January MVP boundary

Protect the Script Evaluator MVP from expansion into the full Eve research programme. The near-term product only needs enough structured methodology, course context and evidence handling to produce a strong Yvonne-style draft for teacher review. Review controls such as Keep / Edit / Remove / Wrong diagnosis can simultaneously improve feedback quality and generate labelled evidence for later development.

# 12. Recommended next working session

Resume at the technical checkpoint rather than reopening the conceptual architecture: verify the course-structure Action first. Once the structure is accessible, select one Tool/Task and perform a complete end-to-end mapping using the course lesson, Yvonne feedback/rules and any relevant research source. Use that single mapped example to define the reusable schema before attempting bulk mapping.

# 13. Continuity guardrails

- Reason like Yvonne; do not merely imitate tone.
- No diagnosis without behaviour/evidence.
- Preserve alternative explanations and disconfirming evidence.
- Do not automate the student’s intended learning behaviour.
- Prioritise a small number of actionable transferable patterns.
- Keep Direct/Indirect/Thinking separate from Basic/Average/Higher Grade.
- Verify persistence and competency mappings before claiming they are stored.
- Keep the Script Evaluator MVP separate from full Eve.

*Source basis: Mindset Sandbox — Project Brief, continuity checkpoint dated 20 September 2026.*
