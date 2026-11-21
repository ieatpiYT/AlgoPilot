import 'server-only';
import { randomBytes } from 'node:crypto';
import { FoProvider, inspectFo, transport } from './client.ts';
import { allowedRequest, blockedSubmission, consumeState, equalSecret } from './policy.ts';

type Owner = { id: string; expires: number; provider: FoProvider; status: string; busy: boolean; tools: unknown[] };
// One process, one authenticated owner. Hot reload preserves this state; restart clears it.
const globalFo = globalThis as typeof globalThis & { rylunoFo?: { owner?: Owner; nextLogin: number } };
const state = globalFo.rylunoFo ??= { nextLogin: 0 };
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
function ownerFor(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('ryluno_fo='))?.slice(10);
  if (state.owner && state.owner.expires <= Date.now()) state.owner = undefined;
  return cookie && state.owner && equalSecret(cookie, state.owner.id) ? state.owner : undefined;
}
export async function handleFo(request: Request, action: string) {
  if (!allowedRequest(request)) return json({ status: 'disabled', message: 'Fo requires enabled, authenticated localhost development. See docs/fo-integration.md.' }, 403);
  if (action === 'login' && request.method === 'POST') {
    if (Date.now() < state.nextLogin) return json({ message: 'Wait a few seconds before trying again.' }, 429);
    state.nextLogin = Date.now() + 3000;
    const body = await readBody(request);
    if (typeof body.password !== 'string' || !equalSecret(body.password, process.env.FO_DEV_PASSWORD!)) return json({ message: 'Invalid development password.' }, 401);
    state.owner = { id: randomBytes(32).toString('hex'), expires: Date.now() + 3_600_000, provider: new FoProvider(), status: 'disconnected', busy: false, tools: [] };
    const response = json({ status: 'disconnected' });
    response.headers.set('Set-Cookie', `ryluno_fo=${state.owner.id}; HttpOnly; SameSite=Lax; Path=/api/fo; Max-Age=3600`);
    return response;
  }
  const owner = ownerFor(request);
  if (!owner) return json({ status: 'locked', message: 'Unlock the local Fo connection first.' }, 401);
  if (action === 'status' && request.method === 'GET') return json({ status: owner.status, submissionEnabled: false, schemasAvailable: owner.tools.length > 0 });
  if (action === 'schemas' && request.method === 'GET') return json({ tools: owner.tools });
  if (action === 'logout' && request.method === 'POST') { state.owner = undefined; return json({ status: 'locked' }); }
  if (action === 'check-in' && request.method === 'POST') {
    const body = await readBody(request);
    return json(blockedSubmission(body.confirmed), 409);
  }
  if (owner.busy) return json({ status: 'pending', message: 'A connection operation is already in progress. No second operation was started.' }, 409);
  if (action === 'connect' && request.method === 'POST') {
    owner.busy = true; owner.status = 'pending';
    try {
      const result = await inspectFo(owner.provider);
      owner.status = result.status; owner.tools = result.tools;
      return json({ status: owner.status, authorizationUrl: owner.provider.authorizationUrl });
    } catch { owner.status = 'error'; return json({ status: 'error', message: 'Fo connection failed. Check network access and Wajo client registration. No check-in was sent.' }, 502); }
    finally { owner.busy = false; }
  }
  if (action === 'callback' && request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (!consumeState(owner.provider.flow, params.get('state'))) return json({ message: 'Invalid, expired, or already-used OAuth state.' }, 400);
    owner.busy = true;
    try {
      if (params.has('error') || !params.get('code')) throw new Error('Authorization declined');
      const connection = transport(owner.provider);
      try { await connection.finishAuth(params); } finally { await connection.close().catch(() => {}); }
      const result = await inspectFo(owner.provider);
      owner.status = result.status; owner.tools = result.tools;
    } catch { owner.status = 'error'; }
    finally { owner.busy = false; }
    return new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  return json({ message: 'Unsupported operation.' }, 405);
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return {};
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 8192) { await reader.cancel(); return {}; } chunks.push(value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString());
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
