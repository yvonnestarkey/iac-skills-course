import {
  fetchStudentSurveyPacks,
  formatSurveyAnswer,
  isBmcrBlock,
  isInfoBlock,
  questionCollectsAnswer,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyQuestionType,
} from "./custom-surveys";
import { fetchRosterStudent } from "./profiles";
import { onboardingSurveyAnswers } from "./roster";
import type { Student } from "./types";

export type StudentSurveyPack = {
  title: string;
  answers: { label: string; value: string; type: SurveyQuestionType }[];
};

export function studentSurveyPacksFrom(
  student: Student | null,
  packs: { survey: CustomSurvey; response: CustomSurveyResponse }[]
): StudentSurveyPack[] {
  const onboardingAnswers = onboardingSurveyAnswers(student || {});
  return [
    ...(onboardingAnswers.length ? [{ title: "Onboarding", answers: onboardingAnswers }] : []),
    ...packs.map((pack) => ({
      title: pack.survey.title,
      answers: pack.survey.questions
        .filter((question) => questionCollectsAnswer(question.type) && !isInfoBlock(question.type) && !isBmcrBlock(question.type))
        .map((question) => ({
          label: question.label,
          value: pack.response.answers[question.id] || "",
          type: question.type,
        }))
        .filter((item) => formatSurveyAnswer(item.value, item.type)),
    })),
  ];
}

export async function loadStudentSurveyPacks(
  studentId: string
): Promise<{ student: Student | null; packs: StudentSurveyPack[] }> {
  const [student, packs] = await Promise.all([fetchRosterStudent(studentId), fetchStudentSurveyPacks(studentId)]);
  return { student, packs: studentSurveyPacksFrom(student, packs) };
}
