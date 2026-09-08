import { Queue } from "bullmq";
import { redis } from "../../lib/redis";

export const queue = new Queue("email-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    removeOnComplete: true,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
