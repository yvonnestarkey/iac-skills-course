import type { Metadata } from "next";
import SalesLanding from "@/components/sales/SalesLanding";

export const metadata: Metadata = {
  title: "IAC Skills Board Course — January 2027 & June 2027",
  description:
    "The only IAC prep course that gives you individual feedback on YOUR practice questions. Join the waitlist for the January 2027 or June 2027 cohort.",
};

export default function HomePage() {
  return <SalesLanding />;
}
