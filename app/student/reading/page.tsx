import type { Metadata } from "next";
import ReadingHub from "@/components/reading/ReadingHub";
import ReadingToolGate from "@/components/reading/ReadingToolGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Reading & RTFQ Tool · IAC Skills Course",
};

export default function StudentReadingPage() {
  return (
    <ReadingToolGate>
      <ReadingHub />
    </ReadingToolGate>
  );
}
