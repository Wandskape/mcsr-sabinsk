import { BadRequestException } from "@nestjs/common"

import { TournamentStatus } from "../../generated/prisma/enums.js"

const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  [TournamentStatus.DRAFT]: [TournamentStatus.UPCOMING],
  [TournamentStatus.UPCOMING]: [TournamentStatus.QUALIFICATION],
  [TournamentStatus.QUALIFICATION]: [
    TournamentStatus.PLAYOFF,
    TournamentStatus.COMPLETED,
  ],
  [TournamentStatus.PLAYOFF]: [TournamentStatus.COMPLETED],
  [TournamentStatus.COMPLETED]: [],
}

export function assertValidDateRange(startsAt: Date, endsAt: Date) {
  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new BadRequestException(
      "Дата окончания должна быть позже даты начала."
    )
  }
}

export function assertStatusTransition(
  currentStatus: TournamentStatus,
  nextStatus: TournamentStatus
) {
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new BadRequestException(
      `Переход из статуса ${currentStatus} в ${nextStatus} не разрешён.`
    )
  }
}

export function participatingDivisionIds(
  divisions: Array<{ id: string; registrationCount: number }>
) {
  const participating = divisions
    .filter((division) => division.registrationCount > 0)
    .map((division) => division.id)

  if (participating.length === 0) {
    throw new BadRequestException(
      "Для начала квалификации добавьте участников хотя бы в один дивизион."
    )
  }

  return participating
}
