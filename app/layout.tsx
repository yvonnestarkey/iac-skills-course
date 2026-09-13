import type { Metadata } from "next";
import type { ReactNode } from "react";
import BehindModal from "@/components/BehindModal";
import ChatWidget from "@/components/ChatWidget";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
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
        </StoreProvider>
      </body>
    </html>
  );
}
