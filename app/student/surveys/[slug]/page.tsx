import type { Metadata } from "next";
import StudentSurveyForm from "@/components/student/StudentSurveyForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Survey · IAC Skills Course",
};

export default async function StudentSurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StudentSurveyForm slug={slug} />;
}
