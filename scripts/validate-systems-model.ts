/**
 * Disposable synthetic cycle for the systems model. Deletes its own rows.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getCourseJourney, getCourseLessonFull, listKnowledgeSources, searchKnowledge } from "@/lib/knowledge-gateway";
import {
  addSystemsObservation,
  createSystemsCheckpoint,
  deleteCheckpointsByTitlePrefix,
  deleteRecordsByPayloadFlag,
  deleteWorkingStateByVersion,
  getSystemsCheckpoint,
  getSystemsModel,
  getSystemsRecord,
  getSystemsWorkingState,
  lineageFor,
  recordSystemsRevision,
  recordYvonneSystemsReview,
  systemsModelConfigured,
  updateSystemsWorkingState,
  upsertSystemsInterpretation,
  upsertSystemsQuestion,
} from "@/lib/systems-model";

const FLAG = "test_run_id";
const RUN = "synthetic-systems-model-validation";
const CHECKPOINT_PREFIX = "SYNTHETIC systems checkpoint";
const WORKING_VERSION = "synthetic-validation";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  await deleteCheckpointsByTitlePrefix(CHECKPOINT_PREFIX);
  const removed = await deleteRecordsByPayloadFlag(FLAG, RUN);
  await deleteWorkingStateByVersion(WORKING_VERSION);
  return removed;
}

async function main() {
  loadEnvLocal();
  const gatewaySources = await listKnowledgeSources();
  const journey = await getCourseJourney();
  assert((gatewaySources.sources.find((item) => item.source_type === "lesson")?.count || 0) === journey.lesson_count, "knowledge gateway still matches live course");

  if (!(await systemsModelConfigured())) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          schema_installed: false,
          knowledge_gateway_intact: true,
          lesson_count: journey.lesson_count,
          note: "Paste supabase/mindset-systems-model.sql, then re-run npm run validate:systems-model.",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  await cleanup();
  const payload = { [FLAG]: RUN };

  const multi = journey.chapters.flatMap((chapter) => chapter.lessons).find((lesson) => lesson.videos.some((video) => video.transcript_available));
  const full = await getCourseLessonFull(String(multi?.id || "ch10-l6"));
  const transcriptId = full?.transcripts[0]?.id;
  const research = await searchKnowledge({ query: "Tracing the Pipeline Leak", source_type: "research", limit: 3 });
  const researchId = research.items.find((item) => item.source_type === "research")?.id;
  assert(full?.id, "need a live lesson");
  assert(transcriptId, "need a live transcript gateway ID");
  assert(researchId, "need a live research gateway ID");
  const lessonId = `lesson:${full.id}`;

  try {
    const observation = await addSystemsObservation({
      title: "SYNTHETIC observation from a lesson",
      statement: "On first reading the activity looks like an exam technique.",
      source_refs: [{ source_id: lessonId, location: "lesson", excerpt: "synthetic excerpt only" }],
      payload,
    });
    assert(observation.source_refs[0].source_id === lessonId, "A: observation uses a gateway lesson ID");

    const interpretation = await upsertSystemsInterpretation({
      title: "SYNTHETIC multi-source interpretation",
      statement: "This activity exists only to teach exam technique.",
      rationale: "First pass. Not owned by the lesson; the lesson is one source among others.",
      source_refs: [
        { source_id: lessonId, location: "course architecture" },
        { source_id: transcriptId, location: "video transcript" },
        { source_id: researchId, location: "research paper chunk" },
      ],
      supports_record_ids: [observation.id],
      payload,
    });
    const sourceTypes = new Set(interpretation.source_refs.map((ref) => ref.source_type || ref.source_id.split(":")[0]));
    assert(sourceTypes.has("lesson") && sourceTypes.has("transcript") && sourceTypes.has("kb"), "B: one interpretation cites lesson + transcript + research");
    assert(!("lesson_id" in interpretation), "B: interpretation is not parented to a lesson");

    const firstCheckpoint = await createSystemsCheckpoint({
      version: "synthetic-0.1",
      title: `${CHECKPOINT_PREFIX} v0.1`,
      synthesis: "SYNTHETIC first house: the activity currently looks like exam technique. Not a real methodology claim.",
      supporting_record_ids: [observation.id, interpretation.id],
      informed_by_record_ids: [observation.id, interpretation.id],
      working_state_version: WORKING_VERSION,
    });
    assert(firstCheckpoint.informed_by_record_ids.includes(interpretation.id), "C: checkpoint is informed by the interpretation");
    assert((firstCheckpoint.provenance.source_ids as string[])?.includes(lessonId), "C: checkpoint provenance keeps source IDs");

    const revision = await recordSystemsRevision({
      target_id: interpretation.id,
      title: "SYNTHETIC later evidence revises function",
      previous_understanding: interpretation.statement,
      revised_understanding: "The same activity also appears to diagnose how the student responds to difficulty.",
      trigger: { source_ids: ["lesson:ch15-l1"], record_ids: [observation.id], note: "Later lesson changed the earlier reading." },
      systems_why: "Function depends on position in the process, not only on the local technique.",
      revisit: [{ source_id: lessonId, record_id: observation.id, reason: "Re-read for diagnostic function." }],
      unresolved_implications: "May also be psychological.",
      working_state_version: WORKING_VERSION,
      payload,
    });
    const original = await getSystemsRecord(interpretation.id);
    assert(original?.lifecycle === "superseded", "D: earlier interpretation is superseded");
    assert(original?.epistemic_status === "ai_hypothesis", "E: original remains an AI hypothesis, not rewritten as superseded-status");
    assert(revision.successor.supersedes_id === interpretation.id, "E: successor points at the old understanding");
    assert(revision.working_state.state.revisit_queue?.some((item) => item.source_id === lessonId), "F: earlier source is on the revisit queue");

    const question = await upsertSystemsQuestion({
      title: "SYNTHETIC unresolved question",
      statement: "Is the diagnostic function intended, or an effect of sequencing?",
      related_record_ids: [revision.successor.id],
      payload,
    });

    const yvonne = await recordYvonneSystemsReview({
      target_id: revision.successor.id,
      action: "confirm",
      statement: revision.successor.statement,
      rationale: "Yvonne confirms the revised systems reading.",
      title: "SYNTHETIC Yvonne confirmation",
      payload,
    });
    const aiRevised = await getSystemsRecord(revision.successor.id);
    assert(aiRevised?.epistemic_status === "ai_hypothesis", "G: the AI hypothesis is still stored as an AI hypothesis");
    assert(aiRevised?.lifecycle === "superseded", "G: the AI hypothesis is marked superseded, not edited into a confirmation");
    assert(yvonne.record.epistemic_status === "yvonne_confirmed", "G: confirmation is a later record");
    assert(yvonne.record.supersedes_id === revision.successor.id, "G: confirmation points at the AI record");
    assert(yvonne.review.payload.from_epistemic_status === "ai_hypothesis", "G: review stores AI → Yvonne transition");
    const chain = await lineageFor(yvonne.record.id);
    assert(chain.map((row) => row.id).join(",") === `${interpretation.id},${revision.successor.id},${yvonne.record.id}`, "G: lineage is hypothesis → revision → Yvonne");

    await updateSystemsWorkingState({
      version: WORKING_VERSION,
      state: {
        examined_deeply: [{ source_id: lessonId, note: "synthetic deep read" }],
        scanned: [{ source_id: "lesson:ch15-l1" }],
        unresolved_question_ids: [question.id],
        next_investigation: "synthetic only",
      },
    });

    const currentCheckpoint = await createSystemsCheckpoint({
      version: "synthetic-0.2",
      title: `${CHECKPOINT_PREFIX} v0.2`,
      synthesis: "SYNTHETIC current house: some interventions teach and diagnose. Confirmed by Yvonne in the test lineage only.",
      supporting_record_ids: [observation.id, yvonne.record.id],
      challenging_record_ids: [interpretation.id],
      open_question_ids: [question.id],
      informed_by_record_ids: [observation.id, interpretation.id, revision.revision.id, revision.successor.id, yvonne.record.id, yvonne.review.id, question.id],
      revision_id: revision.revision.id,
      working_state_version: WORKING_VERSION,
    });

    const resumed = await getSystemsModel();
    const resumedCheckpoint = await getSystemsCheckpoint(currentCheckpoint.id);
    const resumedState = await getSystemsWorkingState();
    assert(resumedCheckpoint?.id === currentCheckpoint.id, "H: fresh session loads current checkpoint");
    assert(resumedState.state.current_checkpoint_id === currentCheckpoint.id, "H: working state points at current checkpoint");
    assert(resumedState.state.revisit_queue && resumedState.state.revisit_queue.length > 0, "H: revisit queue survived later working-state updates");
    assert((resumedState.history || []).length >= 2, "H: earlier working-state versions remain");
    assert(resumed.lineage?.[yvonne.record.id]?.length === 3, "H: session can reconstruct how the current interpretation was reached");
    assert((resumedCheckpoint?.provenance.source_ids as string[] || []).includes(lessonId), "H: checkpoint provenance still lists the informing sources");

    console.log(
      JSON.stringify(
        {
          ok: true,
          schema_installed: true,
          knowledge_gateway_intact: true,
          lesson_count: journey.lesson_count,
          source_ids: { lessonId, transcriptId, researchId },
          source_types: [...sourceTypes],
          lineage: chain.map((row) => ({ id: row.id, status: row.epistemic_status, lifecycle: row.lifecycle })),
          checkpoint_provenance: resumedCheckpoint?.provenance,
          revisit_queue: resumedState.state.revisit_queue,
        },
        null,
        2
      )
    );
  } finally {
    const removed = await cleanup();
    const after = await getSystemsModel();
    const leftover = [...Object.values(after.records).flat(), ...after.superseded].filter(
      (row) => JSON.stringify(row.payload || {}).includes(RUN) || /SYNTHETIC/i.test(row.title)
    );
    const leftoverWorking = (after.working_state.history || []).filter(
      (row) => row.version === WORKING_VERSION || /synthetic/i.test(String(row.version || ""))
    );
    assert(leftover.length === 0, "synthetic records should be deleted");
    assert(leftoverWorking.length === 0, "synthetic working-state rows should be deleted");
    console.log(JSON.stringify({ cleanup: { removed_records: removed, leftover: leftover.length, leftover_working: leftoverWorking.length } }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  cleanup().catch(() => undefined);
  process.exit(1);
});
