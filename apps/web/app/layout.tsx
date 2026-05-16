import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hack A Ton 2026 — Agent",
  description: "Live agent demo with real browser and generative artifacts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
