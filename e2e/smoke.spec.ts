import { expect, test } from "@playwright/test"

const apiBase = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000/api/v1"

test("публичная страница и навигация доступны", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle(/MCSR Сабинск/)
  await expect(
    page.getByRole("link", { name: "MCSR Сабинск — главная" })
  ).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Турниры" })).toBeVisible()
})

test("неавторизованного администратора направляет на вход", async ({
  page,
}) => {
  await page.goto("/admin/audit")

  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(
    page.getByRole("heading", { name: "Вход администратора" })
  ).toBeVisible()
  await expect(page.getByLabel("Пароль")).toHaveAttribute("type", "password")
})

test("backend отдаёт health и security headers", async ({ request }) => {
  const response = await request.get(`${apiBase}/health/ready`)

  expect(response.ok()).toBeTruthy()
  expect(response.headers()["x-content-type-options"]).toBe("nosniff")
  expect(response.headers()["x-frame-options"]).toBe("DENY")
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  )
  expect(response.headers()["permissions-policy"]).toContain("camera=()")
  expect(response.headers()["x-powered-by"]).toBeUndefined()
  expect(response.headers()["x-request-id"]).toBeTruthy()
})
