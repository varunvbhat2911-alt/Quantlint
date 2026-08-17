import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/common/theme-provider";
import { PreferencesProvider } from "@/hooks/use-preferences";
import { SplashScreen } from "@/components/common/splash-screen";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantLint — Strategy Quality Assurance Platform",
  description: "AI-powered Quality Assurance platform for quantitative trading strategies.",
  icons: {
    icon: "/branding/quantlint-ql-32.png",
    apple: "/branding/quantlint-ql-180.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QuantLint",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#fcfcfc" media="(prefers-color-scheme: light)" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PreferencesProvider>
            <SplashScreen>{children}</SplashScreen>
            <ServiceWorkerRegistration />
            <InstallPrompt />
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
