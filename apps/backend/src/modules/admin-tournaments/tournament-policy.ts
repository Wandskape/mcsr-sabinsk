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
