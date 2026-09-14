import type { Metadata } from "next";
import OnboardingForm from "@/components/student/OnboardingForm";

export const metadata: Metadata = {
  title: "Welcome · IAC Skills Course",
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
