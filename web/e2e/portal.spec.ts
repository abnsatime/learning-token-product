import { expect, test } from "@playwright/test";

test("moves from the landing page to the token console", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/LRN Portal/);
  await expect(page.getByRole("heading", { level: 1, name: "Learning moves onchain." })).toBeVisible();

  await page.getByRole("link", { name: "Open token console" }).click();

  await expect(page).toHaveURL(/#console$/);
  await expect(page.getByRole("heading", { level: 2, name: "A direct line to the contract." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Transfer LRN" })).toBeVisible();
});

test("validates a transfer before opening a wallet", async ({ page }) => {
  await page.goto("/#console");

  await page.getByRole("button", { name: "Review transfer" }).click();

  await expect(page.getByText("Connect a wallet before sending a transfer.")).toBeVisible();
});

test("exposes the verified contract source", async ({ page }) => {
  await page.goto("/");

  const sourceLink = page.getByRole("link", { name: "Exact source match ↗" }).first();
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://sourcify.dev/#/lookup/0xA7de34c97693dDe1d23139a7EAd9fBE17797BE7f",
  );
  await expect(sourceLink).toHaveAttribute("target", "_blank");
});

test("opens the wallet-scoped activity page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "My activity" }).click();

  await expect(page).toHaveURL(/\/me\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your onchain trail." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Connect to reveal your trail." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the primary experience inside the viewport", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Learning moves onchain." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
