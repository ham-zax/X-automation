import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-direct-contract-'));
process.chdir(scratch);
const direct = await import('../ai_direct.js');
const runtime = await import('../ai_runtime.js');
const store = await import('../store.js');
const { CONTROLLER_DECISION_SCHEMA } = await import('../semantic_controller.js');
const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
const profile = { name: 'contract-test', runtime: 'direct_api', providerKind: 'openai_compatible',
  protocol: 'responses', model: 'test-model', baseUrl: 'https://example.invalid/v1' };

function usage(input = 50, output = 10, cached = 20, reasoning = 3) {
  return { input_tokens: input, input_tokens_details: { cached_tokens: cached },
    output_tokens: output, output_tokens_details: { reasoning_tokens: reasoning } };
}

function transport(responses, captured) {
  return async (_url, options) => {
    captured.push(JSON.parse(options.body));
    return { status: 200, ok: true, text: JSON.stringify(responses[captured.length - 1]) };
  };
}

try {
  await test('Responses protocol enforces job output cap and preserves cache/reasoning subsets', async () => {
    const captured = [];
    const result = await direct.runDirectStructuredAI(profile, {
      prompt: 'Return JSON', schema, maxOutputTokens: 25,
      transport: transport([{ output_text: '{"ok":true}', usage: usage() }], captured),
    });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].max_output_tokens, 25);
    assert.equal(result.inputTokens, 50);
    assert.equal(result.cachedInputTokens, 20);
    assert.equal(result.outputTokens, 10);
    assert.equal(result.reasoningTokens, 3);
  });

  await test('Chat Completions protocol uses its own cap and usage fields', async () => {
    const captured = [];
    const result = await direct.runDirectStructuredAI({ ...profile, protocol: 'chat_completions' }, {
      prompt: 'Return JSON', schema, maxOutputTokens: 25,
      transport: transport([{ choices: [{ message: { content: '{"ok":true}' } }], usage: {
        prompt_tokens: 50, prompt_tokens_details: { cached_tokens: 20 },
        completion_tokens: 10, completion_tokens_details: { reasoning_tokens: 3 },
      } }], captured),
    });
    assert.equal(captured[0].max_completion_tokens, 25);
    assert.equal(result.cachedInputTokens, 20);
    assert.equal(result.reasoningTokens, 3);
  });

  await test('missing usage stays unknown and invalid caps fail before transport', async () => {
    const captured = [];
    const result = await direct.runDirectStructuredAI(profile, {
      prompt: 'Return JSON', schema,
      transport: transport([{ output_text: '{"ok":true}' }], captured),
    });
    assert.equal(result.inputTokens, null);
    assert.equal(result.cachedInputTokens, null);
    assert.equal(result.outputTokens, null);
    assert.equal(result.reasoningTokens, null);
    for (const maxOutputTokens of [0, -1, NaN, Infinity, 1.5, '25']) {
      await assert.rejects(direct.runDirectStructuredAI(profile, { prompt: 'x', schema,
        maxOutputTokens, transport: transport([], captured) }), /finite positive integer/);
    }
    assert.equal(captured.length, 1);
  });

  await test('bounded structured execution makes one request on malformed output', async () => {
    const captured = [];
    await assert.rejects(runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema, maxOutputTokens: 25, allowRepair: false, allowFallback: false,
      transport: transport([{ output_text: 'bad json', usage: usage() }], captured),
    }), error => error.code === 'invalid_structured_output');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].max_output_tokens, 25);
  });

  await test('ordinary JSON repair aggregates every request without double-counting subsets', async () => {
    const captured = [];
    const result = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema,
      transport: transport([{ output_text: 'bad json', usage: usage() },
        { output_text: '{"ok":true}', usage: usage(30, 8, 10, 2) }], captured),
    });
    assert.equal(captured.length, 2);
    assert.equal(result.execution.inputTokens, 80);
    assert.equal(result.execution.cachedInputTokens, 30);
    assert.equal(result.execution.outputTokens, 18);
    assert.equal(result.execution.reasoningTokens, 5);
  });

  await test('repair totals stay unknown when any request lacks accounting', async () => {
    const captured = [];
    const result = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema,
      transport: transport([{ output_text: 'bad json' }, { output_text: '{"ok":true}', usage: usage() }], captured),
    });
    assert.equal(captured.length, 2);
    assert.equal(result.execution.inputTokens, null);
    assert.equal(result.execution.cachedInputTokens, null);
    assert.equal(result.execution.outputTokens, null);
    assert.equal(result.execution.reasoningTokens, null);
  });

  await test('fallback retains the explicit job cap and disabled repair; bounded calls disable fallback', async () => {
    const primary = store.createAiProfile({ ...profile, name: 'primary-test' });
    const fallback = store.createAiProfile({ ...profile, name: 'fallback-test' });
    store.setAiRoleBinding('editorial_scan', { primaryProfileId: primary.id, fallbackProfileId: fallback.id });
    try {
      const captured = [];
      const failingTransport = async (_url, options) => {
        captured.push(JSON.parse(options.body));
        return captured.length === 1 ? { ok: false, status: 429, text: '{}' }
          : { ok: true, status: 200, text: JSON.stringify({ output_text: 'bad json', usage: usage() }) };
      };
      await assert.rejects(runtime.runStructuredAI({ role: 'editorial_scan', prompt: 'Return JSON', schema,
        maxOutputTokens: 25, allowRepair: false, transport: failingTransport,
      }), error => error.code === 'invalid_structured_output');
      assert.equal(captured.length, 2);
      assert.ok(captured.every(body => body.max_output_tokens === 25));
      captured.length = 0;
      await assert.rejects(runtime.runStructuredAI({ role: 'editorial_scan', prompt: 'Return JSON', schema,
        maxOutputTokens: 25, allowRepair: false, allowFallback: false, transport: failingTransport,
      }), error => error.code === 'rate_limit');
      assert.equal(captured.length, 1);
    } finally {
      store.clearAiRoleBinding('editorial_scan');
    }
  });

  await test('bounded invalid output preserves known failed-attempt usage as error metadata', async () => {
    const captured = [];
    const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema, maxOutputTokens: 25, allowRepair: false, allowFallback: false,
      transport: transport([{ output_text: 'bad json', usage: usage() }], captured),
    }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 'invalid_structured_output');
    assert.equal(captured.length, 1);
    assert.deepEqual(error.failedAttemptUsage, {
      inputTokens: 50, cachedInputTokens: 20, outputTokens: 10, reasoningTokens: 3, costUsd: null,
    });
  });

  await test('failed refusal-shaped responses preserve provider usage without extra calls', async () => {
    const captured = [];
    const error = await direct.runDirectStructuredAI(profile, { prompt: 'Return JSON', schema,
      transport: transport([{ output: [{ content: [{ type: 'refusal', refusal: 'no' }] }], usage: usage() }], captured),
    }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 'provider_error');
    assert.equal(captured.length, 1);
    assert.equal(error.failedAttemptUsage?.inputTokens, 50);
    assert.equal(error.failedAttemptUsage?.cachedInputTokens, 20);
    assert.equal(error.failedAttemptUsage?.outputTokens, 10);
    assert.equal(error.failedAttemptUsage?.reasoningTokens, 3);
  });

  await test('failed repair aggregates failed-attempt usage with unknown-stays-unknown', async () => {
    const captured = [];
    const aggregated = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema,
      transport: transport([{ output_text: 'bad json', usage: usage() },
        { output_text: 'still bad', usage: usage(30, 8, 10, 2) }], captured),
    }).then(() => null, (failure) => failure);
    assert.equal(aggregated?.code, 'invalid_structured_output');
    assert.equal(captured.length, 2);
    assert.deepEqual(aggregated.failedAttemptUsage, {
      inputTokens: 80, cachedInputTokens: 30, outputTokens: 18, reasoningTokens: 5, costUsd: null,
    });
    const capturedUnknown = [];
    const unknown = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
      prompt: 'Return JSON', schema,
      transport: transport([{ output_text: 'bad json' }, { output_text: 'still bad', usage: usage() }], capturedUnknown),
    }).then(() => null, (failure) => failure);
    assert.equal(unknown?.code, 'invalid_structured_output');
    assert.equal(capturedUnknown.length, 2);
    assert.deepEqual(unknown.failedAttemptUsage, {
      inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, costUsd: null,
    });
  });

  await test('post-adapter response_limit preserves known usage as error metadata', async () => {
    const captured = [];
    const bigText = JSON.stringify({ ok: true, pad: 'x'.repeat(500) });
    process.env.AI_MAX_RESPONSE_BYTES = '64';
    try {
      const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
        prompt: 'Return JSON', schema, allowRepair: false, allowFallback: false,
        transport: transport([{ output_text: bigText, usage: usage() }], captured),
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'response_limit');
      assert.equal(captured.length, 1);
      assert.deepEqual(error.failedAttemptUsage, {
        inputTokens: 50, cachedInputTokens: 20, outputTokens: 10, reasoningTokens: 3, costUsd: null,
      });
    } finally {
      delete process.env.AI_MAX_RESPONSE_BYTES;
    }
  });

  await test('post-adapter timeout preserves known usage as error metadata', async () => {
    const captured = [];
    const realNow = Date.now;
    let clock = realNow();
    Date.now = () => clock;
    try {
      const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
        prompt: 'Return JSON', schema, timeoutMs: 5000, allowRepair: false, allowFallback: false,
        transport: async (_url, options) => {
          captured.push(JSON.parse(options.body));
          clock += 6000;
          return { status: 200, ok: true, text: JSON.stringify({ output_text: '{"ok":true}', usage: usage() }) };
        },
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'timeout');
      assert.equal(captured.length, 1);
      assert.deepEqual(error.failedAttemptUsage, {
        inputTokens: 50, cachedInputTokens: 20, outputTokens: 10, reasoningTokens: 3, costUsd: null,
      });
    } finally {
      Date.now = realNow;
    }
  });

  await test('completed adapter failures count exactly one request, thrown and persisted', async () => {
    {
      const captured = [];
      const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
        prompt: 'Return JSON', schema, allowRepair: false, allowFallback: false,
        transport: transport([{ output: [{ content: [{ type: 'refusal', refusal: 'no' }] }], usage: usage() }], captured),
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'provider_error');
      assert.equal(captured.length, 1);
      assert.equal(error.requestCount, 1);
      const runs = store.listAiRuns({ invocationId: error.invocationId });
      assert.equal(runs.length, 1);
      assert.equal(runs[0].metadata.requestCount, 1);
    }
    {
      const captured = [];
      const bigText = JSON.stringify({ ok: true, pad: 'x'.repeat(500) });
      process.env.AI_MAX_RESPONSE_BYTES = '64';
      try {
        const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
          prompt: 'Return JSON', schema, allowRepair: false, allowFallback: false,
          transport: transport([{ output_text: bigText, usage: usage() }], captured),
        }).then(() => null, (failure) => failure);
        assert.equal(error?.code, 'response_limit');
        assert.equal(error.requestCount, 1);
        const runs = store.listAiRuns({ invocationId: error.invocationId });
        assert.equal(runs[0].metadata.requestCount, 1);
      } finally {
        delete process.env.AI_MAX_RESPONSE_BYTES;
      }
    }
    {
      const captured = [];
      const realNow = Date.now;
      let clock = realNow();
      Date.now = () => clock;
      try {
        const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
          prompt: 'Return JSON', schema, timeoutMs: 5000, allowRepair: false, allowFallback: false,
          transport: async (_url, options) => {
            captured.push(JSON.parse(options.body));
            clock += 6000;
            return { status: 200, ok: true, text: JSON.stringify({ output_text: '{"ok":true}', usage: usage() }) };
          },
        }).then(() => null, (failure) => failure);
        assert.equal(error?.code, 'timeout');
        assert.equal(error.requestCount, 1);
        const runs = store.listAiRuns({ invocationId: error.invocationId });
        assert.equal(runs[0].metadata.requestCount, 1);
      } finally {
        Date.now = realNow;
      }
    }
  });

  await test('failing repair keeps both receipts in count and usage', async () => {
    const captured = [];
    const bigText = JSON.stringify({ ok: true, pad: 'x'.repeat(500) });
    process.env.AI_MAX_RESPONSE_BYTES = '64';
    try {
      const error = await runtime.runStructuredAI({ role: 'editorial_scan', profile,
        prompt: 'Return JSON', schema, allowFallback: false,
        transport: transport([{ output_text: 'bad json', usage: usage() },
          { output_text: bigText, usage: usage(30, 8, 10, 2) }], captured),
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'response_limit');
      assert.equal(captured.length, 2);
      assert.equal(error.requestCount, 2);
      assert.deepEqual(error.failedAttemptUsage, {
        inputTokens: 80, cachedInputTokens: 30, outputTokens: 18, reasoningTokens: 5, costUsd: null,
      });
      const runs = store.listAiRuns({ invocationId: error.invocationId });
      assert.equal(runs[0].metadata.requestCount, 2);
      assert.deepEqual(runs[0].metadata.failedAttemptUsage, error.failedAttemptUsage);
    } finally {
      delete process.env.AI_MAX_RESPONSE_BYTES;
    }
  });

  await test('pre-dispatch failures are never counted as requests', async () => {
    const captured = [];
    const error = await runtime.runStructuredAI({ role: 'editorial_scan',
      profile: { ...profile, secretRef: 'file:missing-secret-xyz' },
      prompt: 'Return JSON', schema, allowRepair: false, allowFallback: false,
      transport: transport([], captured),
    }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 'auth');
    assert.equal(error.requestCount, 0);
    assert.equal(error.failedAttemptUsage ?? null, null);
    assert.equal(captured.length, 0);
    const runs = store.listAiRuns({ invocationId: error.invocationId });
    assert.equal(runs[0].metadata.requestCount, 0);
  });

  await test('controller strict schema declares a type and requires every property', () => {
    assert.deepEqual([...CONTROLLER_DECISION_SCHEMA.required].sort(), Object.keys(CONTROLLER_DECISION_SCHEMA.properties).sort());
    assert.ok(Object.values(CONTROLLER_DECISION_SCHEMA.properties).every(property => property.type === 'string'));
  });
} finally {
  process.chdir(cwd);
  await rm(scratch, { recursive: true, force: true });
}
