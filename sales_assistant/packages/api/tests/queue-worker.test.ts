import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueueWorkerService, type JobSource, type QueueJob } from '../src/workers/queue-worker.service.js';

class MemorySource implements JobSource {
  readonly jobs: QueueJob[] = [];
  readonly requeued: QueueJob[] = [];

  async receive(): Promise<QueueJob | null> {
    return this.jobs.shift() ?? null;
  }

  async requeue(job: QueueJob): Promise<void> {
    this.requeued.push(job);
  }
}

test('processJob dispatches to the registered handler and records success', async () => {
  const processed: string[] = [];
  const worker = new QueueWorkerService(
    new Map([['lead.scored', async (job) => void processed.push(job.id)]]),
    5,
  );

  await worker.processJob({ id: 'job-1', type: 'lead.scored' });
  assert.deepEqual(processed, ['job-1']);
});

test('processJob throws when no handler is registered', async () => {
  const worker = new QueueWorkerService(new Map(), 5);
  await assert.rejects(
    () => worker.processJob({ id: 'job-1', type: 'unknown.type' }),
    /No handler registered/,
  );
});

test('processJob requeues failed jobs with backoff until max attempts', async () => {
  const source = new MemorySource();
  const worker = new QueueWorkerService(
    new Map([['flaky', async () => { throw new Error('boom'); }]]),
    5,
    source,
    2,
    1,
  );

  await worker.processJob({ id: 'job-1', type: 'flaky' });
  assert.equal(source.requeued.length, 1);
  assert.equal(source.requeued[0]!.attempts, 1);

  await worker.processJob({ id: 'job-1', type: 'flaky', attempts: 1 });
  assert.equal(source.requeued.length, 2);
  assert.equal(source.requeued[1]!.attempts, 2);

  await assert.rejects(() => worker.processJob({ id: 'job-1', type: 'flaky', attempts: 2 }), /boom/);
  assert.equal(source.requeued.length, 2, 'no further requeue after max attempts');
});

test('processJob throws on failure when the source cannot requeue', async () => {
  const worker = new QueueWorkerService(
    new Map([['flaky', async () => { throw new Error('boom'); }]]),
    5,
    { receive: async () => null },
  );

  await assert.rejects(() => worker.processJob({ id: 'job-1', type: 'flaky' }), /boom/);
});

test('start polls the source and keeps running after a failed job', async () => {
  let emitted = 0;
  const processed: string[] = [];
  const worker = new QueueWorkerService(
    new Map([
      ['ok', async (job) => void processed.push(job.id)],
      ['flaky', async () => { throw new Error('boom'); }],
    ]),
    5,
    {
      receive: async () => {
        if (emitted < 4) {
          const job: QueueJob = { id: `job-${emitted}`, type: emitted % 2 === 0 ? 'flaky' : 'ok' };
          emitted++;
          return job;
        }
        return null;
      },
    },
  );

  const startPromise = worker.start();
  await new Promise((resolve) => setTimeout(resolve, 150));
  worker.stop();
  await startPromise;

  assert.deepEqual(processed.sort(), ['job-1', 'job-3']);
});