export type UploadMeta = {
  id: string;
  fileName: string;
  sourceFormat: string;
  sizeBytes: number;
  status: "uploaded" | "parsed" | "analyzed";
  createdAt: string;
};

export type ParsedStep = {
  index: number;
  timestamp: string | null;
  tool: string | null;
  prompt: string | null;
  response: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
};

export type ParsedExecution = {
  id: string;
  uploadedLogId: string;
  sourceFormat: string;
  stepCount: number;
  steps: ParsedStep[];
  createdAt: string;
};

export type ReportSummary = {
  id: string;
  summary: string;
  failureType: string;
  confidence: number;
  sourceFormat: string;
  redactions: number;
  createdAt: string;
};

export type Evidence = {
  label: string;
  detail: string;
  severity: "strong" | "moderate" | "weak";
};

export type ReportStep = {
  order: number;
  kind: string;
  label: string;
  content: string | null;
  outcome: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

export type ReportDetail = {
  id: string;
  summary: string;
  failureType: string;
  rootCause: string;
  confidence: number;
  recommendedFix: string;
  preventionStrategy: string;
  sourceFormat: string;
  stepCount: number;
  evidenceCount: number;
  redactions: number;
  createdAt: string;
  steps: ReportStep[];
  evidences: Evidence[];
};

export type ReportDocument = {
  id: string;
  failureType: string;
  confidence: number;
  executiveSummary: string;
  timeline: string[];
  rootCause: string;
  evidence: string[];
  suggestedFixes: string;
  preventionStrategy: string;
  document: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function uploadFile(file: File): Promise<UploadMeta> {
  const fd = new FormData();
  fd.append("file", file);
  return request<UploadMeta>("/api/uploads", { method: "POST", body: fd });
}

export function parseUpload(id: string, file: File): Promise<ParsedExecution> {
  const fd = new FormData();
  fd.append("file", file);
  return request<ParsedExecution>(`/api/uploads/${id}/parse`, {
    method: "POST",
    body: fd,
  });
}

export async function getReports(): Promise<ReportSummary[]> {
  const data = await request<{ reports: ReportSummary[] }>("/api/reports");
  return data.reports;
}

export function getReport(id: string): Promise<ReportDetail> {
  return request<ReportDetail>(`/api/reports/${id}`);
}

export function getReportDocument(id: string): Promise<ReportDocument> {
  return request<ReportDocument>(`/api/reports/${id}/document`);
}
