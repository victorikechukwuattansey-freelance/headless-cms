export const renderVerificationEmail = (verifyUrl: string) => ({
  subject: 'Verify your email address',
  text: `Welcome to agency-os. Verify your email by visiting ${verifyUrl}`,
});

export const renderPasswordResetEmail = (resetUrl: string) => ({
  subject: 'Reset your password',
  text: `Reset your password by visiting ${resetUrl}`,
});

