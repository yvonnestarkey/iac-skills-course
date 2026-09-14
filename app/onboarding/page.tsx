import type { Metadata } from "next";
import OnboardingForm from "@/components/student/OnboardingForm";
import { skipOnboardingForSession } from "./actions";

export const metadata: Metadata = {
  title: "Welcome · IAC Skills Course",
};

export default function OnboardingPage() {
  return <OnboardingForm skipOnboarding={skipOnboardingForSession} />;
}
