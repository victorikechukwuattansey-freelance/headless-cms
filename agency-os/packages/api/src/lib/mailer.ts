import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { logger } from './logger';
import { renderPasswordResetEmail, renderVerificationEmail } from '../modules/auth/templates';

interface Mailer {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to send SMTP email`);
  }

  return value;
};

let transporter: Transporter<SMTPTransport.SentMessageInfo> | undefined;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const port = Number.parseInt(process.env.SMTP_PORT || '465', 10);

  transporter = nodemailer.createTransport({
    service: "gmail", // Shortcut for Gmail's SMTP settings - see Well-Known Services
    host: process.env.SMTP_HOST || requireEnv('SMTP_HOST'),
    port: Number.parseInt(process.env.SMTP_PORT || '465', 10),
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER || requireEnv('SMTP_USER'),
      pass: process.env.SMTP_PASS || requireEnv('SMTP_PASS'),
    },
  });

  return transporter;
};

const sendMail = async (to: string, template: { subject: string; text: string }) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || requireEnv('EMAIL_FROM'),
    to,
    subject: template.subject,
    text: template.text,
  });
};

export const mailer: Mailer = {
  async sendVerificationEmail(email, token) {
    const link = `${process.env.CLIENT_URL}/verify?token=${token}`;
    const template = renderVerificationEmail(link);

    await sendMail(email, template);
    logger.info({ event: 'email_verification_sent', email, subject: template.subject }, 'Verification email sent');
  },

  async sendPasswordResetEmail(email, token) {
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    const template = renderPasswordResetEmail(link);

    await sendMail(email, template);
    logger.info({ event: 'password_reset_sent', email, subject: template.subject }, 'Password reset email sent');
  },
};
