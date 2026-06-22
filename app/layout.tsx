import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  applicationName: "FeedFM",
  title: {
    default: "FeedFM — AI radio for the internet",
    template: "%s | FeedFM",
  },
  description: "Turn Reddit and X feeds into AI-generated radio broadcasts.",
  keywords: ["FeedFM", "AI radio", "Reddit RSS", "X API", "OpenAI", "broadcast"],
  authors: [{ name: "FeedFM" }],
  creator: "FeedFM",
  publisher: "FeedFM",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FeedFM — AI radio for the internet",
    description: "Turn Reddit and X feeds into AI-generated radio broadcasts.",
    url: "/",
    siteName: "FeedFM",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FeedFM broadcast console",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FeedFM — AI radio for the internet",
    description: "Turn Reddit and X feeds into AI-generated radio broadcasts.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
