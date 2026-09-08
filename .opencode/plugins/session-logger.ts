import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const VAULT_ROOT = process.env.JARVIS_VAULT ?? "C:\\Users\\1040 G8\\Documents\\Brain"
const NOTES_DIR = join(VAULT_ROOT, "01 - Daily Notes")
const TEMPLATE_PATH = join(NOTES_DIR, "Daily Note Template.md")

const loggedSessions = new Set<string>()
const sessionCreatedAt = new Map<string, number>()
const sessionFile = new Map<string, string>()

const pad = (n: number) => String(n).padStart(2, "0")
const nowStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeStamp = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const todayPath = () => join(NOTES_DIR, `${nowStamp(new Date())}.md`)
const sessionFilePattern = (dateStr: string) => new RegExp(`^daily-note-${dateStr}-(.+)\\.md$`)

async function safeLog(client: any, level: string, message: string): Promise<void> {
  try {
    await client?.app?.log?.({ body: { service: "session-logger", level, message } })
  } catch {
    /* never let logging break opencode */
  }
}

function singleLine(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function ensureTodayNote(): string {
  const path = todayPath()
  if (existsSync(path)) return path
  mkdirSync(NOTES_DIR, { recursive: true })
  let content = `# ${nowStamp(new Date())}`
  try {
    const tpl = readFileSync(TEMPLATE_PATH, "utf8")
    content = tpl.replaceAll("{{date:YYYY-MM-DD}}", nowStamp(new Date()))
  } catch {
    /* template missing — minimal scaffold is fine */
  }
  writeFileSync(path, content, "utf8")
  return path
}

function listSessionFiles(dateStr: string): string[] {
  if (!existsSync(NOTES_DIR)) return []
  return readdirSync(NOTES_DIR)
    .filter((f) => sessionFilePattern(dateStr).test(f))
    .map((f) => join(NOTES_DIR, f))
}

/* A reusable session file: either empty (title only) or still holding only the
   template's empty subsections (`### Work Done` / `- ` bullets / `---`). */
function isEmptyScaffold(filePath: string): boolean {
  try {
    const rest = readFileSync(filePath, "utf8").split(/\r?\n/).slice(1)
    const meaningful = rest
      .map((l) => l.trim())
      .filter((l) => l !== "" && l !== "-" && l !== "---" && !/^###\s.+$/.test(l))
    return meaningful.length === 0
  } catch {
    return false
  }
}

/* Pick the daily-note file for the current session: reuse an empty scaffold
   created by the migration, else the next number after the day's highest. */
function resolveSessionFile(dateStr: string): { n: number; path: string } {
  const files = listSessionFiles(dateStr)
  const reuse = files.find(isEmptyScaffold)
  if (reuse) {
    const m = /-(\d+)[a-z]?\.md$/.exec(reuse)
    return { n: m ? parseInt(m[1], 10) : 1, path: reuse }
  }
  let max = 0
  for (const f of files) {
    const m = /-(\d+)[a-z]?\.md$/.exec(f)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const n = max + 1
  return { n, path: join(NOTES_DIR, `daily-note-${dateStr}-${n}.md`) }
}

function ensureSessionFile(sessionID: string): string {
  const dateStr = nowStamp(new Date())
  const { n, path } = resolveSessionFile(dateStr)
  sessionFile.set(sessionID, path)
  if (existsSync(path)) return path
  writeFileSync(path, `# Daily Note — ${dateStr} · Session ${n}\n\n## Auto Log\n\n`, "utf8")
  return path
}

function appendEntry(path: string, entry: string): void {
  if (!existsSync(path)) return
  const existing = readFileSync(path, "utf8")
  const block = "## Auto Log"
  const line = `- ${entry}`
  const next = existing.includes(block)
    ? `${existing.replace(/\s*$/, "")}\n${line}\n`
    : `${existing.replace(/\s*$/, "")}\n\n${block}\n\n${line}\n`
  writeFileSync(path, next, "utf8")
}

async function logSession(client: any, sessionID: string): Promise<void> {
  if (loggedSessions.has(sessionID)) return
  loggedSessions.add(sessionID)

  const entry = await renderEntry(client, sessionID)
  if (!entry) return

  let target = sessionFile.get(sessionID)
  if (!target) {
    const dateStr = nowStamp(new Date())
    const files = listSessionFiles(dateStr)
    target = files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
    if (target) sessionFile.set(sessionID, target)
  }
  if (!target) target = ensureTodayNote()
  appendEntry(target, entry)
}

async function renderEntry(client: any, sessionID: string): Promise<string | null> {
  let session: any = null
  try {
    session = await client.session.get({ path: { id: sessionID } })
  } catch {
    /* session may already be gone — still log a minimal line */
  }

  let messages: any[] = []
  try {
    const res = await client.session.messages({ path: { id: sessionID } })
    messages = Array.isArray(res) ? res : []
  } catch {
    /* best effort */
  }

  const userTexts: string[] = []
  for (const m of messages) {
    if (m?.info?.role !== "user") continue
    const text = (m?.parts ?? [])
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join(" ")
    if (text.trim()) userTexts.push(text)
  }

  const lastPrompt = userTexts.length
    ? ` last prompt: "${singleLine(userTexts[userTexts.length - 1])}"`
    : ""

  const title = singleLine(session?.title ?? "")
  const titlePart = title ? ` — *${title}*` : ""

  const count = messages.length
  const countPart = count > 0 ? ` — ${count} messages` : ""

  const created = session?.time?.created
  let duration = ""
  if (created) {
    const createdMs = Date.parse(created)
    if (!Number.isNaN(createdMs) && createdMs > 0) {
      const mins = Math.round((Date.now() - createdMs) / 60000)
      if (mins < 60) duration = ` — ${mins}m`
      else duration = ` — ${Math.floor(mins / 60)}h ${mins % 60}m`
    }
  }

  const line = `\`${timeStamp(new Date())}\` — \`${sessionID.slice(0, 8)}\`${titlePart}${lastPrompt}${countPart}${duration}`
  return count > 0 ? line : null
}

export const SessionLogger = async ({ client }: { client: any }) => {
  try {
    await safeLog(client, "info", "session-logger initialized")
  } catch {
    /* ignore */
  }
  return {
    event: async ({ event }: { event: any }) => {
      try {
        const sessionID = event?.properties?.sessionID ?? event?.sessionID
        if (!sessionID) return
        if (event.type === "session.created") {
          sessionCreatedAt.set(sessionID, Date.now())
          try {
            ensureTodayNote()
            ensureSessionFile(sessionID)
          } catch (err) {
            await safeLog(client, "error", String(err))
          }
        }
        if (event.type === "session.idle" || event.type === "session.updated") {
          await logSession(client, sessionID)
        }
      } catch (err) {
        await safeLog(client, "error", String(err))
      }
    },
  }
}