import { Resend } from "resend";
import { getEnv } from "@saas/config";

const env = getEnv();

let resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!resend) {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set");
    }
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export async function sendEmail(params: SendEmailParams) {
  const client = getResendClient();
  return client.emails.send({
    from: params.from ?? env.RESEND_FROM_EMAIL ?? "noreply@saas.com",
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });
}

export interface EmailTemplateProps {
  previewText?: string;
  children?: React.ReactNode;
}

export { WelcomeEmail } from "./templates/welcome";
export { VerificationEmail } from "./templates/verification";
export { PasswordResetEmail } from "./templates/password-reset";
export { MagicLinkEmail } from "./templates/magic-link";
export { InvitationEmail } from "./templates/invitation";
export { SubscriptionEmail } from "./templates/subscription";
export { InvoiceEmail } from "./templates/invoice";
