"use client";

import { useEvaluatorExam } from "@/lib/use-evaluator-exam";

export default function EvaluatorExamPicker() {
  const { examId, setExamId, sittings } = useEvaluatorExam();

  return (
    <label className="eval-exam-picker">
      Which exam are you going to evaluate?
      <select
        className="select-line"
        value={examId}
        onChange={(event) => setExamId(event.target.value)}
      >
        <option value="">Select an exam</option>
        {sittings.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
