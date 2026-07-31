export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: string;
  emailVerified?: Date | null;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: Date;
  currentOrgId?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export type OAuthProvider = "github" | "google" | "discord" | "microsoft";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password");
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super("SESSION_EXPIRED", "Session has expired");
  }
}

export class UnauthorizedError extends AuthError {
  constructor() {
    super("UNAUTHORIZED", "Authentication required");
  }
}

export class ForbiddenError extends AuthError {
  constructor() {
    super("FORBIDDEN", "Insufficient permissions");
  }
}

export class EmailNotVerifiedError extends AuthError {
  constructor() {
    super("EMAIL_NOT_VERIFIED", "Email not verified");
  }
}
