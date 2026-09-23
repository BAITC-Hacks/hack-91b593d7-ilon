import { expect, test } from "@playwright/test";

async function openExampleResult(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await page.getByRole("button", { name: "Принять управленческие решения" }).click();
  await page.getByRole("button", { name: "Пример сценария" }).click();
  await page.getByTestId("run-simulate").click();
  await expect(page.getByTestId("score-after")).toBeVisible({ timeout: 20_000 });
}

test("этап 9: шепли, событие, история и экспорт", async ({ page }) => {
  test.setTimeout(120_000);
  await openExampleResult(page);

  await expect(page.getByTestId("history-list")).toBeVisible();
  await expect(page.getByTestId("export-bar")).toBeVisible();
  await expect(page.getByTestId("export-markdown")).toBeVisible();

  await page.getByTestId("events-select").selectOption("heatwave-nura");
  await expect(page.getByTestId("events-overlay")).toBeVisible();
  await expect(page.getByTestId("events-official-score")).toContainText("56");
  await expect(page.getByTestId("events-edu-score")).toBeVisible();

  await page.getByTestId("shapley-run").click();
  await expect(page.getByTestId("shapley-result")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("shapley-sum")).toBeVisible();
  await expect(page.getByTestId("shapley-row-M5")).toBeVisible();
});
