export { handlers, auth, signIn, signOut } from "./adapters/nextauth";

export { createAuthService, getAuthService } from "./factory";
export type { AuthService } from "./service";
export type {
  AuthSession,
  AuthUser,
  SignUpData,
  Credentials,
  OAuthProvider,
  Organization,
} from "./types";
export {
  AuthError,
  InvalidCredentialsError,
  SessionExpiredError,
  UnauthorizedError,
  ForbiddenError,
} from "./types";
