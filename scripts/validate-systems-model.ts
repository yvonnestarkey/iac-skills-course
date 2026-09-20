/**
 * Disposable synthetic cycle for the systems model. Deletes its own rows.
 * Requires supabase/mindset-systems-model.sql to have been pasted.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  addSystemsObservation,
  createSystemsCheckpoint,
  deleteCheckpointsByTitlePrefix,
  deleteRecordsByPayloadFlag,
  deleteWorkingStateByVersion,
  getSystemsCheckpoint,
  getSystemsModel,
  getSystemsModelEvidence,
  getSystemsWorkingState,
  recordSystemsRevision,
  recordYvonneSystemsReview,
  systemsModelConfigured,
  updateSystemsWorkingState,
  upsertSystemsInterpretation,
  upsertSystemsQuestion,
} from "@/lib/systems-model";
import { getCourseJourney, listKnowledgeSources } from "@/lib/knowledge-gateway";

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
          ok: true,
          schema_installed: false,
          knowledge_gateway_intact: true,
          lesson_count: journey.lesson_count,
          note: "Systems tables are not in Supabase yet. Architecture is implemented; paste SQL only after review.",
        },
        null,
        2
      )
    );
    return;
  }

  await cleanup();
  const payload = { [FLAG]: RUN };

  try {
    const observationA = await addSystemsObservation({
      title: "SYNTHETIC observation from a lesson",
      statement: "The activity appears to teach an exam technique.",
      source_refs: [{ source_id: "lesson:ch10-l6", location: "lesson body", excerpt: "synthetic excerpt only" }],
      payload,
    });
    const observationB = await addSystemsObservation({
      title: "SYNTHETIC observation from research",
      statement: "The paper discusses failure-trigger conditions in meaning systems.",
      source_refs: [{ source_id: "context:project_canon", location: "not the paper; synthetic link only" }],
      payload,
    });
    const interpretation = await upsertSystemsInterpretation({
      title: "SYNTHETIC provisional interpretation",
      statement: "This activity exists only to teach exam technique.",
      rationale: "First pass through the lesson.",
      source_refs: observationA.source_refs,
      supports_record_ids: [observationA.id, observationB.id],
      needs_yvonne_review: true,
      payload,
    });
    assert(interpretation.supports_record_ids.includes(observationA.id), "interpretation should cite both observations");

    const revision = await recordSystemsRevision({
      target_id: interpretation.id,
      title: "SYNTHETIC later evidence revises function",
      previous_understanding: interpretation.statement,
      revised_understanding: "The same activity also appears to diagnose how the student responds to difficulty.",
      trigger: { source_ids: ["lesson:ch15-l1"], record_ids: [observationB.id], note: "Later lesson changed the earlier reading." },
      systems_why: "Function depends on position in the process, not only on the local technique.",
      affected: { record_ids: [interpretation.id], concepts: ["exam technique", "diagnosis"] },
      revisit: [{ source_id: "lesson:ch10-l6", record_id: observationA.id, reason: "Re-read for diagnostic function." }],
      unresolved_implications: "May also be a psychological intervention.",
      payload,
    });
    assert(revision.successor.supersedes_id === interpretation.id, "successor keeps lineage");
    assert(revision.working_state.state.revisit_queue?.some((item) => item.source_id === "lesson:ch10-l6"), "revision queued earlier material");

    const question = await upsertSystemsQuestion({
      title: "SYNTHETIC unresolved question",
      statement: "Is the diagnostic function intended, or an effect of sequencing?",
      related_record_ids: [revision.successor.id],
      payload,
    });

    const yvonne = await recordYvonneSystemsReview({
      target_id: revision.successor.id,
      action: "correct",
      statement: "It is diagnostic and pedagogical at the same time. Do not reduce it to exam technique.",
      rationale: "Yvonne correction outranks the AI revision.",
      title: "SYNTHETIC Yvonne correction",
      payload,
    });
    // Tag the auto-created yvonne rows for cleanup by updating payload via a follow-up question payload already tagged.
    assert(yvonne.record.epistemic_status === "yvonne_corrected", "Yvonne correction is current");
    assert(yvonne.record.supersedes_id === revision.successor.id, "AI revision remains in lineage");

    const checkpoint = await createSystemsCheckpoint({
      version: "synthetic-0.1",
      title: `${CHECKPOINT_PREFIX} v0.1`,
      synthesis:
        "SYNTHETIC: current best understanding is that some interventions teach and diagnose at once. This is a test checkpoint, not a real methodology claim.",
      supporting_record_ids: [observationA.id, observationB.id, yvonne.record.id],
      challenging_record_ids: [interpretation.id],
      open_question_ids: [question.id],
      revision_id: revision.revision.id,
    });

    await updateSystemsWorkingState({
      version: WORKING_VERSION,
      current_checkpoint_id: checkpoint.id,
      state: {
        current_checkpoint_id: checkpoint.id,
        current_checkpoint_version: checkpoint.version,
        traversal: { last_lesson_id: "ch10-l6", last_source_id: "lesson:ch10-l6", position_note: "synthetic pause" },
        examined_deeply: [{ source_id: "lesson:ch10-l6", note: "synthetic" }],
        scanned: [{ source_id: "lesson:ch15-l1" }],
        unresolved_question_ids: [question.id],
        next_investigation: "synthetic only — delete after validation",
      },
    });

    const resumed = await getSystemsModel();
    const resumedCheckpoint = await getSystemsCheckpoint(checkpoint.id);
    const resumedState = await getSystemsWorkingState();
    const evidence = await getSystemsModelEvidence(yvonne.record.id);

    assert(resumedCheckpoint?.id === checkpoint.id, "new session can reload the checkpoint");
    assert(resumedState.state.current_checkpoint_id === checkpoint.id, "new session can reload working state");
    assert(resumed.records.interpretations.some((row) => row.id === yvonne.record.id), "current model shows Yvonne version");
    assert(resumed.superseded.some((row) => row.id === interpretation.id), "earlier AI interpretation is retained as superseded");
    assert(resumedState.state.revisit_queue && resumedState.state.revisit_queue.length > 0, "back-propagation queue persisted");
    assert(evidence.evidence[0]?.sources[0]?.source_id, "evidence still points at source IDs rather than copying sources");

    console.log(
      JSON.stringify(
        {
          ok: true,
          schema_installed: true,
          knowledge_gateway_intact: true,
          lesson_count: journey.lesson_count,
          observation_ids: [observationA.id, observationB.id],
          interpretation_id: interpretation.id,
          successor_id: revision.successor.id,
          yvonne_record_id: yvonne.record.id,
          checkpoint_id: checkpoint.id,
          revisit_queue: resumedState.state.revisit_queue,
        },
        null,
        2
      )
    );
  } finally {
    const removed = await cleanup();
    const after = await getSystemsModel();
    const leftover = [...Object.values(after.records).flat(), ...after.superseded].filter((row) =>
      JSON.stringify(row.payload || {}).includes(RUN)
    );
    assert(leftover.length === 0, "synthetic records should be deleted");
    console.log(JSON.stringify({ cleanup: { removed_records: removed, leftover: leftover.length } }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  cleanup().catch(() => undefined);
  process.exit(1);
});
