import type {
  AuthSession,
  AuthUser,
  Credentials,
  OAuthProvider,
  Organization,
  SignUpData,
} from "./types";

export interface AuthService {
  // Session
  getSession(): Promise<AuthSession | null>;
  refreshSession(refreshToken: string): Promise<AuthSession>;

  // Sign In / Sign Out
  signIn(credentials: Credentials): Promise<AuthSession>;
  signInWithOAuth(provider: OAuthProvider): Promise<string>;
  signOut(): Promise<void>;

  // Registration
  signUp(data: SignUpData): Promise<AuthSession>;
  verifyEmail(token: string): Promise<void>;
  sendVerificationEmail(email: string): Promise<void>;

  // Password
  sendPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;

  // Organization
  getCurrentOrganization(): Promise<Organization | null>;
  switchOrganization(orgId: string): Promise<void>;
  getOrganizations(): Promise<Organization[]>;

  // Permissions
  hasPermission(permission: string): Promise<boolean>;
  hasRole(role: string): Promise<boolean>;
  getPermissions(): Promise<string[]>;
}
