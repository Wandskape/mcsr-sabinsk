import type { Standing } from "@mcsr-sabinsk/shared"

export type StandingsPresentationRow =
  | { type: "eliminated-divider"; key: "eliminated-divider" }
  | { type: "standing"; key: string; standing: Standing }

export function buildStandingsPresentation(
  standings: Standing[]
): StandingsPresentationRow[] {
  const rows: StandingsPresentationRow[] = []
  let dividerAdded = false

  for (const standing of standings) {
    if (standing.eliminated && !dividerAdded) {
      rows.push({
        type: "eliminated-divider",
        key: "eliminated-divider",
      })
      dividerAdded = true
    }
    rows.push({
      type: "standing",
      key: standing.registrationId,
      standing,
    })
  }

  return rows
}
