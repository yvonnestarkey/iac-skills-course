import type { Metadata } from "next";
import SalesLanding from "@/components/sales/SalesLanding";
import { COLD_HEADLINE, COLD_VIDEO } from "@/lib/sales-copy";

const title = COLD_HEADLINE;
const description =
  "A short look at why IAC studying can feel like being cold — and the Skills Board Course that helps you get marks for what you already know.";
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
    url: "/cold",
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

export default function ColdLandingPage() {
  return <SalesLanding headline={COLD_HEADLINE} video={COLD_VIDEO} showHeroPitch={false} />;
}
