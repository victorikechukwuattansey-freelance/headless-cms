import { describe, it, expect } from "vitest";
import {
  AuthError,
  InvalidCredentialsError,
  SessionExpiredError,
  UnauthorizedError,
  ForbiddenError,
  EmailNotVerifiedError,
} from "./types";

describe("AuthError", () => {
  it("creates error with code and message", () => {
    const error = new AuthError("TEST", "test error");
    expect(error.code).toBe("TEST");
    expect(error.message).toBe("test error");
    expect(error.name).toBe("AuthError");
  });
});

describe("InvalidCredentialsError", () => {
  it("has correct code and default message", () => {
    const error = new InvalidCredentialsError();
    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.message).toBe("Invalid email or password");
    expect(error).toBeInstanceOf(AuthError);
  });
});

describe("SessionExpiredError", () => {
  it("has correct code and default message", () => {
    const error = new SessionExpiredError();
    expect(error.code).toBe("SESSION_EXPIRED");
    expect(error.message).toBe("Session has expired");
  });
});

describe("UnauthorizedError", () => {
  it("has correct code and default message", () => {
    const error = new UnauthorizedError();
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Authentication required");
  });
});

describe("ForbiddenError", () => {
  it("has correct code and default message", () => {
    const error = new ForbiddenError();
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Insufficient permissions");
  });
});

describe("EmailNotVerifiedError", () => {
  it("has correct code and default message", () => {
    const error = new EmailNotVerifiedError();
    expect(error.code).toBe("EMAIL_NOT_VERIFIED");
    expect(error.message).toBe("Email not verified");
  });
});
