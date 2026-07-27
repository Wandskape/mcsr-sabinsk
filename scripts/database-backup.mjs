import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { basename, dirname, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const workspace = resolve(import.meta.dirname, "..")
const backupRoot = resolve(workspace, "backups")
const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
const destination = resolve(
  workspace,
  process.argv[2] ?? `backups/mcsr-sabinsk-${timestamp}.dump`
)
const relativeDestination = relative(backupRoot, destination)

if (
  relativeDestination.startsWith("..") ||
  relativeDestination === "" ||
  basename(destination) === ""
) {
  throw new Error("Backup destination must be a file inside ./backups")
}

mkdirSync(dirname(destination), { recursive: true })
const compose = resolveComposeCommand()
const result = spawnSync(
  compose.command,
  [
    ...compose.prefix,
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "-U",
    process.env.POSTGRES_USER ?? "mcsr",
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    process.env.POSTGRES_DB ?? "mcsr_sabinsk",
  ],
  {
    cwd: workspace,
    encoding: null,
    maxBuffer: 512 * 1024 * 1024,
  }
)

if (result.status !== 0 || !result.stdout?.length) {
  throw new Error(
    `pg_dump failed: ${result.stderr?.toString("utf8") || "empty output"}`
  )
}

writeFileSync(destination, result.stdout, { flag: "wx", mode: 0o600 })
const checksum = createHash("sha256").update(result.stdout).digest("hex")
console.info(`Backup created: ${destination}`)
console.info(`SHA-256: ${checksum}`)

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
