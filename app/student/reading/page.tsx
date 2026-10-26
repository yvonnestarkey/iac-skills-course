import type { Metadata } from "next";
import ReadingHub from "@/components/reading/ReadingHub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Read the Required · IAC Skills Course",
};

export default function StudentReadingPage() {
  return <ReadingHub />;
}
