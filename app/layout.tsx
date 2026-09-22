import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import BehindModal from "@/components/BehindModal";
import ChatWidget from "@/components/ChatWidget";
import NotifyComposer from "@/components/NotifyComposer";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://iac.accountingstudyadvice.com"),
  title: "Accounting Study Advice — IAC Skills Course",
  description: "Student learning portal and coach dashboard for the IAC Skills Course.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <div id="app">{children}</div>
          <ChatWidget />
          <BehindModal />
          <NotifyComposer />
        </StoreProvider>
        <Analytics />
      </body>
    </html>
  );
}
