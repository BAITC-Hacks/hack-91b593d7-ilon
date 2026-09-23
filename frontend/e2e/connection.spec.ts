import { expect, test } from "@playwright/test";

test("страница показывает полученные от backend данные", async ({ page, request }) => {
  const healthResponse = await request.get("/api/health");
  const catalogResponse = await request.get("/api/catalog");
  expect(healthResponse.ok()).toBeTruthy();
  expect(catalogResponse.ok()).toBeTruthy();
  const health = await healthResponse.json();
  const catalog = await catalogResponse.json();
  expect(health.ai_provider).toBe("demo");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Аким на 5 часов" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await expect(page.getByTestId("dataset-version")).toHaveText(health.dataset);
  await expect(page.getByTestId("ai-mode")).toHaveText("Демонстрационный");
  await expect(page.getByTestId("district-count")).toHaveText(String(catalog.city.districts.length));
  await expect(page.getByTestId("intervention-count")).toHaveText(String(catalog.city.interventions.length));
});

test("ошибка каталога видна пользователю и повторный запрос восстанавливает страницу", async ({ page }) => {
  await page.route("**/api/catalog", (route) => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ error: "Сервер временно недоступен." }),
  }));
  await page.goto("/");
  const connectionError = page.getByRole("region", { name: "Подключение к серверу" }).getByRole("alert");
  await expect(connectionError).toHaveText("Сервер временно недоступен.");
  await expect(page.getByRole("status")).toHaveText("Нет связи с сервером");

  await page.unroute("**/api/catalog");
  await page.getByRole("button", { name: "Повторить попытку" }).click();
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await expect(connectionError).toHaveCount(0);
});

test("узкий экран сохраняет доступность проверки подключения", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Сервер подключён");
  await expect(page.getByRole("button", { name: "Проверить ещё раз" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
