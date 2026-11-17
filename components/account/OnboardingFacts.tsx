import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";
import type { SurveyQuestionType } from "@/lib/custom-surveys";

export default function OnboardingFacts({
  answers,
}: {
  answers: { label: string; value: string; type: SurveyQuestionType }[];
}) {
  if (!answers.length) {
    return <p className="muted small">No onboarding answers yet.</p>;
  }
  return (
    <dl className="fact-list">
      {answers.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <SurveyAnswerValue value={item.value} type={item.type} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
