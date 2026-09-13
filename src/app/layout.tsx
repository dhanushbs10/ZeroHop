import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { HeaderSlot } from "@/components/header-slot";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zerohop.app";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZeroHop | Peer-to-peer file and text transfer",
    template: "%s | ZeroHop",
  },
  description:
    "Transfer 5GB+ files directly. Peer-to-peer, end-to-end encrypted transfers over WebRTC. Same-network peers route at full local speed with no server in the data path.",
  applicationName: "ZeroHop",
  keywords: [
    "peer to peer",
    "file transfer",
    "p2p",
    "webrtc",
    "end to end encryption",
    "large file transfer",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "ZeroHop",
    title: "ZeroHop | Peer-to-peer file and text transfer",
    description:
      "Transfer 5GB+ files directly. Peer-to-peer, end-to-end encrypted transfers over WebRTC.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c0d10",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <HeaderSlot>
          <SiteHeader />
        </HeaderSlot>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}