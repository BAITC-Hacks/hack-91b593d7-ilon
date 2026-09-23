import { expect, test } from "@playwright/test";

test("карта районов загружается и показывает данные по клику", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await expect(page.getByTestId("district-map")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("map-select-nura").click();
  await expect(page.getByTestId("map-active-district")).toContainText("Нура");
  await expect(page.getByTestId("district-card-nura")).toBeVisible();
});
