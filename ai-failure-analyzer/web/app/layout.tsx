import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "AI Failure Analyzer",
  description:
    "Upload AI agent logs and get a root cause analysis of why the agent failed, with recommended fixes.",
};

const NAV = [
  { href: "/", label: "Landing" },
  { href: "/upload", label: "Upload Logs" },
  { href: "/reports", label: "Reports" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <header className="sticky top-0 z-10 border-b border-border bg-surface">
          <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3.5">
            <Link href="/" className="text-sm font-bold">
              AI<span className="text-accent">FailureAnalyzer</span>
            </Link>
            <div className="ml-auto flex gap-5 text-sm text-muted">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          AI Failure Analyzer &mdash; local-first MVP &middot; logs are redacted
          before storage
        </footer>
      </body>
    </html>
  );
}
