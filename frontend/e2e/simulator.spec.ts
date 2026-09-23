import { expect, test } from "@playwright/test";

test("полный сценарий: город → пример → расчёт Score", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await expect(page.getByTestId("baseline-score")).toBeVisible();

  await page.getByRole("button", { name: "Принять управленческие решения" }).click();
  await expect(page.getByRole("heading", { name: "Сформируйте план развития" })).toBeVisible();

  await page.getByRole("button", { name: "Пример сценария" }).click();
  await expect(page.getByTestId("decision-count")).toHaveText("5 из 5");
  await expect(page.getByTestId("run-simulate")).toBeEnabled();

  await page.getByTestId("run-simulate").click();
  await expect(page.getByTestId("score-after")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("score-before")).toContainText("52");
  await expect(page.getByTestId("score-after")).toContainText("56");
  await page.getByTestId("explain-toggle").click();
  await expect(page.getByTestId("explain-content")).toBeVisible();
});
