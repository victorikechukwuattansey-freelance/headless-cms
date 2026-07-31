import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display the hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Build Your SaaS");
  });

  test("should navigate to login", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Sign In");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should navigate to pricing", async ({ page }) => {
    await page.goto("/");
    await page.click("text=View Pricing");
    await expect(page.locator("#pricing")).toBeVisible();
  });
});

test.describe("Authentication", () => {
  test("should show login form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should show register form", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
