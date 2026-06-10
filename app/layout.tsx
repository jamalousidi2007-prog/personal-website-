import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import LicenseGuard from "@/components/LicenseGuard";
import "./globals.css";

const SITE_URL = "https://jamalousidi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "مشاريع المهندس جمال اوسيدي | ESP32 & IoT",
    template: "%s | مشاريع جمال اوسيدي",
  },
  description:
    "منصة احترافية لمشاريع ESP32 الذكية — محطة طقس، سقي ذكي، مراقبة طاقة، وأمان منزلي. بيانات حية من الحساسات مع رسوم بيانية وتحليلات مباشرة.",
  keywords: [
    "ESP32",
    "IoT",
    "محطة طقس",
    "station meteo",
    "سقي ذكي",
    "smart irrigation",
    "مراقبة طاقة",
    "أمان منزلي",
    "حساسات",
    "sensors",
    "Arduino",
    "Firebase",
    "Next.js",
    "جمال اوسيدي",
    "Jamal Ousidi",
    "Morocco",
    "المغرب",
  ],
  authors: [{ name: "جمال اوسيدي", url: SITE_URL }],
  creator: "جمال اوسيدي",
  publisher: "جمال اوسيدي",
  openGraph: {
    type: "website",
    locale: "ar_MA",
    url: SITE_URL,
    siteName: "مشاريع المهندس جمال اوسيدي",
    title: "مشاريع المهندس جمال اوسيدي | ESP32 & IoT",
    description:
      "منصة احترافية لمشاريع ESP32 الذكية مع بيانات حية من الحساسات وتحليلات مباشرة.",
    images: [{ url: "/images/profile.jpg", width: 800, height: 800, alt: "جمال اوسيدي" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "مشاريع المهندس جمال اوسيدي | ESP32 & IoT",
    description: "منصة احترافية لمشاريع ESP32 الذكية مع بيانات حية من الحساسات.",
    images: ["/images/profile.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مشاريع جمال",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>
          <LicenseGuard>{children}</LicenseGuard>
        </Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "جمال اوسيدي",
              alternateName: "Jamal Ousidi",
              url: SITE_URL,
              image: `${SITE_URL}/images/profile.jpg`,
              jobTitle: "IoT Engineer",
              worksFor: {
                "@type": "Organization",
                name: "ESP32 Projects",
              },
              sameAs: [],
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
