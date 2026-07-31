import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class PostsQueueService {
  private readonly logger = new Logger(PostsQueueService.name);
  private queue: Queue;
  private connection: IORedis;

  constructor() {
    this.connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('social-posts', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }

  async schedulePublish(postId: string, scheduledAt: Date): Promise<Job> {
    const delay = scheduledAt.getTime() - Date.now();
    if (delay < 0) {
      throw new Error('Scheduled time must be in the future');
    }

    const job = await this.queue.add(
      'publish-post',
      { postId },
      {
        delay,
        jobId: `post-${postId}`,
      },
    );

    this.logger.log(`Publish job scheduled for post ${postId} at ${scheduledAt.toISOString()}`);
    return job;
  }

  async publishImmediately(postId: string): Promise<Job> {
    const job = await this.queue.add('publish-post', { postId }, {
      jobId: `post-${postId}-${Date.now()}`,
    });

    this.logger.log(`Immediate publish job created for post ${postId}`);
    return job;
  }

  async cancelScheduled(postId: string): Promise<void> {
    const jobId = `post-${postId}`;
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Cancelled scheduled publish for post ${postId}`);
    }
  }

  async getJobStatus(postId: string) {
    const jobId = `post-${postId}`;
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    return {
      jobId: job.id,
      status: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  getConnection(): IORedis {
    return this.connection;
  }
}
