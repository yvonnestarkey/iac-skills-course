import type { Metadata } from "next";
import ScriptEvaluator from "@/components/student/ScriptEvaluator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Script evaluator · IAC Skills Course",
};

export default function StudentEvaluatorPage() {
  return <ScriptEvaluator />;
}
