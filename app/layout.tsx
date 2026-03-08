import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import { ClientProviders } from "./helpers/ClientProviders";
import { RuntimeEnvScript } from "./_components/RuntimeEnvScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const insSerif = localFont({
  src: "./assets/fonts/InstrumentSerif-Regular.ttf",
  weight: "500",
  style: "normal",
  variable: "--font-my",
  display: "swap",
});
const insSerifIt = localFont({
  src: "./assets/fonts/InstrumentSerif-Italic.ttf",
  weight: "500",
  style: "Italic",
  variable: "--font-my",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Superblocks",
  description: "Building anything",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <RuntimeEnvScript />
        {/* Google Analytics Scripts */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-244XGR0JJ9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-244XGR0JJ9');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${insSerif.variable} ${insSerifIt.variable} antialiased`}
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
