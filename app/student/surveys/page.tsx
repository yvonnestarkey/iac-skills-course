import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Survey & assignment feedback · IAC Skills Course",
};

export default function StudentSurveysPage() {
  redirect("/student/feedback");
}
