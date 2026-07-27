import { expect, test } from "@playwright/test"

const apiBase = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000/api/v1"
const publicBudgetMs = Number(process.env.E2E_PUBLIC_P95_BUDGET_MS ?? 500)

test("p95 публичного списка турниров укладывается в бюджет", async ({
  request,
}) => {
  await request.get(`${apiBase}/tournaments?limit=20`)
  const durations: number[] = []

  for (let index = 0; index < 20; index += 1) {
    const startedAt = performance.now()
    const response = await request.get(`${apiBase}/tournaments?limit=20`)
    durations.push(performance.now() - startedAt)
    expect(response.ok()).toBeTruthy()
  }

  durations.sort((left, right) => left - right)
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? Infinity
  expect(
    p95,
    `Public tournaments API p95 ${p95.toFixed(1)} ms exceeds ${publicBudgetMs} ms`
  ).toBeLessThan(publicBudgetMs)
})
