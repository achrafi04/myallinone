import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MyAllInOneTracker",
  description: "Gym + Water + Weight + Notes",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b0f19",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
