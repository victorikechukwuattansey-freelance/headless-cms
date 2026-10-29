import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AdminTransactionStatus,
  CustomerTransactionStatus,
  FulfillmentStatus,
  MarketplaceCatalog,
} from "../marketplace/types.ts";
import type { Repositories } from "../db/repositories/index.ts";
import type { ProviderStatus } from "../marketplace/providers/contracts.ts";
import type { VtpassTransactionStatus } from "../vtpass/contracts.ts";
import { mapStatuses } from "../vtpass/response-mapper.ts";
import { reconcileMarketplaceTransaction } from "../marketplace/reconcile.ts";
import {
  appendTransactionEvent,
  TransactionEventType,
} from "../marketplace/timeline.ts";

export interface VtpassWebhookDeps {
  readonly repos: Repositories;
  readonly catalog: MarketplaceCatalog;
}

export type VtpassWebhookHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

interface VtpassCallbackPayload {
  readonly type: string;
  readonly data: {
    readonly code: string;
    readonly content?: {
      readonly transactions?: {
        readonly status?: string;
        readonly transactionId?: string;
        readonly unique_element?: string;
      };
    };
    readonly requestId: string;
    readonly amount?: number;
    readonly transaction_date?: string;
  };
}

interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export function createVtpassWebhookHandler(
  deps: VtpassWebhookDeps,
): VtpassWebhookHandler {
  return async (req, res) => {
    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      contentType.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      respondJson(
        res,
        400,
        errorBody("MALFORMED_PAYLOAD", "content-type must be application/json"),
      );
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readRawBody(req);
    } catch {
      respondJson(
        res,
        400,
        errorBody("MALFORMED_PAYLOAD", "body could not be read"),
      );
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      respondJson(
        res,
        400,
        errorBody("MALFORMED_PAYLOAD", "request body must be valid JSON"),
      );
      return;
    }

    if (!isVtpassCallbackPayload(parsed)) {
      respondJson(
        res,
        400,
        errorBody(
          "INVALID_PAYLOAD",
          "webhook payload is missing required fields",
        ),
      );
      return;
    }

    const attempt =
      await deps.repos.marketplaceProviderAttempts.findByProviderRequestId(
        parsed.data.requestId,
      );
    if (attempt === null) {
      respondSuccess(res);
      return;
    }

    const innerStatus = parsed.data.content?.transactions?.status;
    const statuses = mapStatuses(
      parsed.data.code,
      (innerStatus as VtpassTransactionStatus | undefined) ?? null,
    );
    const derived = deriveTransactionStatuses(statuses.ps);

    if (derived === null) {
      respondSuccess(res);
      return;
    }

    const transaction = await deps.repos.marketplaceTransactions.readLatestById(
      attempt.transactionId,
    );
    if (transaction === null) {
      respondSuccess(res);
      return;
    }

    const alreadyApplied =
      attempt.status === statuses.as && attempt.canonicalStatus === statuses.cs;

    if (alreadyApplied) {
      respondSuccess(res);
      return;
    }

    const now = new Date().toISOString();

    await deps.repos.marketplaceProviderAttempts.updateStatus(attempt.id, {
      status: statuses.as,
      canonicalStatus: statuses.cs,
    });
    await deps.repos.marketplaceTransactions.updateStatuses(
      attempt.transactionId,
      {
        fulfillmentStatus: derived.fulfillmentStatus,
        updatedAt: now,
      },
    );
    await appendTransactionEvent(deps.repos, {
      transactionId: attempt.transactionId,
      type: TransactionEventType.ProviderResponseReceived,
      label: "VTPass callback received",
      description: `VTPass reported ${parsed.data.code} / ${innerStatus ?? "unknown"}.`,
      actor: "SYSTEM",
      source: "PROVIDER",
      metadata: {
        vtpass_code: parsed.data.code,
        vtpass_status: innerStatus ?? "unknown",
        ...(parsed.data.content?.transactions?.transactionId !== undefined
          ? {
              vtpass_transaction_id:
                parsed.data.content.transactions.transactionId,
            }
          : {}),
      },
      occurredAt: now,
    });

    try {
      await reconcileMarketplaceTransaction(
        { repos: deps.repos, catalog: deps.catalog },
        { transactionId: attempt.transactionId, forceRegenerate: true },
      );
    } catch {
      // Reconcile failure does not fail the callback — evidence is already
      // recorded. VTPass may retry; next attempt re-triggers.
    }

    respondSuccess(res);
  };
}

function deriveTransactionStatuses(ps: ProviderStatus): {
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly customerStatus: CustomerTransactionStatus;
  readonly adminStatus: AdminTransactionStatus;
} | null {
  switch (ps) {
    case "PROVIDER_SUCCESS":
      return {
        fulfillmentStatus: "FULFILLED",
        customerStatus: "CONFIRMED",
        adminStatus: "HEALTHY",
      };
    case "PROVIDER_FAILED":
      return {
        fulfillmentStatus: "FAILED",
        customerStatus: "NEEDS_ATTENTION",
        adminStatus: "PROVIDER_FAILED",
      };
    case "PROVIDER_REVERSED":
      return {
        fulfillmentStatus: "FAILED",
        customerStatus: "REVERSED",
        adminStatus: "REVERSAL_QUEUE",
      };
    case "PROVIDER_PENDING":
      return {
        fulfillmentStatus: "PENDING",
        customerStatus: "PENDING",
        adminStatus: "PENDING_PROVIDER",
      };
    case "PROVIDER_DUPLICATE":
      return {
        fulfillmentStatus: "FULFILLED",
        customerStatus: "CONFIRMED",
        adminStatus: "DUPLICATE",
      };
    default:
      return null;
  }
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isVtpassCallbackPayload(
  value: unknown,
): value is VtpassCallbackPayload {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.type !== "string" || payload.type === "") return false;
  if (!("data" in payload)) return false;
  const data = payload.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const d = data as Record<string, unknown>;
  if (typeof d.requestId !== "string" || d.requestId === "") return false;
  if (typeof d.code !== "string") return false;
  return true;
}

function respondSuccess(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ response: "success" }));
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}
