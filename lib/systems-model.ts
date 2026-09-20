import { getSupabaseAdmin } from "@/lib/knowledge-gateway-db";
import { getKnowledgeItem, parseKnowledgeId } from "@/lib/knowledge-gateway";
import {
  SYSTEMS_GUARDRAILS,
  currentLineageWinner,
  emptySystemsModel,
  emptyWorkingState,
  mergeRevisitQueue,
  yvonneOutranks,
  type RevisitItem,
  type SourceRef,
  type WorkingStateBody,
} from "@/lib/systems-model-logic";

export type RecordType =
  | "observation"
  | "interpretation"
  | "relationship"
  | "alternative"
  | "question"
  | "revision"
  | "yvonne_review";

export type EpistemicStatus =
  | "source_observation"
  | "ai_hypothesis"
  | "yvonne_confirmed"
  | "yvonne_corrected"
  | "research_supported"
  | "contested"
  | "unresolved_question"
  | "superseded";

export interface SystemsRecord {
  id: string;
  record_type: RecordType;
  epistemic_status: EpistemicStatus;
  lifecycle: "active" | "superseded" | "withdrawn";
  title: string;
  statement: string;
  rationale: string;
  payload: Record<string, unknown>;
  source_refs: SourceRef[];
  supports_record_ids: string[];
  challenges_record_ids: string[];
  related_record_ids: string[];
  supersedes_id: string | null;
  checkpoint_id: string | null;
  needs_yvonne_review: boolean;
  created_by: "ai" | "yvonne";
  created_at?: string;
  updated_at?: string;
}

export interface SystemsCheckpoint {
  id: string;
  version: string;
  status: "current" | "archived";
  title: string;
  synthesis: string;
  model: Record<string, unknown>;
  guardrails: string[];
  supporting_record_ids: string[];
  challenging_record_ids: string[];
  open_question_ids: string[];
  revision_id: string | null;
  replaces_checkpoint_id: string | null;
  created_by: "ai" | "yvonne";
  created_at?: string;
}

