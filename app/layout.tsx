import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SwRegister } from "@/components/sw-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "VielGeld",
  description: "Minimal monthly budget tracker",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

// viewportFit "cover" is what makes env(safe-area-inset-*) non-zero on iOS (bottom nav padding, header top padding).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1f23" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* useSearchParams in Shell/pages needs a Suspense boundary for static export */}
          <Suspense>
            <Shell>{children}</Shell>
          </Suspense>
          <Toaster />
          <SwRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
