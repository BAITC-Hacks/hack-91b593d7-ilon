import { expect, test } from "@playwright/test";

test("оспорить план: пример → simulate → challenge M5→M3", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");

  await page.getByRole("button", { name: "Перейти к решениям" }).click();
  await page.getByRole("button", { name: "Пример сценария" }).click();
  await expect(page.getByTestId("decision-count")).toHaveText("5 из 5");

  await page.getByTestId("run-simulate").click();
  await expect(page.getByTestId("score-after")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("score-before")).toContainText("52");
  await expect(page.getByTestId("score-after")).toContainText("56");

  await page.getByTestId("challenge-run").click();
  await expect(page.getByTestId("challenge-result")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("challenge-status")).toHaveText("score_improves");
  await expect(page.getByTestId("challenge-removed")).toContainText("M5");
  await expect(page.getByTestId("challenge-removed")).toContainText("Сарыарка");
  await expect(page.getByTestId("challenge-added")).toContainText("M3");
  await expect(page.getByTestId("challenge-added")).toContainText("Нура");
  await expect(page.getByTestId("challenge-score-pair")).toContainText("56");
  await expect(page.getByTestId("challenge-score-pair")).toContainText("57");
  await expect(page.getByTestId("challenge-losses")).toBeVisible();
});
