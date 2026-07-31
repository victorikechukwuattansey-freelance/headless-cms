import { chromium } from "playwright";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "screenshots");

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const BASE = "http://localhost:3000";

async function shot(page, url, name) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("Capturing screenshots...");

  // Public pages
  await shot(page, BASE, "landing");
  await shot(page, `${BASE}/pricing`, "pricing");
  await shot(page, `${BASE}/auth/login`, "login");
  await shot(page, `${BASE}/auth/register`, "register");

  // Login as admin to capture dashboard pages
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@saas.com");
  await page.fill('input[type="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Dashboard pages
  await shot(page, `${BASE}/dashboard`, "dashboard");
  await shot(page, `${BASE}/billing`, "billing");
  await shot(page, `${BASE}/team`, "team");
  await shot(page, `${BASE}/settings`, "settings");
  await shot(page, `${BASE}/api-keys`, "api-keys");
  await shot(page, `${BASE}/invoices`, "invoices");
  await shot(page, `${BASE}/notifications`, "notifications");
  await shot(page, `${BASE}/support`, "support");
  await shot(page, `${BASE}/usage`, "usage");

  // Admin panel
  await shot(page, `${BASE}/admin`, "admin-overview");
  await shot(page, `${BASE}/admin/users`, "admin-users");
  await shot(page, `${BASE}/admin/subscriptions`, "admin-subscriptions");
  await shot(page, `${BASE}/admin/feature-flags`, "admin-feature-flags");
  await shot(page, `${BASE}/admin/audit-logs`, "admin-audit-logs");

  await browser.close();
  console.log("\nDone — all screenshots saved to screenshots/");
}

main().catch((e) => {
  console.error("Screenshot failed:", e.message);
  process.exit(1);
});
