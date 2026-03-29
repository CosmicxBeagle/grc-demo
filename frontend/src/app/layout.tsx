import type { Metadata } from "next";
import "./globals.css";
import MsalProviderWrapper from "@/components/MsalProviderWrapper";

export const metadata: Metadata = {
  title: "GRC Control Testing Platform",
  description: "Governance, Risk & Compliance — Control Testing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <MsalProviderWrapper>{children}</MsalProviderWrapper>
      </body>
    </html>
  );
}
