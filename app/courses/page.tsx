import type { Metadata } from "next";
import CourseCatalog from "@/components/catalog/CourseCatalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courses · Accounting Study Advice",
  description: "Accounting Study Advice course catalog.",
};

export default function CoursesPage() {
  return <CourseCatalog />;
}
