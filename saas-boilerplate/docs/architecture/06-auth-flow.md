# Authentication Flow

## AuthService Interface

```typescript
interface AuthService {
  // Session
  getSession(): Promise<Session | null>;
  refreshSession(refreshToken: string): Promise<Session>;

  // Sign In / Sign Out
  signIn(credentials: Credentials): Promise<Session>;
  signInWithOAuth(provider: OAuthProvider): Promise<RedirectUrl>;
  signOut(): Promise<void>;

  // Registration
  signUp(data: SignUpData): Promise<Session>;
  verifyEmail(token: string): Promise<void>;
  sendVerificationEmail(email: string): Promise<void>;

  // Password
  resetPassword(email: string): Promise<void>;
  updatePassword(token: string, password: string): Promise<void>;

  // Organization
  getCurrentOrganization(): Promise<Organization | null>;
  switchOrganization(orgId: string): Promise<void>;
  getOrganizations(): Promise<Organization[]>;

  // Permissions
  hasPermission(permission: string): Promise<boolean>;
  hasRole(role: string): Promise<boolean>;
  getPermissions(): Promise<string[]>;
}
```

## Login Flow

```text
User                    Browser                  Next.js              Auth Provider          Database
 │                        │                        │                     │                     │
 │  Click "Sign In"      │                        │                     │                     │
 │──────────────────────►│                        │                     │                     │
 │                        │  POST /api/auth/login  │                     │                     │
 │                        │──────────────────────►│                     │                     │
 │                        │                        │  Verify credentials │                     │
 │                        │                        │────────────────────►│                     │
 │                        │                        │◄────────────────────│                     │
 │                        │                        │                     │                     │
 │                        │                        │  Create session     │                     │
 │                        │                        │──────────────────────────────────────────►│
 │                        │                        │◄──────────────────────────────────────────│
 │                        │                        │                     │                     │
 │                        │◄───── Set cookie ─────│                     │                     │
 │                        │                        │                     │                     │
 │◄──────────────────────│                        │                     │                     │
 │  Redirect to dashboard │                        │                     │                     │
```

## OAuth Flow

```text
User              Browser               Next.js            OAuth Provider
 │                   │                     │                     │
 │ "Sign in with X"  │                     │                     │
 │──────────────────►│  GET /api/auth/oauth │                     │
 │                   │────────────────────►│                     │
 │                   │                     │  Redirect to OAuth  │
 │                   │◄────────────────────│                     │
 │                   │                     │                     │
 │  Redirect to      │                     │                     │
 │  provider.com     │                     │                     │
 │──────────────────►│                     │                     │
 │                   │  User authorizes    │                     │
 │                   │◄────────────────────│                     │
 │                   │                     │                     │
 │   Redirect back   │  GET /api/auth/callback?code=...          │
 │   to /callback    │────────────────────►│                     │
 │                   │                     │  Exchange code      │
 │                   │                     │────────────────────►│
 │                   │                     │◄── tokens ──────────│
 │                   │                     │                     │
 │                   │                     │  Find or create user│
 │                   │                     │  Create session     │
 │                   │◄─── set cookie ─────│                     │
 │◄──────────────────│                     │                     │
 │  Redirect to       │                     │                     │
 │  dashboard         │                     │                     │
```

## Session Lifecycle

| Event           | Action                                         |
| --------------- | ---------------------------------------------- |
| Sign in         | Create session, set HTTP-only cookie, redirect |
| Token refresh   | Extend session via refresh token rotation      |
| Org switch      | Update session org context, redirect           |
| Role change     | Update session permissions, no re-auth needed  |
| Email verify    | Update session claims                          |
| Password change | Invalidate other sessions, keep current        |
| Sign out        | Delete session, clear cookie, redirect         |
| Expired session | Clear cookie, redirect to login                |
