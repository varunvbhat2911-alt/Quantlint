import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/common/theme-provider";
import { PreferencesProvider } from "@/hooks/use-preferences";
import { SplashScreen } from "@/components/common/splash-screen";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantLint — Strategy Quality Assurance Platform",
  description: "AI-powered Quality Assurance platform for quantitative trading strategies.",
  icons: {
    icon: "/branding/quantlint-ql-32.png",
    apple: "/branding/quantlint-ql-180.png",
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
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PreferencesProvider>
            <SplashScreen>{children}</SplashScreen>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
