const SECRET_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /sk-ant-[A-Za-z0-9_-]{20,}/g, label: 'Anthropic API key' },
  { regex: /sk-[A-Za-z0-9_-]{20,}/g, label: 'OpenAI API key' },
  { regex: /AIza[0-9A-Za-z_-]{35}/g, label: 'Google API key' },
  { regex: /AKIA[0-9A-Z]{16}/g, label: 'AWS access key ID' },
  { regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g, label: 'Slack token' },
  { regex: /gh[pousr]_[A-Za-z0-9]{30,}/g, label: 'GitHub token' },
  { regex: /github_pat_[A-Za-z0-9_]{20,}/g, label: 'GitHub personal access token' },
  { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, label: 'Private key block' },
  { regex: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/gi, label: 'Bearer token' },
  {
    regex:
      /\b(?:api[_-]?key|apikey|secret|secret[_-]?key|token|access[_-]?token|password|passwd|authorization)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi,
    label: 'Credential',
  },
];

const MAX_FIELD_CHARS = 4000;

function redactString(input: string, counts: Map<string, number>): string {
  let out = input;
  for (const { regex, label } of SECRET_PATTERNS) {
    let matches: RegExpMatchArray | null;
    regex.lastIndex = 0;
    while ((matches = regex.exec(out)) !== null) {
      const start = matches.index!;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      const redacted = `[REDACTED:${label}]`;
      out = out.slice(0, start) + redacted + out.slice(start + matches[0].length);
      regex.lastIndex = start + redacted.length;
    }
  }
  return out;
}

export interface RedactResult {
  text: string;
  count: number;
}

/** Redact secrets in a free-text blob. */
export function redactText(input: string): RedactResult {
  const counts = new Map<string, number>();
  const text = redactString(input, counts);
  const count = [...counts.values()].reduce((a, b) => a + b, 0);
  return { text, count };
}

/** Deep-redact any JSON-ish structure. Returns a plain object safe to store/serve. */
export function redactValue(input: unknown, counts = new Map<string, number>()): unknown {
  if (typeof input === 'string') {
    return redactString(input, counts);
  }
  if (Array.isArray(input)) {
    return input.map((v) => redactValue(v, counts));
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = redactValue(v, counts);
    }
    return out;
  }
  return input;
}

export function redactResultCount(counts: Map<string, number>): number {
  return [...counts.values()].reduce((a, b) => a + b, 0);
}

export function truncate(text: string, maxChars = MAX_FIELD_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '... [truncated]';
}

export function redactAndTruncate(text: string, maxChars = MAX_FIELD_CHARS): string {
  return truncate(redactText(text).text, maxChars);
}
