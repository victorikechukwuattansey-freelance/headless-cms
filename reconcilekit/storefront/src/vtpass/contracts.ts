/**
 * VTPass wire types. Field names match VTPass JSON exactly — the
 * request body uses snake_case (`request_id`) while responses use
 * camelCase (`requestId`). See https://vtpass.com/documentation/.
 */

export interface VtpassPayRequest {
  readonly request_id: string;
  readonly serviceID: string;
  readonly billersCode: string;
  readonly variation_code?: string;
  readonly amount: number;
  readonly phone?: string;
  readonly callback_url?: string;
}

export interface VtpassRequeryRequest {
  readonly request_id: string;
}

export type VtpassTransactionStatus =
  "delivered" | "initiated" | "pending" | "failed" | "reversed";

export interface VtpassTransactions {
  readonly status: VtpassTransactionStatus;
  readonly transactionId: string;
  readonly product_name: string;
  readonly unique_element: string;
  readonly unit_price: string;
  readonly quantity: number;
  readonly channel?: string;
  readonly type?: string;
  readonly commission?: number;
  readonly total_amount?: number;
}

export interface VtpassResponse<T> {
  readonly code: string;
  readonly content: { readonly transactions: T } | null;
  readonly response_description: string;
  readonly requestId: string;
  readonly amount?: number;
  readonly transaction_date?: string;
  readonly purchased_code?: string;
}
