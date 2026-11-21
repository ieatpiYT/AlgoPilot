import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFoAccess, requestFoAction } from '../src/lib/fo/browser-access.ts';

function responses(items: Response[]) {
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const response = items.shift();
    assert.ok(response, 'No extra request or retry is permitted');
    return response;
  };
  return { calls, fetcher };
}
test('accepted password with rejected cookie stays locked without starting OAuth', async () => {
  const { fetcher, calls } = responses([
    Response.json({ status: 'disconnected', authenticated: true }),
    Response.json({ status: 'locked', authenticated: false, reason: 'missing_cookie' }, { status: 401 }),
  ]);
  const result = await requestFoAction('login', { password: 'test-only' }, fetcher);
  assert.equal(result.authenticated, false);
  assert.equal(result.status, 'locked');
  assert.match(result.message!, /password was accepted/);
  assert.match(result.message!, /OAuth has not started/);
  assert.deepEqual(calls.map(call => call.url), ['/api/fo/login', '/api/fo/status']);
  assert.ok(calls.every(call => call.options?.credentials === 'same-origin'));
});
test('unlock succeeds only after a separate authenticated request', async () => {
  const { fetcher, calls } = responses([
    Response.json({ status: 'disconnected', authenticated: true }),
    Response.json({ status: 'disconnected', authenticated: true }),
  ]);
  assert.equal((await requestFoAction('login', {}, fetcher)).authenticated, true);
  assert.equal(calls[1].options?.cache, 'no-store');
});
test('failed password never triggers cookie verification or authorization', async () => {
  const { fetcher, calls } = responses([Response.json({ message: 'Invalid development password.' }, { status: 401 })]);
  assert.match((await requestFoAction('login', {}, fetcher)).message!, /Invalid/);
  assert.equal(calls.length, 1);
});
test('connect rejects a stale or absent cookie before making an OAuth request', async () => {
  const { fetcher, calls } = responses([Response.json({ status: 'locked', authenticated: false }, { status: 401 })]);
  assert.equal((await requestFoAction('connect', {}, fetcher)).authenticated, false);
  assert.deepEqual(calls.map(call => call.url), ['/api/fo/status']);
});
test('connect proceeds exactly once after cookie verification', async () => {
  const { fetcher, calls } = responses([
    Response.json({ status: 'disconnected', authenticated: true }),
    Response.json({ status: 'authorization_required', authorizationUrl: 'https://mcp.api.wajo.ai/oauth/authorize' }),
  ]);
  assert.equal((await requestFoAction('connect', {}, fetcher)).status, 'authorization_required');
  assert.deepEqual(calls.map(call => call.url), ['/api/fo/status', '/api/fo/connect']);
});
test('unavailable status endpoint cannot assert authentication', async () => {
  const { fetcher } = responses([Response.json({ authenticated: true }, { status: 503 })]);
  assert.equal((await readFoAccess(fetcher)).authenticated, false);
});
