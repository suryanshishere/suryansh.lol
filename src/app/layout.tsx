import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({ src: "../../public/fonts/bricolage.woff2", variable: "--font-display", weight: "400 800", display: "swap" });
const body = localFont({ src: "../../public/fonts/dm-sans.woff2", variable: "--font-body", weight: "400 700", display: "swap" });
const hand = localFont({ src: "../../public/fonts/caveat.woff2", variable: "--font-hand", weight: "500 600", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://suryansh.lol"),
  title: { default: "Suryansh Singh — Software & Data Engineer", template: "%s · Suryansh Singh" },
  description: "I turn ideas into things people use. Software and data engineer building web products, reliable data pipelines, and useful tools. Based in Noida, India.",
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg" },
  openGraph: { title: "Suryansh Singh — Ideas into things people use.", description: "Software, data, and a healthy amount of curiosity. Explore my projects and let’s build something useful.", url: "https://suryansh.lol", siteName: "Suryansh Singh", type: "website", locale: "en_IN", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Suryansh Singh — Software and Data Engineer" }] },
  twitter: { card: "summary_large_image", creator: "@suryaalgorithm", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#faf8f2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${body.variable} ${hand.variable}`}><body>{children}</body></html>;
}
