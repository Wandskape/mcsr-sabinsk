export interface AuditDiffRow {
  path: string
  before: string
  after: string
}

export function auditDiffRows(before: unknown, after: unknown): AuditDiffRow[] {
  const left = flatten(before)
  const right = flatten(after)
  return [...new Set([...left.keys(), ...right.keys()])]
    .sort()
    .filter((path) => left.get(path) !== right.get(path))
    .map((path) => ({
      path,
      before: left.get(path) ?? "—",
      after: right.get(path) ?? "—",
    }))
}

function flatten(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>()
  if (value === null || typeof value !== "object") {
    result.set(prefix || "(значение)", printable(value))
    return result
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) {
    result.set(prefix || "(значение)", Array.isArray(value) ? "[]" : "{}")
  }

  for (const [key, item] of entries) {
    const path = prefix ? `${prefix}.${key}` : key
    const nested = flatten(item, path)
    for (const [nestedPath, nestedValue] of nested) {
      result.set(nestedPath, nestedValue)
    }
  }
  return result
}

function printable(value: unknown): string {
  if (value === undefined) return "—"
  if (typeof value === "string") return value
  return JSON.stringify(value) ?? "—"
}
