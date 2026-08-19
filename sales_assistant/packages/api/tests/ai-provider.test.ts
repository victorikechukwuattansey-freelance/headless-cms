import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { OpenAiProvider } from '../src/ai/openai-provider.js';
import { createAiProvider, estimateTokens } from '../src/ai/provider.js';

test('estimateTokens never returns zero for non-empty text', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.ok(estimateTokens('a'.repeat(400)) >= 100);
});

test('MockAiProvider returns deterministic canned completions', async () => {
  const provider = new MockAiProvider();
  const input = { model: 'gpt-4o-mini', messages: [{ role: 'user' as const, content: 'Summarize this lead' }] };
  const first = await provider.complete(input);
  const second = await provider.complete(input);

  assert.equal(provider.name, 'mock');
  assert.equal(first.content, second.content);
  assert.equal(first.tokensIn, second.tokensIn);
  assert.ok(first.content.length > 0);
  assert.ok(first.tokensIn > 0 && first.tokensOut > 0);
});

test('createAiProvider falls back to the mock provider when no API key is set', async () => {
  const previous = process.env.OPENAI_API_KEY;
  const previousEnv = process.env.NODE_ENV;
  delete process.env.OPENAI_API_KEY;
  delete process.env.NODE_ENV;
  try {
    const provider = createAiProvider();
    assert.equal(provider.name, 'mock');
    const result = await provider.complete({ model: 'gpt-4o-mini', messages: [] });
    assert.ok(result.content.length > 0);
  } finally {
    if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    if (previousEnv !== undefined) process.env.NODE_ENV = previousEnv;
  }
});

test('createAiProvider requires an API key in production', () => {
  const previous = process.env.OPENAI_API_KEY;
  const previousEnv = process.env.NODE_ENV;
  delete process.env.OPENAI_API_KEY;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => createAiProvider(), /OPENAI_API_KEY/);
  } finally {
    if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    if (previousEnv !== undefined) process.env.NODE_ENV = previousEnv;
  }
});

function stubClient(calls: Array<{ status?: number; content?: string }>) {
  let index = 0;
  return {
    chat: {
      completions: {
        create: async () => {
          const current = calls[Math.min(index, calls.length - 1)];
          index++;
          if (current.status) {
            const error = new Error(`rate limited (${current.status})`) as Error & { status?: number };
            error.status = current.status;
            throw error;
          }
          return {
            choices: [{ message: { content: current.content ?? 'ok' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          };
        },
      },
    },
  } as unknown as OpenAI;
}

test('OpenAiProvider retries retryable failures with backoff and succeeds', async () => {
  const client = stubClient([{ status: 429 }, { status: 503 }, { content: 'recovered' }]);
  const provider = new OpenAiProvider('sk-test', { maxRetries: 3, baseDelayMs: 1, client });

  const result = await provider.complete({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(result.content, 'recovered');
  assert.equal(result.tokensIn, 10);
  assert.equal(result.tokensOut, 5);
});

test('OpenAiProvider gives up after exhausting retries', async () => {
  const client = stubClient([{ status: 503 }, { status: 503 }, { status: 503 }]);
  const provider = new OpenAiProvider('sk-test', { maxRetries: 1, baseDelayMs: 1, client });

  await assert.rejects(
    () => provider.complete({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    (err: unknown) => (err as { status?: number }).status === 503,
  );
});

test('OpenAiProvider throws non-retryable errors immediately', async () => {
  const client = stubClient([{ status: 401 }, { status: 401 }]);
  const provider = new OpenAiProvider('sk-test', { maxRetries: 3, baseDelayMs: 1, client });

  await assert.rejects(
    () => provider.complete({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }),
    (err: unknown) => (err as { status?: number }).status === 401,
  );
});