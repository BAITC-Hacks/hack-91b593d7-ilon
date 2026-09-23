import { expect, test, type Page } from "@playwright/test";

async function openExampleResult(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await page.getByRole("button", { name: "Принять управленческие решения" }).click();
  await page.getByRole("button", { name: "Пример сценария" }).click();
  await page.getByTestId("run-simulate").click();
  await expect(page.getByTestId("score-after")).toBeVisible({ timeout: 20_000 });
}

test("demo-совет показывает три оценки и три ответа", async ({ page }) => {
  await openExampleResult(page);
  const score = await page.getByTestId("score-after").textContent();

  await page.getByRole("button", { name: "Слушать совет" }).click();
  await expect(page.getByTestId("council-mode")).toHaveText("Программная демонстрация");
  await expect(page.getByTestId("council-review")).toHaveCount(3);
  await expect(page.getByTestId("council-reply")).toHaveCount(3);
  await expect(page.getByText("Обсуждение завершено.")).toBeVisible();
  await expect(page.getByTestId("score-after")).toHaveText(score || "");
});

test("ошибка AI не скрывает Score и позволяет повторить запрос", async ({ page }) => {
  await openExampleResult(page);
  const score = await page.getByTestId("score-after").textContent();
  await page.route("**/api/council/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: [
        JSON.stringify({ type: "mode", data: { provider: "demo" } }),
        JSON.stringify({ type: "error", data: { message: "Совет временно недоступен.", provider: "demo" } }),
        "",
      ].join("\n"),
    });
  });

  await page.getByRole("button", { name: "Слушать совет" }).click();
  await expect(page.getByTestId("council-panel").getByRole("alert")).toHaveText("Совет временно недоступен.");
  await expect(page.getByRole("button", { name: "Повторить совет" })).toBeEnabled();
  await expect(page.getByTestId("score-after")).toHaveText(score || "");

  await page.unroute("**/api/council/stream");
  await page.getByRole("button", { name: "Повторить совет" }).click();
  await expect(page.getByTestId("council-reply")).toHaveCount(3);
  await expect(page.getByTestId("score-after")).toHaveText(score || "");
});

test("обрыв NDJSON сообщает об ошибке и сохраняет Score", async ({ page }) => {
  await openExampleResult(page);
  const score = await page.getByTestId("score-after").textContent();
  await page.route("**/api/council/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "mode", data: { provider: "demo" } })}\n`,
    });
  });

  await page.getByRole("button", { name: "Слушать совет" }).click();
  await expect(page.getByTestId("council-panel").getByRole("alert")).toContainText("Соединение с советом прервалось");
  await expect(page.getByTestId("score-after")).toHaveText(score || "");
});

test("422 показывает detail backend и сохраняет Score", async ({ page }) => {
  await openExampleResult(page);
  const score = await page.getByTestId("score-after").textContent();
  await page.route("**/api/council/stream", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Сценарий недопустим.", code: "invalid_scenario" }),
    });
  });

  await page.getByRole("button", { name: "Слушать совет" }).click();
  await expect(page.getByTestId("council-panel").getByRole("alert")).toHaveText("Сценарий недопустим.");
  await expect(page.getByTestId("score-after")).toHaveText(score || "");
});
