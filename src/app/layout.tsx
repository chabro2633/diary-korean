import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouTube Context Korean - Learn Korean Through Real Context",
  description: "Search Korean expressions in YouTube videos and get AI-powered context analysis with nuances, politeness levels, and cultural notes.",
  keywords: ["Korean learning", "K-drama", "K-pop", "Korean language", "YouTube Korean"],
  openGraph: {
    title: "YouTube Context Korean",
    description: "Learn Korean through real video context with AI analysis",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
