import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "@/providers/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SaaS Boilerplate - Launch Your SaaS Fast",
    template: "%s | SaaS Boilerplate",
  },
  description:
    "Production-ready Next.js SaaS boilerplate with authentication, payments, teams, and more.",
  keywords: ["saas", "boilerplate", "nextjs", "startup", "subscription"],
  openGraph: {
    title: "SaaS Boilerplate",
    description: "Launch your SaaS product in hours, not weeks.",
    url: "https://saas.com",
    siteName: "SaaS Boilerplate",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaaS Boilerplate",
    description: "Launch your SaaS product in hours, not weeks.",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL("https://saas.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
