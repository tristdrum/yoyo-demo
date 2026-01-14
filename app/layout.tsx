import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Surprise & Delight Loyalty Rules Builder",
  description: "Admin demo for Surprise & Delight loyalty rule orchestration."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${fraunces.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
