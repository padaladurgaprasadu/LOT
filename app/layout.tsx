import type { Metadata, Viewport } from "next";
import { SecurityGuard } from "@/components/SecurityGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOT AI",
  description: "Next-generation Sovereign Frontier AI Agent & Code Generation Engine",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-black text-white antialiased">
      <body className="h-[100dvh] w-full bg-black text-white antialiased selection:bg-zinc-800 selection:text-white select-none overflow-hidden touch-manipulation">
        <SecurityGuard>{children}</SecurityGuard>
      </body>
    </html>
  );
}
