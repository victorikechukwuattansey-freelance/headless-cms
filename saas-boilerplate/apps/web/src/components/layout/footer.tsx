"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-3 font-semibold">Product</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/features">Features</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/changelog">Changelog</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Company</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
              <li>
                <Link href="/careers">Careers</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Support</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/docs">Documentation</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/status">Status</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Legal</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="text-muted-foreground mt-8 border-t pt-8 text-center text-sm">
          &copy; {new Date().getFullYear()} SaaS Boilerplate. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
