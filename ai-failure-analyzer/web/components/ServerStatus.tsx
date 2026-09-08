"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "online" | "offline";

export default function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dot =
    status === "online"
      ? "bg-success"
      : status === "offline"
        ? "bg-danger"
        : "bg-warning";
  const label =
    status === "online"
      ? "API online"
      : status === "offline"
        ? "API offline"
        : "Checking API...";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
