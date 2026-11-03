"use client";

import { useEffect, useState } from "react";
import {
  diagnosisLabel,
  fetchDiagnosisTypes,
  hasDiagnosis,
  setStudentDiagnosis,
  STUDENT_DIAGNOSIS_TYPES,
  type StudentDiagnosisType,
} from "@/lib/student-diagnoses";

export default function StudentDiagnosesPanel({
  studentId,
  selected,
  onChange,
}: {
  studentId: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [types, setTypes] = useState<StudentDiagnosisType[]>(STUDENT_DIAGNOSIS_TYPES);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDiagnosisTypes().then(setTypes);
  }, []);

  const toggle = async (id: string) => {
    const on = !hasDiagnosis(selected, id);
    setBusy(id);
    setError("");
    const result = await setStudentDiagnosis(studentId, id, on);
    setBusy("");
    if (!result.ok) {
      setError(result.error || "Could not save that diagnosis.");
      return;
    }
    onChange(on ? [...selected, id] : selected.filter((item) => item !== id));
  };

  return (
    <div className="student-diagnoses">
      <p className="student-notes-label">Diagnoses</p>
      <p className="muted small">Issues to work on. Filter the roster by these to find students with the same challenge.</p>
      <div className="diagnosis-pills">
        {types.map((item) => {
          const on = hasDiagnosis(selected, item.id);
          return (
            <button
              key={item.id}
              className={on ? "diagnosis-pill on" : "diagnosis-pill"}
              type="button"
              disabled={Boolean(busy)}
              aria-pressed={on}
              onClick={() => void toggle(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {error ? <p className="muted small">{error}</p> : null}
    </div>
  );
}

export function DiagnosisPills({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="diagnosis-pills profile-diagnosis-pills">
      {ids.map((id) => (
        <span className="diagnosis-pill on" key={id}>
          {diagnosisLabel(id)}
        </span>
      ))}
    </div>
  );
}
