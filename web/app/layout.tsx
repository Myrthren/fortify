import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Fortify — AI co-pilot for online business",
  description:
    "The AI tool for content, networking, and growth. Built for the Fortune Fortress community.",
  icons: { icon: "/fortify-icon.png", apple: "/fortify-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg text-text font-sans">{children}</body>
    </html>
  );
}
