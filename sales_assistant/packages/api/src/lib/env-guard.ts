const MIN_SECRET_LENGTH = 32;

function requireStrongSecret(name: string, isProduction: boolean): void {
  const value = process.env[name];
  if (!value) {
    if (isProduction) {
      throw new Error(`${name} must be set in production`);
    }
    return;
  }
  if (isProduction && value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }
}

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  requireStrongSecret('JWT_SECRET', true);
  requireStrongSecret('INTEGRATION_TOKEN_ENCRYPTION_KEY', true);
}
