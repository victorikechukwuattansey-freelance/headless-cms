import type { IncomingMessage, ServerResponse } from "node:http";
import type { PaystackAdapterOptions } from "../../../src/adapters/providers/paystack/paystack.ts";
import { ingestPaymentEvent } from "../marketplace/payment-sources/ingest.ts";
import {
  paystackWebhookPaymentEvent,
  type PaystackWebhookPayload,
} from "../marketplace/payment-sources/webhook-payload.ts";
import { verifyPaystackSignature } from "../marketplace/payment-sources/webhook-signature.ts";
import type { Repositories } from "../db/repositories/index.ts";

// PaystackAdapterOptions.supportedCurrencies is required with no
// "accept all" sentinel. The webhook is evidence (R4): accept any
// currency Paystack sends, so this covers every 3-letter uppercase
// code. Downstream reconciliation filters to its configured set;
// the webhook does not.
const ALL_THREE_LETTER_CURRENCY_CODES: readonly string[] = Array.from(
  { length: 26 ** 3 },
  (_, index) => {
    const first = String.fromCharCode(65 + Math.floor(index / 676));
    const second = String.fromCharCode(65 + Math.floor((index % 676) / 26));
    const third = String.fromCharCode(65 + (index % 26));
    return `${first}${second}${third}`;
  },
);

export const PAYSTACK_WEBHOOK_ADAPTER_OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ALL_THREE_LETTER_CURRENCY_CODES,
  timestampField: "paid_at",
};

export interface PaystackWebhookDeps {
  readonly repos: Repositories;
  readonly secretKey: string;
  readonly adapterOptions: PaystackAdapterOptions;
}

export type PaystackWebhookHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function createPaystackWebhookHandler(
  deps: PaystackWebhookDeps,
): PaystackWebhookHandler {
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

    const rawBody = await readRawBody(req);
    const signature = req.headers["x-paystack-signature"];
    if (typeof signature !== "string" || signature === "") {
      respondJson(
        res,
        400,
        errorBody("INVALID_SIGNATURE", "x-paystack-signature is required"),
      );
      return;
    }

    if (!verifyPaystackSignature(rawBody, signature, deps.secretKey)) {
      respondJson(
        res,
        400,
        errorBody("INVALID_SIGNATURE", "signature verification failed"),
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

    if (!isPaystackWebhookPayload(parsed)) {
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

    let normalized;
    try {
      normalized = paystackWebhookPaymentEvent(
        parsed,
        deps.adapterOptions,
        rawBody,
      );
    } catch {
      respondJson(
        res,
        400,
        errorBody("INVALID_PAYLOAD", "webhook payload is invalid"),
      );
      return;
    }

    if (normalized === null) {
      respondJson(res, 200, {
        ignored: true,
        reason: "unsupported_event_type",
      });
      return;
    }

    let outcome;
    try {
      outcome = await ingestPaymentEvent(deps.repos, normalized);
    } catch {
      respondJson(
        res,
        500,
        errorBody("INGEST_FAILED", "payment event could not be recorded"),
      );
      return;
    }

    respondJson(res, 200, {
      event_id: outcome.event.event_id,
      replayed: outcome.replay,
    });
  };
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isPaystackWebhookPayload(
  value: unknown,
): value is PaystackWebhookPayload {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.event !== "string" || payload.event === "") {
    return false;
  }
  if (!("data" in payload)) {
    return false;
  }
  const data = payload.data;
  if (data === null) {
    return true;
  }
  return typeof data === "object" && !Array.isArray(data);
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}
