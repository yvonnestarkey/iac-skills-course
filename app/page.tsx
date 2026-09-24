import type { Metadata } from "next";
import SalesLanding from "@/components/sales/SalesLanding";

const title = "IAC Skills Board Course — January 2027 IAC Exam";
const description =
  "The only IAC prep course that gives you individual feedback on YOUR practice questions. Start the Free Preview for the January 2027 IAC Exam.";
const shareImage = {
  url: "/iac-jan-2027-skills-board-course.png",
  width: 760,
  height: 420,
  alt: "IAC January 2027 Skills Board Course",
};

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Accounting Study Advice",
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage.url],
  },
};

export default function HomePage() {
  return <SalesLanding />;
}
