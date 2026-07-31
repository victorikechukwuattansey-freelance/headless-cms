import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Loads a `.env` file into process.env if present. Searches upward from the
 * current working directory so workspace apps find the monorepo root `.env`.
 */
function loadDotEnvFrom(cwd: string = process.cwd()): void {
  const candidates = [cwd, resolve(cwd, "../.."), resolve(cwd, "../../..")];
  for (const dir of candidates) {
    const file = join(dir, ".env");
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    return;
  }
}

loadDotEnvFrom();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16).default("development-only-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  VAULT_MASTER_KEY: z.string().default("base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
  AI_DEFAULT_PROVIDER: z.enum(["ollama", "openai", "anthropic", "gemini"]).default("ollama"),
  AI_FALLBACK_PROVIDER: z.enum(["ollama", "openai", "anthropic", "gemini", "none"]).default("none"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
