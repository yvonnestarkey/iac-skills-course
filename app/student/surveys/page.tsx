import type { Metadata } from "next";
import StudentSurveyList from "@/components/student/StudentSurveyList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Surveys · IAC Skills Course",
};

export default function StudentSurveysPage() {
  return <StudentSurveyList />;
}
