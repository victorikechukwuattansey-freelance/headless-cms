import Link from "next/link";
import ServerStatus from "@/components/ServerStatus";

const STEPS = [
  {
    n: "1",
    title: "Upload",
    body: "Paste a log or drop a .json / .jsonl / .txt / .log file.",
  },
  {
    n: "2",
    title: "Diagnose",
    body: "Secrets are redacted. The timeline is rebuilt and checked against 9 failure classes.",
  },
  {
    n: "3",
    title: "Fix",
    body: "Get the root cause, supporting evidence, a recommended fix, and a prevention strategy.",
  },
];

const FAILURE_TYPES = [
  "wrong_prompt",
  "wrong_tool_selection",
  "missing_context",
  "hallucination",
  "infinite_loop",
  "timeout",
  "invalid_output",
  "api_failure",
  "context_overflow",
];

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Why did your AI agent fail?
        </h1>
        <p className="max-w-2xl text-muted">
          Upload an agent log (OpenAI, Anthropic, LangChain, JSON, or plain
          text). The analyzer rebuilds the execution timeline, classifies the
          failure, and tells you the root cause, evidence, and what to fix.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/upload"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            Analyze a log &rarr;
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            View previous reports
          </Link>
          <ServerStatus />
        </div>
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <span className="rounded-full border border-accent px-2.5 py-0.5 font-mono text-xs text-accent">
                {s.n}
              </span>
              <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Detected failure classes</h2>
        <div className="flex flex-wrap gap-2">
          {FAILURE_TYPES.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