export interface SystemsWorkingState {
  id: string;
  version: string;
  status: "current" | "archived";
  current_checkpoint_id: string | null;
  state: WorkingStateBody;
  created_at?: string;
  updated_at?: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asRecord(row: Record<string, unknown>): SystemsRecord {
  return {
    id: String(row.id),
    record_type: row.record_type as RecordType,
    epistemic_status: row.epistemic_status as EpistemicStatus,
    lifecycle: (row.lifecycle as SystemsRecord["lifecycle"]) || "active",
    title: String(row.title || ""),
    statement: String(row.statement || ""),
    rationale: String(row.rationale || ""),
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    source_refs: Array.isArray(row.source_refs) ? (row.source_refs as SourceRef[]) : [],
    supports_record_ids: asStringArray(row.supports_record_ids),
    challenges_record_ids: asStringArray(row.challenges_record_ids),
    related_record_ids: asStringArray(row.related_record_ids),
    supersedes_id: row.supersedes_id ? String(row.supersedes_id) : null,
    checkpoint_id: row.checkpoint_id ? String(row.checkpoint_id) : null,
    needs_yvonne_review: row.needs_yvonne_review === true,
    created_by: row.created_by === "yvonne" ? "yvonne" : "ai",
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function asCheckpoint(row: Record<string, unknown>): SystemsCheckpoint {
  return {
    id: String(row.id),
    version: String(row.version || ""),
    status: row.status === "archived" ? "archived" : "current",
    title: String(row.title || ""),
    synthesis: String(row.synthesis || ""),
    model: row.model && typeof row.model === "object" ? (row.model as Record<string, unknown>) : emptySystemsModel(),
    guardrails: Array.isArray(row.guardrails) ? row.guardrails.map((item) => String(item)) : [...SYSTEMS_GUARDRAILS],
    supporting_record_ids: asStringArray(row.supporting_record_ids),
    challenging_record_ids: asStringArray(row.challenging_record_ids),
    open_question_ids: asStringArray(row.open_question_ids),
    revision_id: row.revision_id ? String(row.revision_id) : null,
    replaces_checkpoint_id: row.replaces_checkpoint_id ? String(row.replaces_checkpoint_id) : null,
    created_by: row.created_by === "yvonne" ? "yvonne" : "ai",
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export function tableMissing(message: string): boolean {
  return /mindset_systems_|schema cache|does not exist/i.test(message);
}

export async function systemsModelConfigured(): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;
  const { error } = await client.from("mindset_systems_records").select("id").limit(1);
  return !error;
}

function requireClient() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export function validateSourceRef(ref: SourceRef): string | null {
  if (!ref?.source_id?.trim()) return "Each source_ref needs a source_id.";
  if (!parseKnowledgeId(ref.source_id) && !/^[a-z0-9]+:.+/i.test(ref.source_id)) {
    return `Unrecognised source_id: ${ref.source_id}`;
  }
  return null;
}

async function insertRecord(input: Partial<SystemsRecord> & { record_type: RecordType; title: string }): Promise<SystemsRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from("mindset_systems_records")
    .insert({
      record_type: input.record_type,
      epistemic_status: input.epistemic_status || "ai_hypothesis",
      lifecycle: input.lifecycle || "active",
      title: input.title,
      statement: input.statement || "",
      rationale: input.rationale || "",
      payload: input.payload || {},
      source_refs: input.source_refs || [],
      supports_record_ids: input.supports_record_ids || [],
      challenges_record_ids: input.challenges_record_ids || [],
      related_record_ids: input.related_record_ids || [],
      supersedes_id: input.supersedes_id || null,
      checkpoint_id: input.checkpoint_id || null,
      needs_yvonne_review: input.needs_yvonne_review === true,
      created_by: input.created_by || "ai",
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Could not save systems record.");
  return asRecord(data as Record<string, unknown>);
}

async function markSuperseded(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("mindset_systems_records")
    .update({ lifecycle: "superseded", epistemic_status: "superseded", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchRecords(ids?: string[]): Promise<SystemsRecord[]> {
  const client = requireClient();
  let query = client.from("mindset_systems_records").select("*").order("created_at", { ascending: true });
  if (ids?.length) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => asRecord(row as Record<string, unknown>));
}

export async function getSystemsRecord(id: string): Promise<SystemsRecord | null> {
  const client = requireClient();
  const { data, error } = await client.from("mindset_systems_records").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asRecord(data as Record<string, unknown>) : null;
}

export async function addSystemsObservation(input: {
  title: string;
  statement: string;
  source_refs: SourceRef[];
  rationale?: string;
  payload?: Record<string, unknown>;
  created_by?: "ai" | "yvonne";
}): Promise<SystemsRecord> {
  if (!input.source_refs?.length) throw new Error("An observation must reference at least one source_id.");
  for (const ref of input.source_refs) {
    const invalid = validateSourceRef(ref);
    if (invalid) throw new Error(invalid);
  }
  return insertRecord({
    record_type: "observation",
    epistemic_status: "source_observation",
    title: input.title,
    statement: input.statement,
    rationale: input.rationale || "",
    source_refs: input.source_refs,
    payload: input.payload || {},
    created_by: input.created_by || "ai",
  });
}

export async function upsertSystemsInterpretation(input: {
  id?: string;
  kind?: "interpretation" | "relationship" | "alternative";
  title: string;
  statement: string;
  rationale?: string;
  epistemic_status?: EpistemicStatus;
  source_refs?: SourceRef[];
  supports_record_ids?: string[];
  challenges_record_ids?: string[];
  related_record_ids?: string[];
  needs_yvonne_review?: boolean;
  payload?: Record<string, unknown>;
  created_by?: "ai" | "yvonne";
}): Promise<SystemsRecord> {
  const kind = input.kind || "interpretation";
  if (input.id) {
    const existing = await getSystemsRecord(input.id);
    if (!existing) throw new Error("Interpretation not found.");
    if (existing.lifecycle !== "active") throw new Error("Cannot update a superseded record. Record a revision.");
    if (yvonneOutranks(existing.epistemic_status) && input.created_by !== "yvonne") {
      throw new Error("Yvonne-confirmed or Yvonne-corrected records cannot be overwritten by AI inference.");
    }
    const client = requireClient();
    const { data, error } = await client
      .from("mindset_systems_records")
      .update({
        title: input.title,
        statement: input.statement,
        rationale: input.rationale ?? existing.rationale,
        source_refs: input.source_refs ?? existing.source_refs,
        supports_record_ids: input.supports_record_ids ?? existing.supports_record_ids,
        challenges_record_ids: input.challenges_record_ids ?? existing.challenges_record_ids,
        related_record_ids: input.related_record_ids ?? existing.related_record_ids,
        needs_yvonne_review: input.needs_yvonne_review ?? existing.needs_yvonne_review,
        payload: input.payload ?? existing.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Could not update interpretation.");
    return asRecord(data as Record<string, unknown>);
  }
  return insertRecord({
    record_type: kind,
    epistemic_status: input.epistemic_status || "ai_hypothesis",
    title: input.title,
    statement: input.statement,
    rationale: input.rationale || "",
    source_refs: input.source_refs || [],
    supports_record_ids: input.supports_record_ids || [],
    challenges_record_ids: input.challenges_record_ids || [],
    related_record_ids: input.related_record_ids || [],
    needs_yvonne_review: input.needs_yvonne_review === true,
    payload: input.payload || {},
    created_by: input.created_by || "ai",
  });
}

export async function upsertSystemsQuestion(input: {
  id?: string;
  title: string;
  statement: string;
  related_record_ids?: string[];
  source_refs?: SourceRef[];
  payload?: Record<string, unknown>;
  resolved?: boolean;
}): Promise<SystemsRecord> {
  if (input.id) {
    const existing = await getSystemsRecord(input.id);
    if (!existing) throw new Error("Question not found.");
    const client = requireClient();
    const { data, error } = await client
      .from("mindset_systems_records")
      .update({
        title: input.title,
        statement: input.statement,
        related_record_ids: input.related_record_ids ?? existing.related_record_ids,
        source_refs: input.source_refs ?? existing.source_refs,
        payload: input.payload ?? existing.payload,
        epistemic_status: input.resolved ? "superseded" : "unresolved_question",
        lifecycle: input.resolved ? "withdrawn" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Could not update question.");
    return asRecord(data as Record<string, unknown>);
  }
  return insertRecord({
    record_type: "question",
    epistemic_status: "unresolved_question",
    title: input.title,
    statement: input.statement,
    related_record_ids: input.related_record_ids || [],
    source_refs: input.source_refs || [],
    payload: input.payload || {},
  });
}

export async function recordSystemsRevision(input: {
  target_id: string;
  title: string;
  previous_understanding?: string;
  revised_understanding: string;
  trigger: { source_ids?: string[]; record_ids?: string[]; note: string };
  systems_why: string;
  affected?: { record_ids?: string[]; concepts?: string[] };
  revisit?: RevisitItem[];
  unresolved_implications?: string;
  needs_yvonne_review?: boolean;
  payload?: Record<string, unknown>;
}): Promise<{ revision: SystemsRecord; successor: SystemsRecord; working_state: SystemsWorkingState }> {
  const target = await getSystemsRecord(input.target_id);
  if (!target) throw new Error("Revision target not found.");
  const successor = await insertRecord({
    record_type: target.record_type === "observation" ? "interpretation" : target.record_type,
    epistemic_status: "ai_hypothesis",
    title: input.title,
    statement: input.revised_understanding,
    rationale: input.systems_why,
    source_refs: target.source_refs,
    supports_record_ids: [...target.supports_record_ids, ...(input.trigger.record_ids || [])],
    related_record_ids: [target.id],
    supersedes_id: target.id,
    needs_yvonne_review: input.needs_yvonne_review === true,
    payload: { ...(input.payload || {}), revision_of: target.id },
  });
  await markSuperseded(target.id);
  const revision = await insertRecord({
    record_type: "revision",
    epistemic_status: "ai_hypothesis",
    title: `Revision: ${input.title}`,
    statement: input.revised_understanding,
    rationale: input.systems_why,
    related_record_ids: [target.id, successor.id],
    source_refs: (input.trigger.source_ids || []).map((source_id) => ({ source_id })),
    payload: {
      previous_understanding: input.previous_understanding || target.statement,
      revised_understanding: input.revised_understanding,
      trigger: input.trigger,
      systems_why: input.systems_why,
      affected: input.affected || {},
      revisit: input.revisit || [],
      unresolved_implications: input.unresolved_implications || "",
      target_id: target.id,
      successor_id: successor.id,
    },
    needs_yvonne_review: input.needs_yvonne_review === true,
  });
  let working = await getSystemsWorkingState();
  if (input.revisit?.length) {
    working = await updateSystemsWorkingState({
      state: mergeRevisitQueue(working.state, input.revisit),
    });
  }
  return { revision, successor, working_state: working };
}

export async function recordYvonneSystemsReview(input: {
  target_id: string;
  action: "confirm" | "correct";
  statement?: string;
  rationale?: string;
  title?: string;
  payload?: Record<string, unknown>;
}): Promise<{ review: SystemsRecord; record: SystemsRecord }> {
  const target = await getSystemsRecord(input.target_id);
  if (!target) throw new Error("Review target not found.");
  const client = requireClient();
  if (input.action === "confirm") {
    const { data, error } = await client
      .from("mindset_systems_records")
      .update({
        epistemic_status: "yvonne_confirmed",
        created_by: "yvonne",
        needs_yvonne_review: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Could not confirm record.");
    const confirmed = asRecord(data as Record<string, unknown>);
    const review = await insertRecord({
      record_type: "yvonne_review",
      epistemic_status: "yvonne_confirmed",
      title: input.title || `Yvonne confirmed: ${target.title}`,
      statement: input.statement || target.statement,
      rationale: input.rationale || "",
      related_record_ids: [target.id],
      created_by: "yvonne",
      payload: { action: "confirm", target_id: target.id, ...(input.payload || {}) },
    });
    return { review, record: confirmed };
  }
  const corrected = await insertRecord({
    record_type: target.record_type,
    epistemic_status: "yvonne_corrected",
    title: input.title || target.title,
    statement: input.statement || target.statement,
    rationale: input.rationale || "",
    source_refs: target.source_refs,
    supports_record_ids: target.supports_record_ids,
    challenges_record_ids: target.challenges_record_ids,
    related_record_ids: [target.id],
    supersedes_id: target.id,
    created_by: "yvonne",
    payload: { action: "correct", target_id: target.id, ...(input.payload || {}) },
  });
  await markSuperseded(target.id);
  const review = await insertRecord({
    record_type: "yvonne_review",
    epistemic_status: "yvonne_corrected",
    title: input.title || `Yvonne corrected: ${target.title}`,
    statement: corrected.statement,
    rationale: input.rationale || "",
    related_record_ids: [target.id, corrected.id],
    created_by: "yvonne",
    payload: { action: "correct", target_id: target.id, successor_id: corrected.id, ...(input.payload || {}) },
  });
  return { review, record: corrected };
}

export async function getCurrentCheckpoint(): Promise<SystemsCheckpoint | null> {
  const client = requireClient();
  const { data, error } = await client.from("mindset_systems_checkpoints").select("*").eq("status", "current").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asCheckpoint(data as Record<string, unknown>) : null;
}

export async function getSystemsCheckpoint(id: string): Promise<SystemsCheckpoint | null> {
  const client = requireClient();
  const { data, error } = await client.from("mindset_systems_checkpoints").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asCheckpoint(data as Record<string, unknown>) : null;
}

export async function createSystemsCheckpoint(input: {
  version: string;
  title: string;
  synthesis: string;
  model?: Record<string, unknown>;
  supporting_record_ids?: string[];
  challenging_record_ids?: string[];
  open_question_ids?: string[];
  revision_id?: string;
  created_by?: "ai" | "yvonne";
}): Promise<SystemsCheckpoint> {
  const client = requireClient();
  const current = await getCurrentCheckpoint();
  if (current) {
    const { error } = await client
      .from("mindset_systems_checkpoints")
      .update({ status: "archived" })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await client
    .from("mindset_systems_checkpoints")
    .insert({
      version: input.version,
      status: "current",
      title: input.title,
      synthesis: input.synthesis,
      model: { ...emptySystemsModel(), ...(input.model || {}) },
      guardrails: [...SYSTEMS_GUARDRAILS],
      supporting_record_ids: input.supporting_record_ids || [],
      challenging_record_ids: input.challenging_record_ids || [],
      open_question_ids: input.open_question_ids || [],
      revision_id: input.revision_id || null,
      replaces_checkpoint_id: current?.id || null,
      created_by: input.created_by || "ai",
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Could not create checkpoint.");
  const checkpoint = asCheckpoint(data as Record<string, unknown>);
  await updateSystemsWorkingState({
    current_checkpoint_id: checkpoint.id,
    state: {
      current_checkpoint_id: checkpoint.id,
      current_checkpoint_version: checkpoint.version,
    },
  });
  return checkpoint;
}

export async function getSystemsWorkingState(): Promise<SystemsWorkingState> {
  const client = requireClient();
  const { data, error } = await client.from("mindset_systems_working_state").select("*").eq("status", "current").maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    return {
      id: String(data.id),
      version: String(data.version),
      status: "current",
      current_checkpoint_id: data.current_checkpoint_id ? String(data.current_checkpoint_id) : null,
      state: { ...emptyWorkingState(), ...(data.state as WorkingStateBody) },
      created_at: data.created_at ? String(data.created_at) : undefined,
      updated_at: data.updated_at ? String(data.updated_at) : undefined,
    };
  }
  const { data: inserted, error: insertError } = await client
    .from("mindset_systems_working_state")
    .insert({
      version: "v0",
      status: "current",
      state: emptyWorkingState(),
    })
    .select("*")
    .maybeSingle();
  if (insertError || !inserted) throw new Error(insertError?.message || "Could not create working state.");
  return {
    id: String(inserted.id),
    version: String(inserted.version),
    status: "current",
    current_checkpoint_id: null,
    state: emptyWorkingState(),
    created_at: inserted.created_at ? String(inserted.created_at) : undefined,
  };
}

export async function updateSystemsWorkingState(input: {
  version?: string;
  current_checkpoint_id?: string | null;
  state?: Partial<WorkingStateBody>;
}): Promise<SystemsWorkingState> {
  const client = requireClient();
  const current = await getSystemsWorkingState();
  const nextState = { ...current.state, ...(input.state || {}) };
  if (input.current_checkpoint_id !== undefined) {
    nextState.current_checkpoint_id = input.current_checkpoint_id;
  }
  const { error: archiveError } = await client
    .from("mindset_systems_working_state")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", current.id);
  if (archiveError) throw new Error(archiveError.message);
  const { data, error } = await client
    .from("mindset_systems_working_state")
    .insert({
      version: input.version || current.version,
      status: "current",
      current_checkpoint_id: input.current_checkpoint_id !== undefined ? input.current_checkpoint_id : current.current_checkpoint_id,
      state: nextState,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Could not update working state.");
  return {
    id: String(data.id),
    version: String(data.version),
    status: "current",
    current_checkpoint_id: data.current_checkpoint_id ? String(data.current_checkpoint_id) : null,
    state: nextState,
    created_at: data.created_at ? String(data.created_at) : undefined,
  };
}

export async function getSystemsModel() {
  const [checkpoint, records, working] = await Promise.all([
    getCurrentCheckpoint(),
    fetchRecords(),
    getSystemsWorkingState(),
  ]);
  const active = currentLineageWinner(records);
  return {
    checkpoint,
    working_state: working,
    guardrails: [...SYSTEMS_GUARDRAILS],
    records: {
      observations: active.filter((row) => row.record_type === "observation"),
      interpretations: active.filter((row) => ["interpretation", "relationship"].includes(row.record_type)),
      alternatives: active.filter((row) => row.record_type === "alternative"),
      questions: active.filter((row) => row.record_type === "question"),
      revisions: records.filter((row) => row.record_type === "revision"),
      yvonne_reviews: records.filter((row) => row.record_type === "yvonne_review"),
    },
    superseded: records.filter((row) => row.lifecycle === "superseded"),
    empty_model_template: emptySystemsModel(),
  };
}

export async function getSystemsModelEvidence(recordId?: string) {
  const model = await getSystemsModel();
  const records = recordId
    ? ([await getSystemsRecord(recordId)].filter(Boolean) as SystemsRecord[])
    : [...model.records.observations, ...model.records.interpretations];
  const unique = new Map(records.map((row) => [row.id, row]));
  const evidence = [];
  for (const record of unique.values()) {
    const sources = [];
    for (const ref of record.source_refs) {
      const item = parseKnowledgeId(ref.source_id) ? await getKnowledgeItem(ref.source_id, 0, 800).catch(() => null) : null;
      sources.push({
        ...ref,
        resolved: Boolean(item),
        source_title: item?.title || null,
        excerpt: ref.excerpt || item?.content?.slice(0, 400) || null,
      });
    }
    evidence.push({ record, sources });
  }
  return { evidence };
}

export async function deleteRecordsByPayloadFlag(flag: string, value: string): Promise<number> {
  const client = requireClient();
  const { data } = await client.from("mindset_systems_records").select("id, payload");
  const ids = (data || [])
    .filter((row) => (row as { payload?: Record<string, unknown> }).payload?.[flag] === value)
    .map((row) => String((row as { id: string }).id));
  if (!ids.length) return 0;
  await client.from("mindset_systems_checkpoints").update({ revision_id: null }).in("revision_id", ids);
  await client.from("mindset_systems_records").update({ supersedes_id: null, checkpoint_id: null }).in("id", ids);
  const { error } = await client.from("mindset_systems_records").delete().in("id", ids);
  if (error) throw new Error(error.message);
  return ids.length;
}

export async function deleteCheckpointsByTitlePrefix(prefix: string): Promise<number> {
  const client = requireClient();
  const { data } = await client.from("mindset_systems_checkpoints").select("id, title");
  const ids = (data || [])
    .filter((row) => String((row as { title?: string }).title || "").startsWith(prefix))
    .map((row) => String((row as { id: string }).id));
  if (!ids.length) return 0;
  await client.from("mindset_systems_working_state").update({ current_checkpoint_id: null }).in("current_checkpoint_id", ids);
  const { error } = await client.from("mindset_systems_checkpoints").delete().in("id", ids);
  if (error) throw new Error(error.message);
  return ids.length;
}

export async function deleteWorkingStateByVersion(version: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.from("mindset_systems_working_state").delete().eq("version", version).select("id");
  if (error) throw new Error(error.message);
  return data?.length || 0;
}
