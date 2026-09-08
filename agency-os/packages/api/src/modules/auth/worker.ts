import { Worker } from "bullmq";
import { mailer } from "../../lib/mailer";
import { redis } from "../../lib/redis";

const worker = new Worker(
  "email-queue",
  async (job) => {
    if (job.name === "send_verification_email") {
      const { email, verifyToken } = job.data;
      await mailer.sendVerificationEmail(email, verifyToken);
    }

    if (job.name === 'send_password_reset_email') {
      const { email, resetToken } = job.data;
      await mailer.sendPasswordResetEmail(email, resetToken);
    }
  },
  {
    connection: redis,
  }
);

export default worker;
