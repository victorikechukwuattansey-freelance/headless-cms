import type { PaystackMappedTransaction } from "../../../src/adapters/providers/paystack/paystack.ts";
import type {
  InitializeTransactionInput,
  InitializeTransactionResult,
  VerifyTransactionInput,
} from "./client.ts";

/**
 * The application-facing Paystack boundary for the storefront.
 * The real implementation lives in client.ts; tests inject fakes.
 */
export interface PaystackGateway {
  readonly initializeTransaction: (
    input: InitializeTransactionInput,
  ) => Promise<InitializeTransactionResult>;
  readonly verifyTransaction: (
    input: VerifyTransactionInput,
  ) => Promise<PaystackMappedTransaction>;
}
