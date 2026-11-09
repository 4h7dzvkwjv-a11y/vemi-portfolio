import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CanvasBackgroundSync } from "@/components/canvas-background-sync";
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
  title: "VEMI — Viață, Energie, Mișcare",
  description: "Planuri gratuite de antrenament, organizate pe patru săptămâni și alese pentru categoria ta.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/vemi-mark.png",
    shortcut: "/vemi-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  return (
    <html lang="ro">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {supabaseUrl && supabasePublishableKey ? (
          <>
            <meta name="vemi-supabase-url" content={supabaseUrl} />
            <meta
              name="vemi-supabase-publishable-key"
              content={supabasePublishableKey}
            />
          </>
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CanvasBackgroundSync />
        {children}
      </body>
    </html>
  );
}
