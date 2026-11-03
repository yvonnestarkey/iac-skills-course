import { getSupabase } from "./supabase";

export const STUDENT_DIAGNOSES_SQL_HINT =
  "Paste supabase/student-diagnoses.sql in the Supabase SQL editor, then try again.";

export type StudentDiagnosisType = {
  id: string;
  label: string;
};

export const STUDENT_DIAGNOSIS_TYPES: StudentDiagnosisType[] = [
  { id: "rtfq", label: "RTFQ" },
  { id: "case-study-reading", label: "Case Study Reading" },
];

function tableMissing(message: string): boolean {
  return /student_diagnos|does not exist|schema cache|could not find/i.test(message);
}

function diagnoseError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return STUDENT_DIAGNOSES_SQL_HINT;
  }
  return message || "Could not update that diagnosis.";
}

export function normalizeDiagnosisId(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function diagnosisLabel(id: string, types: StudentDiagnosisType[] = STUDENT_DIAGNOSIS_TYPES): string {
  const needle = normalizeDiagnosisId(id);
  return types.find((item) => item.id === needle)?.label || id;
}

export function mergeDiagnosisTypes(extra: StudentDiagnosisType[] = []): StudentDiagnosisType[] {
  const seen = new Map<string, StudentDiagnosisType>();
  [...STUDENT_DIAGNOSIS_TYPES, ...extra].forEach((item) => {
    const id = normalizeDiagnosisId(item.id);
    if (!id) return;
    if (!seen.has(id)) seen.set(id, { id, label: String(item.label || "").trim() || id });
  });
  return [...seen.values()];
}

export function hasDiagnosis(ids: string[] | null | undefined, diagnosisId: string): boolean {
  const needle = normalizeDiagnosisId(diagnosisId);
  return (ids || []).some((id) => normalizeDiagnosisId(id) === needle);
}

export async function fetchDiagnosisTypes(): Promise<StudentDiagnosisType[]> {
  const client = getSupabase();
  if (!client) return [...STUDENT_DIAGNOSIS_TYPES];
  const { data, error } = await client.from("student_diagnosis_types").select("id, label").order("position");
  if (error) return [...STUDENT_DIAGNOSIS_TYPES];
  return mergeDiagnosisTypes(
    (data || []).map((row) => ({ id: String(row.id), label: String(row.label || "") }))
  );
}

export async function fetchDiagnosesByStudent(): Promise<Record<string, string[]>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.from("student_diagnoses").select("student_id, diagnosis_id");
  if (error) return {};
  const map: Record<string, string[]> = {};
  (data || []).forEach((row) => {
    const studentId = String(row.student_id || "");
    const diagnosisId = normalizeDiagnosisId(String(row.diagnosis_id || ""));
    if (!studentId || !diagnosisId) return;
    const list = map[studentId] || [];
    if (!list.includes(diagnosisId)) list.push(diagnosisId);
    map[studentId] = list;
  });
  return map;
}

export async function setStudentDiagnosis(
  studentId: string,
  diagnosisId: string,
  on: boolean
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const id = normalizeDiagnosisId(diagnosisId);
  if (!studentId || !id) return { ok: false, error: "Choose a diagnosis first." };
  if (on) {
    const { error } = await client.from("student_diagnoses").upsert(
      { student_id: studentId, diagnosis_id: id },
      { onConflict: "student_id,diagnosis_id" }
    );
    if (error) return { ok: false, error: diagnoseError(error.message) };
    return { ok: true };
  }
  const { error } = await client.from("student_diagnoses").delete().eq("student_id", studentId).eq("diagnosis_id", id);
  if (error) return { ok: false, error: diagnoseError(error.message) };
  return { ok: true };
}
