import ScriptEvaluatorSteps from "@/components/student/ScriptEvaluatorSteps";

export default function ScriptEvaluatorHub() {
  return (
    <article className="lesson-body wide eval-page">
      <p className="kicker">Script evaluator</p>
      <h1>Diagnostic tools</h1>
      <p className="muted">
        Work through the steps in order. Complete BMCR, Volume vs Accuracy, and Buried Treasure, then upload your mark report. The AI evaluation unlocks only after all four are done.
      </p>
      <ScriptEvaluatorSteps />
    </article>
  );
}
