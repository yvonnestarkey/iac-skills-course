import type { Metadata } from "next";
import BmcrDiagnosticTool from "@/components/student/BmcrDiagnosticTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "BMCR · IAC Skills Course",
};

export default function StudentBmcrPage() {
  return <BmcrDiagnosticTool />;
}
