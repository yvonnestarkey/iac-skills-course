import type { Metadata } from "next";
import BuriedTreasureTool from "@/components/BuriedTreasureTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Buried Treasure · IAC Skills Course",
};

export default function StudentBuriedTreasurePage() {
  return <BuriedTreasureTool />;
}
