"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getReports, type ReportSummary } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReportCard({ report }: { report: ReportSummary }) {
  return (
    <Link
      href={`/reports/${report.id}`}
      className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-accent px-2.5 py-0.5 font-mono text-xs text-accent">
          {report.failureType}
        </span>
        <span className="font-mono text-xs text-muted">
          {(report.confidence * 100).toFixed(0)}%
        </span>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted">
          {report.sourceFormat}
        </span>
        {report.redactions > 0 && (
          <span className="rounded-full border border-warning px-2.5 py-0.5 font-mono text-xs text-warning">
            {report.redactions} redacted
          </span>
        )}
        <span className="ml-auto text-xs text-muted">
          {formatDate(report.createdAt)}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{report.summary}</p>
    </Link>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReports()
      .then((r) => {
        if (!cancelled) setReports(r);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load reports.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Previous reports</h1>
        <p className="max-w-2xl text-muted">
          Root cause analyses generated from uploaded agent logs, newest first.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {reports === null && !error && (
        <p className="text-sm text-muted">Loading reports…</p>
      )}

      {reports !== null && reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">No reports yet.</p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            Analyze a log
          </Link>
        </div>
      )}

      {reports !== null && reports.length > 0 && (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
