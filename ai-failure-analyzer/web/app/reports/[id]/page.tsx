"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getReport,
  getReportDocument,
  type ReportDetail,
  type ReportDocument,
  type ReportStep,
} from "@/lib/api";

const SEVERITY_CLASS: Record<string, string> = {
  strong: "border-accent text-accent",
  moderate: "border-warning text-warning",
  weak: "border-border text-muted",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StepRow({ step }: { step: ReportStep }) {
  const tokens =
    step.tokensIn != null || step.tokensOut != null
      ? `${step.tokensIn ?? "?"} in / ${step.tokensOut ?? "?"} out`
      : null;

  return (
    <details className="group rounded-lg border border-border bg-background px-4 py-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-xs text-muted">#{step.order}</span>
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-xs text-accent">
          {step.kind}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {step.label}
        </span>
        <span className="font-mono text-xs text-muted">{tokens}</span>
        {step.outcome && (
          <span
            className={`text-xs font-semibold ${
              step.outcome.toLowerCase().includes("fail")
                ? "text-danger"
                : "text-success"
            }`}
          >
            {step.outcome}
          </span>
        )}
      </summary>
      {step.content != null && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-3 font-mono text-xs text-muted">
          {step.content}
        </pre>
      )}
    </details>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [document, setDocument] = useState<ReportDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getReport(id), getReportDocument(id)])
      .then(([r, d]) => {
        if (cancelled) return;
        setReport(r);
        setDocument(d);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load report.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Report</h1>
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
        <Link
          href="/reports"
          className="inline-block rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          &larr; Back to reports
        </Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Report</h1>
        <p className="text-sm text-muted">Loading report…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/reports"
          className="inline-block text-sm text-muted hover:text-foreground"
        >
          &larr; Back to reports
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent px-2.5 py-0.5 font-mono text-xs text-accent">
            {report.failureType}
          </span>
          <span className="font-mono text-xs text-muted">
            {(report.confidence * 100).toFixed(0)}% confidence
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted">
            {report.sourceFormat}
          </span>
          {report.redactions > 0 && (
            <span className="rounded-full border border-warning px-2.5 py-0.5 font-mono text-xs text-warning">
              {report.redactions} secrets redacted
            </span>
          )}
          <span className="ml-auto text-xs text-muted">
            {formatDate(report.createdAt)}
          </span>
        </div>
        <p className="max-w-3xl text-muted">{report.summary}</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Root cause</h2>
        <p className="mt-2 text-sm text-muted">{report.rootCause}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Recommended fix</h2>
        <p className="mt-2 text-sm text-muted">{report.recommendedFix}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Prevention strategy</h2>
        <p className="mt-2 text-sm text-muted">{report.preventionStrategy}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evidence</h2>
        {report.evidences.length === 0 && (
          <p className="text-sm text-muted">No evidence recorded.</p>
        )}
        {report.evidences.map((evidence) => (
          <div
            key={evidence.label}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{evidence.label}</h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${SEVERITY_CLASS[evidence.severity] ?? SEVERITY_CLASS.weak}`}
              >
                {evidence.severity}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">{evidence.detail}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Execution timeline</h2>
        {report.steps.length === 0 && (
          <p className="text-sm text-muted">No steps recorded.</p>
        )}
        {report.steps.map((step) => (
          <StepRow key={step.order} step={step} />
        ))}
      </section>

      {document && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Root cause document</h2>
          <p className="text-xs text-muted">
            The full plain-English report in markdown, ready to copy.
          </p>
          <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-5 font-mono text-xs leading-relaxed text-muted">
            {document.document}
          </pre>
        </section>
      )}
    </div>
  );
}
