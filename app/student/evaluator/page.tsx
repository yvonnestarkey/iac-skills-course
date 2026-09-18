import type { Metadata } from "next";
import ScriptEvaluatorHub from "@/components/student/ScriptEvaluatorHub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Script evaluator · IAC Skills Course",
};

export default function StudentEvaluatorPage() {
  return <ScriptEvaluatorHub />;
}
