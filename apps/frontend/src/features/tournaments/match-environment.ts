import type { RankedBastionType, RankedSeedType } from "@mcsr-sabinsk/shared"

export interface MatchEnvironmentPresentation {
  label: string
  imageSrc: string | null
}

const UNKNOWN_ENVIRONMENT: MatchEnvironmentPresentation = {
  label: "Неизвестно",
  imageSrc: null,
}

const SEED_TYPE_PRESENTATION: Record<
  RankedSeedType,
  MatchEnvironmentPresentation
> = {
  BURIED_TREASURE: {
    label: "Закопанный клад",
    imageSrc: "/images/seed-type/Buried%20Treasure.png",
  },
  SHIPWRECK: {
    label: "Затонувший корабль",
    imageSrc: "/images/seed-type/Shipwreck.png",
  },
  VILLAGE: {
    label: "Деревня",
    imageSrc: "/images/seed-type/Village.png",
  },
  RUINED_PORTAL: {
    label: "Разрушенный портал",
    imageSrc: "/images/seed-type/Ruined%20Portal.png",
  },
  DESERT_TEMPLE: {
    label: "Пустынный храм",
    imageSrc: "/images/seed-type/Desert%20Temple.png",
  },
}

const BASTION_TYPE_PRESENTATION: Record<
  RankedBastionType,
  MatchEnvironmentPresentation
> = {
  BRIDGE: {
    label: "Bridge",
    imageSrc: "/images/bastion-type/Bridge%20Bastion.png",
  },
  HOUSING: {
    label: "Housing",
    imageSrc: "/images/bastion-type/Housing%20Bastion.png",
  },
  TREASURE: {
    label: "Treasure",
    imageSrc: "/images/bastion-type/Treasure%20Bastion.png",
  },
  STABLES: {
    label: "Stables",
    imageSrc: "/images/bastion-type/Stables%20Bastion.png",
  },
}

export function seedTypePresentation(
  seedType: RankedSeedType | null
): MatchEnvironmentPresentation {
  return seedType ? SEED_TYPE_PRESENTATION[seedType] : UNKNOWN_ENVIRONMENT
}

export function bastionTypePresentation(
  bastionType: RankedBastionType | null
): MatchEnvironmentPresentation {
  return bastionType
    ? BASTION_TYPE_PRESENTATION[bastionType]
    : UNKNOWN_ENVIRONMENT
}
