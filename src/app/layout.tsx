import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreferencesSync } from "@/components/ui/Preferences";
import { ServiceWorker } from "@/components/ServiceWorker";
import { PREFERENCES_SCRIPT, THEME_NAMES } from "@/lib/theme";
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
  title: "Checkout — Marqueur de fléchettes",
  description: "Marqueur 501/301 ultra-rapide avec aide au checkout et salles multi-appareils.",
  applicationName: "Checkout",
  appleWebApp: { capable: true, title: "Checkout", statusBarStyle: "default" },
  // favicon.ico is picked up from src/app by convention; the PNG is for browsers preferring larger icons.
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f4f8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-theme={THEME_NAMES.light}
      // The inline script below may switch theme/lang before hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <PreferencesSync />
        <ServiceWorker />
      </body>
    </html>
  );
}
