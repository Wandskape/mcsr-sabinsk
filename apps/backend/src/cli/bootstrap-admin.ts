import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import argon2 from "argon2"

import { PrismaClient } from "../generated/prisma/client.js"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL не задан.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLocaleLowerCase("ru")
  const password = process.env.ADMIN_PASSWORD
  if (!username || username.length > 64) {
    throw new Error("ADMIN_USERNAME должен содержать от 1 до 64 символов.")
  }
  if (!password || password.length < 12 || password.length > 256) {
    throw new Error("ADMIN_PASSWORD должен содержать от 12 до 256 символов.")
  }
  if (password === "replace-before-seeding") {
    throw new Error("Замените тестовое значение ADMIN_PASSWORD.")
  }

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username },
    select: { username: true },
  })
  if (existingAdmin) {
    throw new Error(
      `Администратор ${existingAdmin.username} уже существует. Пароль не изменён.`
    )
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  })
  const admin = await prisma.adminUser.create({
    data: {
      username,
      passwordHash,
      passwordChangedAt: new Date(),
    },
    select: { username: true },
  })

  console.info(`Администратор ${admin.username} создан.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
