import type { AuthService } from "../../service";
import type {
  AuthSession,
  Credentials,
  OAuthProvider,
  Organization,
  SignUpData,
} from "../../types";

export class SupabaseAuthAdapter implements AuthService {
  async getSession(): Promise<AuthSession | null> {
    throw new Error("Supabase auth not yet implemented");
  }

  async refreshSession(): Promise<AuthSession> {
    throw new Error("Supabase auth not yet implemented");
  }

  async signIn(_credentials: Credentials): Promise<AuthSession> {
    throw new Error("Supabase auth not yet implemented");
  }

  async signInWithOAuth(_provider: OAuthProvider): Promise<string> {
    throw new Error("Supabase auth not yet implemented");
  }

  async signOut(): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async signUp(_data: SignUpData): Promise<AuthSession> {
    throw new Error("Supabase auth not yet implemented");
  }

  async verifyEmail(_token: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async sendVerificationEmail(_email: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async sendPasswordReset(_email: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async resetPassword(_token: string, _password: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async updatePassword(_currentPassword: string, _newPassword: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async getCurrentOrganization(): Promise<Organization | null> {
    throw new Error("Supabase auth not yet implemented");
  }

  async switchOrganization(_orgId: string): Promise<void> {
    throw new Error("Supabase auth not yet implemented");
  }

  async getOrganizations(): Promise<Organization[]> {
    throw new Error("Supabase auth not yet implemented");
  }

  async hasPermission(_permission: string): Promise<boolean> {
    throw new Error("Supabase auth not yet implemented");
  }

  async hasRole(_role: string): Promise<boolean> {
    throw new Error("Supabase auth not yet implemented");
  }

  async getPermissions(): Promise<string[]> {
    throw new Error("Supabase auth not yet implemented");
  }
}
