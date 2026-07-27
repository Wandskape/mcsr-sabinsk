import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const workspace = resolve(import.meta.dirname, "..")
const backupRoot = resolve(workspace, "backups")
const backupPath = resolve(workspace, process.argv[2] ?? "")
const confirmation = process.argv[3]
const rehearsalDatabase = "mcsr_sabinsk_restore_rehearsal"
const databaseUser = process.env.POSTGRES_USER ?? "mcsr"

if (!process.argv[2] || confirmation !== "--confirm") {
  throw new Error(
    "Usage: pnpm db:restore:rehearsal backups/<file>.dump --confirm"
  )
}
if (relative(backupRoot, backupPath).startsWith("..")) {
  throw new Error("Restore rehearsal accepts files only from ./backups")
}

const archive = readFileSync(backupPath)
const compose = resolveComposeCommand()

try {
  composeRun(["dropdb", "-U", databaseUser, "--if-exists", rehearsalDatabase])
  composeRun(["createdb", "-U", databaseUser, rehearsalDatabase])
  composeRun(
    [
      "pg_restore",
      "-U",
      databaseUser,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "-d",
      rehearsalDatabase,
    ],
    archive
  )
  const result = composeRun([
    "psql",
    "-U",
    databaseUser,
    "-d",
    rehearsalDatabase,
    "-Atc",
    'SELECT count(*) FROM "_prisma_migrations";',
  ])
  const migrationCount = Number(result.stdout.toString("utf8").trim())
  if (!Number.isInteger(migrationCount) || migrationCount < 1) {
    throw new Error("Restored database has no Prisma migrations")
  }
  console.info(
    `Restore rehearsal passed: ${migrationCount} migration records found.`
  )
} finally {
  composeRun(
    ["dropdb", "-U", databaseUser, "--if-exists", rehearsalDatabase],
    undefined,
    true
  )
}

function composeRun(command, input, ignoreFailure = false) {
  const result = spawnSync(
    compose.command,
    [...compose.prefix, "exec", "-T", "postgres", ...command],
    {
      cwd: workspace,
      input,
      encoding: null,
      maxBuffer: 512 * 1024 * 1024,
    }
  )
  if (result.status !== 0 && !ignoreFailure) {
    throw new Error(
      `${command[0]} failed: ${result.stderr?.toString("utf8") || "unknown error"}`
    )
  }
  return result
}

function resolveComposeCommand() {
  const legacy = spawnSync("docker-compose", ["version"], {
    cwd: workspace,
    stdio: "ignore",
  })
  if (legacy.status === 0) {
    return { command: "docker-compose", prefix: [] }
  }

  const plugin = spawnSync("docker", ["compose", "version"], {
    cwd: workspace,
    stdio: "ignore",
  })
  if (plugin.status === 0) {
    return { command: "docker", prefix: ["compose"] }
  }
  throw new Error("Docker Compose is not available")
}
