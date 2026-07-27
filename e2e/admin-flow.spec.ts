import { expect, test, type Page } from "@playwright/test"

const username = process.env.E2E_ADMIN_USERNAME
const password = process.env.E2E_ADMIN_PASSWORD
const allowMutations = process.env.E2E_ALLOW_MUTATIONS === "true"

async function login(page: Page) {
  await page.goto("/admin/login")
  await page.getByLabel("Логин").fill(username ?? "")
  await page.getByLabel("Пароль").fill(password ?? "")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("heading", { name: "Панель управления" })
  ).toBeVisible()
}

test("администратор входит и открывает журнал аудита", async ({ page }) => {
  test.skip(!username || !password, "E2E admin credentials are not configured")

  await login(page)
  await page.getByRole("link", { name: "Журнал аудита" }).click()

  await expect(page).toHaveURL(/\/admin\/audit$/)
  await expect(
    page.getByRole("heading", { name: "Журнал аудита" })
  ).toBeVisible()
})

test("администратор создаёт черновик, который появляется в аудите", async ({
  page,
}) => {
  test.skip(
    !username || !password || !allowMutations,
    "Set E2E_ALLOW_MUTATIONS=true only for an isolated test database"
  )

  await login(page)
  await page.getByRole("link", { name: "Турниры" }).click()
  await page.getByRole("button", { name: "Новый турнир" }).click()

  const suffix = Date.now().toString(36)
  await page.getByLabel("Название").fill(`E2E Турнир ${suffix}`)
  await page.getByLabel("Slug").fill(`e2e-${suffix}`)
  await page.getByLabel("Начало, МСК").fill("2027-08-10T18:00")
  await page.getByLabel("Окончание, МСК").fill("2027-08-17T21:00")
  await page
    .getByLabel("Описание")
    .fill("Изолированный турнир автоматического E2E теста.")
  await page.getByRole("button", { name: "Создать черновик" }).click()

  await expect(page.getByText("Турнир создан.")).toBeVisible()
  await page.getByRole("link", { name: "Журнал аудита" }).click()
  await expect(page.getByText("Турнир создан").first()).toBeVisible()
})
