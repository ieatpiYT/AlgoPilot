import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequest, blockedSubmission, consumeState } from '../src/lib/fo/policy.ts';
import { handleFo } from '../src/lib/fo/server.ts';
import { FoProvider, inspectFo, transport } from '../src/lib/fo/client.ts';

const env = { NODE_ENV: 'development', FO_DEV_ENABLED: 'true', FO_DEV_PASSWORD: 'x'.repeat(40) } as NodeJS.ProcessEnv;
function request(action: string, method = 'GET', body?: object, cookie = '') {
  return new Request(`http://localhost:3000/api/fo/${action}`, { method,
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test('authorization gate rejects production, unconfigured, foreign hosts and cross-origin writes', () => {
  assert.equal(allowedRequest(request('connect', 'POST'), env), true);
  assert.equal(allowedRequest(request('status'), { ...env, NODE_ENV: 'production' }), false);
  assert.equal(allowedRequest(request('status'), { ...env, FO_DEV_PASSWORD: '' }), false);
  const foreign = request('connect', 'POST'); foreign.headers.set('origin', 'https://evil.example');
  assert.equal(allowedRequest(foreign, env), false);
  const host = request('status'); host.headers.set('host', 'evil.example');
  assert.equal(allowedRequest(host, env), false);
});
test('OAuth state is bound, expires, and cannot be replayed', () => {
  const flow = { state: 'secret', expires: 100 };
  assert.equal(consumeState(flow, 'wrong', 50), false);
  assert.equal(consumeState(flow, 'secret', 50), true);
  assert.equal(consumeState(flow, 'secret', 50), false);
  assert.equal(consumeState({ state: 'secret', expires: 100 }, 'secret', 101), false);
});
test('issuer and resource pinning refuse foreign destinations', async () => {
  const provider = new FoProvider();
  assert.throws(() => provider.redirectToAuthorization(new URL('https://evil.example/oauth/authorize')));
  await assert.rejects(provider.validateResourceURL('https://mcp.api.wajo.ai/fo', 'https://evil.example'));
  assert.equal(provider.clientInformation({ issuer: 'https://evil.example' }), undefined);
});
test('unconfirmed and duplicate confirmed check-ins never submit without verified schemas', () => {
  assert.equal(blockedSubmission(false).status, 'approval_required');
  assert.equal(blockedSubmission('true').status, 'approval_required');
  assert.deepEqual(blockedSubmission(true), blockedSubmission(true));
  assert.equal(blockedSubmission(true).status, 'blocked');
});
test('official SDK discovers OAuth, registers a separate client, uses PKCE, and exchanges a code (mock OAuth server)', async () => {
  const originalFetch = globalThis.fetch;
  const issuer = 'https://mcp.api.wajo.ai';
  const provider = new FoProvider();
  let registration = false, exchanged = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/fo') return new Response('', { status: 401, headers: { 'www-authenticate': `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource/fo"` } });
    if (url.pathname.includes('oauth-protected-resource')) return Response.json({ resource: `${issuer}/fo`, authorization_servers: [issuer], scopes_supported: ['mcp'] });
    if (url.pathname.includes('oauth-authorization-server')) return Response.json({ issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`, registration_endpoint: `${issuer}/oauth/register`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'] });
    if (url.pathname === '/oauth/register') {
      const metadata = JSON.parse(String(init?.body));
      assert.deepEqual(metadata.redirect_uris, [provider.redirectUrl]);
      assert.equal(metadata.token_endpoint_auth_method, 'none');
      registration = true;
      return Response.json({ ...metadata, client_id: 'mock-ryluno-client' }, { status: 201 });
    }
    if (url.pathname === '/oauth/token') {
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get('client_id'), 'mock-ryluno-client');
      assert.equal(params.get('code_verifier'), provider.codeVerifier());
      assert.equal(params.get('resource'), `${issuer}/fo`);
      exchanged = true;
      return Response.json({ access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 });
    }
    throw new Error('Unexpected mock request');
  };
  try {
    assert.equal((await inspectFo(provider)).status, 'authorization_required');
    assert.equal(registration, true);
    const redirect = new URL(provider.authorizationUrl!);
    assert.equal(redirect.searchParams.get('state'), provider.flow.state);
    assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(redirect.searchParams.get('code_challenge'));
    const connection = transport(provider);
    try { await connection.finishAuth(new URLSearchParams({ code: 'mock-code' })); }
    finally { await connection.close(); }
    assert.equal(exchanged, true);
    assert.equal(provider.tokens()?.access_token, 'mock-token');
  } finally { globalThis.fetch = originalFetch; }
});
test('routes enforce login, expose pending, reject concurrent attempts, and report failed connections', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, FO_DEV_ENABLED: process.env.FO_DEV_ENABLED, FO_DEV_PASSWORD: process.env.FO_DEV_PASSWORD };
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  try {
    assert.equal((await handleFo(request('status'), 'status')).status, 401);
    assert.equal((await handleFo(request('connect', 'POST'), 'connect')).status, 401);
    const login = await handleFo(request('login', 'POST', { password: env.FO_DEV_PASSWORD }), 'login');
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.match(login.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
    assert.equal((await handleFo(request('callback?state=invalid&code=fake', 'GET', undefined, cookie), 'callback')).status, 400);
    let rejectFetch!: (reason: Error) => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise<Response>((_, reject) => { rejectFetch = reject; }); };
    const first = handleFo(request('connect', 'POST', {}, cookie), 'connect');
    await ready;
    const pending = await handleFo(request('status', 'GET', undefined, cookie), 'status');
    assert.equal((await pending.json()).status, 'pending');
    const duplicate = await handleFo(request('connect', 'POST', {}, cookie), 'connect');
    assert.equal(duplicate.status, 409);
    rejectFetch(new Error('sensitive network detail'));
    const failed = await first;
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /sensitive network detail/);
    for (let i = 0; i < 2; i++) {
      const blocked = await handleFo(request('check-in', 'POST', { confirmed: true }, cookie), 'check-in');
      assert.equal((await blocked.json()).status, 'blocked');
    }
    await handleFo(request('logout', 'POST', {}, cookie), 'logout');
    assert.equal((await handleFo(request('status', 'GET', undefined, cookie), 'status')).status, 401);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
