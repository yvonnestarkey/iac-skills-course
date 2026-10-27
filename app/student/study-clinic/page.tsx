import type { Metadata } from "next";
import StudyClinic from "@/components/student/StudyClinic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Study Clinic · IAC Skills Course",
};

export default function StudentStudyClinicPage() {
  return <StudyClinic />;
}
