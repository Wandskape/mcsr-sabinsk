import { describe, expect, it } from "vitest"

import {
  bastionTypePresentation,
  seedTypePresentation,
} from "./match-environment"

describe("match environment presentation", () => {
  it("maps the Ranked world type to a Russian label and bundled icon", () => {
    expect(seedTypePresentation("SHIPWRECK")).toEqual({
      label: "Затонувший корабль",
      imageSrc: "/images/seed-type/Shipwreck.png",
    })
  })

  it("keeps bastion names in English", () => {
    expect(bastionTypePresentation("STABLES")).toEqual({
      label: "Stables",
      imageSrc: "/images/bastion-type/Stables%20Bastion.png",
    })
  })

  it("uses a safe fallback for old matches without metadata", () => {
    expect(seedTypePresentation(null)).toEqual({
      label: "Неизвестно",
      imageSrc: null,
    })
    expect(bastionTypePresentation(null)).toEqual({
      label: "Неизвестно",
      imageSrc: null,
    })
  })
})
