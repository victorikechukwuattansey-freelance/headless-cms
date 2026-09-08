"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  parseUpload,
  uploadFile,
  type ParsedExecution,
  type ParsedStep,
  type UploadMeta,
} from "@/lib/api";

const ACCEPT = ".json,.csv,.txt";
const MAX_BYTES = 10 * 1024 * 1024;

type Phase = "idle" | "uploading" | "parsing" | "done";

function StepRow({ step }: { step: ParsedStep }) {
  const tokens =
    step.tokensIn != null || step.tokensOut != null
      ? `${step.tokensIn ?? "?"} in / ${step.tokensOut ?? "?"} out`
      : null;

  return (
    <details className="group rounded-lg border border-border bg-background px-4 py-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-xs text-muted">#{step.index}</span>
        {step.timestamp && (
          <span className="font-mono text-xs text-muted">{step.timestamp}</span>
        )}
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-xs text-accent">
          {step.tool ?? "—"}
        </span>
        <span className="ml-auto font-mono text-xs text-muted">{tokens}</span>
        {step.error && (
          <span className="text-xs font-semibold text-danger">error</span>
        )}
      </summary>
      <div className="mt-3 space-y-2 text-xs">
        {step.prompt != null && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-3 font-mono text-muted">
            {step.prompt}
          </pre>
        )}
        {step.response != null && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-3 font-mono text-muted">
            {step.response}
          </pre>
        )}
        {step.error != null && (
          <p className="font-mono text-danger">{step.error}</p>
        )}
      </div>
    </details>
  );
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [meta, setMeta] = useState<UploadMeta | null>(null);
  const [execution, setExecution] = useState<ParsedExecution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/\.(json|csv|txt)$/i.test(f.name)) {
      setError("Unsupported file type. Use .json, .csv, or .txt.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File is larger than 10 MB.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function run() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const meta = await uploadFile(file);
      setMeta(meta);
      setPhase("parsing");
      const execution = await parseUpload(meta.id, file);
      setExecution(execution);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function reset() {
    setFile(null);
    setMeta(null);
    setExecution(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = phase === "uploading" || phase === "parsing";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Upload agent logs</h1>
        <p className="max-w-2xl text-muted">
          Drop a log file to store it and rebuild its execution timeline. Only
          metadata and redacted steps are kept — raw log content is never
          persisted.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging
              ? "border-accent bg-raised"
              : "border-border hover:border-accent"
          }`}
        >
          <p className="text-sm">
            {file ? (
              <>
                Selected: <span className="font-mono text-accent">{file.name}</span>{" "}
                ({(file.size / 1024).toFixed(1)} KB)
              </>
            ) : (
              "Drop a log file here, or click to browse"
            )}
          </p>
          <p className="mt-2 font-mono text-xs text-muted">
            {ACCEPT.replaceAll(".", ". ")} &middot; up to 10 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {error && (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!file || busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "uploading"
              ? "Storing upload…"
              : phase === "parsing"
                ? "Parsing timeline…"
                : "Upload & parse"}
          </button>
          <span className="text-xs text-muted">
            {phase === "uploading" && "Storing upload metadata…"}
            {phase === "parsing" && "Rebuilding execution timeline…"}
          </span>
        </div>
      </div>

      {phase === "done" && meta && execution && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-mono text-xs text-muted">
                upload {meta.id}
              </span>
              <span className="rounded-full border border-success/50 px-2.5 py-0.5 font-mono text-xs text-success">
                {phase === "done" ? "parsed" : meta.status}
              </span>
              <span className="ml-auto font-mono text-xs text-muted">
                {meta.fileName} &middot; {execution.sourceFormat} &middot;{" "}
                {execution.stepCount} steps
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/reports"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                View previous reports
              </Link>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Upload another
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Analysis of parsed logs lands in a later milestone.
            </p>
          </div>

          <div className="space-y-2">
            {execution.steps.map((step) => (
              <StepRow key={step.index} step={step} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
