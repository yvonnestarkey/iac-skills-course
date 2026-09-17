import type { Metadata } from "next";
import SalesLanding from "@/components/sales/SalesLanding";

export const metadata: Metadata = {
  title: "IAC Skills Board Course — January 2027 IAC Exam",
  description:
    "The only IAC prep course that gives you individual feedback on YOUR practice questions. Join the waitlist for the January 2027 IAC Exam.",
};

export default function HomePage() {
  return <SalesLanding />;
}
