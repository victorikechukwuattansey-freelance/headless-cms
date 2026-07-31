import { describe, it, expect } from "vitest";
import {
  BillingError,
  PaymentFailedError,
  NoActiveSubscriptionError,
  CustomerNotFoundError,
} from "./types";

describe("BillingError", () => {
  it("creates error with code and message", () => {
    const error = new BillingError("BILL_001", "billing error");
    expect(error.code).toBe("BILL_001");
    expect(error.message).toBe("billing error");
    expect(error.name).toBe("BillingError");
  });
});

describe("PaymentFailedError", () => {
  it("has correct code and message", () => {
    const error = new PaymentFailedError();
    expect(error.code).toBe("PAYMENT_FAILED");
    expect(error.message).toBe("Payment processing failed");
    expect(error).toBeInstanceOf(BillingError);
  });
});

describe("NoActiveSubscriptionError", () => {
  it("has correct code and message", () => {
    const error = new NoActiveSubscriptionError();
    expect(error.code).toBe("NO_ACTIVE_SUBSCRIPTION");
    expect(error.message).toBe("No active subscription found");
  });
});

describe("CustomerNotFoundError", () => {
  it("has correct code and message", () => {
    const error = new CustomerNotFoundError();
    expect(error.code).toBe("CUSTOMER_NOT_FOUND");
    expect(error.message).toBe("Customer not found");
  });
});
