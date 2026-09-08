import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const mailerPath = path.join(repoRoot, 'packages/api/src/lib/mailer.ts');
const mailerSource = fs.readFileSync(mailerPath, 'utf8');

assert.equal(
  mailerSource.includes("import nodemailer from 'nodemailer';"),
  true,
  'mailer.ts should import nodemailer to send real SMTP messages',
);

assert.equal(
  mailerSource.includes('nodemailer.createTransport('),
  true,
  'mailer.ts should create an SMTP transport from environment configuration',
);

assert.equal(
  mailerSource.includes('await transporter.sendMail({'),
  true,
  'mailer.ts should send emails through nodemailer instead of only logging the message body',
);

assert.equal(
  mailerSource.includes('from: process.env.EMAIL_FROM'),
  true,
  'mailer.ts should send mail from EMAIL_FROM',
);

assert.equal(
  mailerSource.includes('host: process.env.SMTP_HOST'),
  true,
  'mailer.ts should read SMTP_HOST when creating the transport',
);

assert.equal(
  mailerSource.includes('port: Number.parseInt(process.env.SMTP_PORT'),
  true,
  'mailer.ts should read SMTP_PORT when creating the transport',
);

assert.equal(
  mailerSource.includes('user: process.env.SMTP_USER'),
  true,
  'mailer.ts should authenticate with SMTP_USER',
);

assert.equal(
  mailerSource.includes('pass: process.env.SMTP_PASS'),
  true,
  'mailer.ts should authenticate with SMTP_PASS',
);
