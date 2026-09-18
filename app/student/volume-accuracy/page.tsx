import type { Metadata } from "next";
import VolumeAccuracyTool from "@/components/student/VolumeAccuracyTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Volume / Accuracy · IAC Skills Course",
};

export default function StudentVolumeAccuracyPage() {
  return <VolumeAccuracyTool />;
}
