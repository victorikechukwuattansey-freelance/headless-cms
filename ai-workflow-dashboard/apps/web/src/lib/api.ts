const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Auth token lives in a same-site cookie (not localStorage) so middleware and
// server components can read it. SameSite=Lax — the cookie is only needed for
// in-page logic and next middleware; the API authenticates via the Bearer
// header below, so cross-origin cookie forwarding is not required.
const TOKEN_COOKIE = "awd_token";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7d, matches API JWT_EXPIRES_IN

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${TOKEN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(TOKEN_COOKIE.length + 1)) : null;
}

export function setToken(token: string): void {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE}; samesite=lax`;
}

export function clearToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function getOrg(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("awd_org");
}

export function setOrg(orgId: string): void {
  localStorage.setItem("awd_org", orgId);
}

// In-flight GET dedup — concurrent identical requests (same method, path and
// org) share one fetch. Prevents duplicate network traffic when several
// components mount at once; entries are removed when the request settles.
const inflight = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const org = getOrg();
  if (org) headers["X-Organization"] = org;

  const method = (options.method ?? "GET").toUpperCase();
  const isGet = method === "GET";
  const key = `${method} ${path} ${org ?? ""}`;
  if (isGet) {
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!res.ok) {
      // Expired/revoked token with a session present → drop it and return to
      // the login screen. Login failures (401 with no token) must NOT redirect.
      if (res.status === 401 && token) {
        clearToken();
        if (typeof window !== "undefined") window.location.assign("/");
      }
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string | string[] };
        if (Array.isArray(body.message)) message = body.message.join(", ");
        else if (body.message) message = body.message;
      } catch {
        // ignore
      }
      throw new ApiError(message, res.status);
    }
    return res.json() as Promise<T>;
  })();

  if (isGet) {
    inflight.set(key, request);
    void request
      .finally(() => {
        inflight.delete(key);
      })
      .catch(() => {
        // cleanup chain — rejection is handled by the awaiting caller
      });
  }
  return request;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  scheduleCron: string | null;
  currentVersion: number;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  version: {
    version: number;
    nodes: Array<{
      id: string;
      nodeType: string;
      positionX: number;
      positionY: number;
      configuration: Record<string, unknown>;
    }>;
    connections: Array<{ id: string; sourceNode: string; targetNode: string }>;
  } | null;
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface ProviderInfo {
  name: string;
  configured: boolean;
  healthy: boolean | null;
  models: string[];
  isDefault: boolean;
  isFallback: boolean;
}

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  role: string;
}

export interface OrgMember {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}
