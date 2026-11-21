import { timingSafeEqual } from 'node:crypto';

export const LOCAL_ORIGIN = 'http://localhost:3000';
export function allowedRequest(request: Request, env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'development' && env.FO_DEV_ENABLED === 'true'
    && (env.FO_DEV_PASSWORD?.length ?? 0) >= 32
    && new URL(request.url).origin === LOCAL_ORIGIN
    && request.headers.get('host') === 'localhost:3000'
    && (request.method === 'GET' || request.headers.get('origin') === LOCAL_ORIGIN);
}
export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function consumeState(flow: { state: string; expires: number }, received: string | null, now = Date.now()) {
  const valid = !!received && flow.expires > now && equalSecret(flow.state, received);
  if (valid) { flow.state = ''; flow.expires = 0; }
  return valid;
}

// No tool input mapping has been verified. Even a confirmed request must fail closed.
export const SCHEMA_BLOCKER = 'Text submission is unavailable until ask_fo and reply schemas are verified for this website connection. Nothing was sent.';
export function blockedSubmission(confirmed: unknown) {
  return confirmed === true
    ? { status: 'blocked', message: SCHEMA_BLOCKER }
    : { status: 'approval_required', message: 'Review the exact instructions and explicitly confirm first. Nothing was sent.' };
}
