import type { Metadata } from "next";
import "./globals.css";
import TelemetryProvider from "@/components/TelemetryProvider";

export const metadata: Metadata = {
  title: "GRC Control Testing Platform",
  description: "Governance, Risk & Compliance — Control Testing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {/* TelemetryProvider renders no UI — mounts global error/pageview handlers */}
        <TelemetryProvider />
        {children}
      </body>
    </html>
  );
}
