import type { Metadata } from "next";
import CourseCatalog from "@/components/catalog/CourseCatalog";
import { currentLmsFront } from "@/lib/lms-front";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courses · Accounting Study Advice",
  description: "Accounting Study Advice course catalog.",
};

export default async function CoursesPage() {
  const front = await currentLmsFront();
  return <CourseCatalog front={front} />;
}
