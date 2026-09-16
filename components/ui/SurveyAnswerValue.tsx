import {
  formatSurveyAnswer,
  parsePdfUploadAnswer,
  type SurveyQuestionType,
} from "@/lib/custom-surveys";

export default function SurveyAnswerValue({
  value,
  type,
}: {
  value?: string;
  type?: SurveyQuestionType;
}) {
  const uploaded = type === "pdf_upload" ? parsePdfUploadAnswer(value) : null;
  if (uploaded) {
    return (
      <a href={uploaded.url} target="_blank" rel="noopener noreferrer">
        {uploaded.name}
      </a>
    );
  }
  return <>{formatSurveyAnswer(value, type) || "—"}</>;
}
