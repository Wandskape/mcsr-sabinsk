import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import argon2 from "argon2"

import { PrismaClient } from "../src/generated/prisma/client.js"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim().toLocaleLowerCase("ru")
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password || password === "replace-before-seeding") {
    console.warn(
      "Администратор не создан: задайте ADMIN_USERNAME и безопасный ADMIN_PASSWORD."
    )
    return
  }

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username },
    select: { id: true },
  })
  if (existingAdmin) {
    console.info(
      `Администратор ${username} уже существует — пароль при seed не изменён.`
    )
    return
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  })
  await prisma.adminUser.create({
    data: {
      username,
      passwordHash,
      passwordChangedAt: new Date(),
    },
  })
}

async function seedDemoTournament() {
  if (process.env.SEED_DEMO !== "true") {
    return
  }

  const startsAt = new Date("2026-08-10T15:00:00.000Z")
  const endsAt = new Date("2026-08-17T18:00:00.000Z")

  await prisma.tournament.upsert({
    where: { slug: "kubok-sabinska-1" },
    update: {},
    create: {
      name: "Кубок Сабинска #1",
      slug: "kubok-sabinska-1",
      description:
        "Первый турнир MCSR Сабинск. Выберите дивизион, чтобы увидеть квалификацию.",
      startsAt,
      endsAt,
      status: "UPCOMING",
      divisions: {
        create: [
          {
            type: "BEGINNER",
            displayName: "Новички",
            timeLimitMs: 3_600_000,
            sortOrder: 1,
          },
          {
            type: "EXPERIENCED",
            displayName: "Опытные",
            timeLimitMs: 1_800_000,
            sortOrder: 2,
          },
          {
            type: "PRO",
            displayName: "Про",
            timeLimitMs: 900_000,
            sortOrder: 3,
          },
        ],
      },
    },
  })
}

async function main() {
  await seedAdmin()
  await seedDemoTournament()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
