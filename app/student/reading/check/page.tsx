import type { Metadata } from "next";
import ReadingCheckFlow from "@/components/reading/ReadingCheckFlow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Reading check · IAC Skills Course",
};

export default function StudentReadingCheckPage() {
  return <ReadingCheckFlow />;
}
