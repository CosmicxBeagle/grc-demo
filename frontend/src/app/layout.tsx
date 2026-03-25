import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRC Control Testing Demo",
  description: "Governance, Risk & Compliance — local demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
