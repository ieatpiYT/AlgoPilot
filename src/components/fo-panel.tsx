'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@/lib/types';
import { Dialog } from './dialog';

const labels: Record<string, string> = {
  loading: 'Checking local connection…', disabled: 'Development setup required', locked: 'Local connection locked',
  disconnected: 'Not connected to Fo', pending: 'Connection pending', authorization_required: 'Wajo authorization required',
  connected: 'Connected · tool schemas retrieved', error: 'Connection failed',
};
export function FoPanel({ sessions, timezone }: { sessions: Session[]; timezone: string }) {
  const [status, setStatus] = useState('loading');
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [preview, setPreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const session = sessions.find(s => s.id === sessionId);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/fo/status', { cache: 'no-store', signal: controller.signal })
      .then(r => r.json()).then(data => { setStatus(data.status); setAuthenticated(data.authenticated === true); setMessage(data.message ?? ''); })
      .catch(() => { if (!controller.signal.aborted) { setStatus('error'); setMessage('Could not read connection status.'); } });
    return () => controller.abort();
  }, []);
  async function action(name: string, body: object = {}) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/fo/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      setStatus(result.status ?? 'error'); setMessage(result.message ?? '');
      if (typeof result.authenticated === 'boolean') setAuthenticated(result.authenticated);
      if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
    } catch { setStatus('error'); setMessage('Connection request failed. No automatic retry was made.'); }
    finally { setPassword(''); inFlight.current = false; setBusy(false); }
  }
  const instructions = session ? `Please give me a text-only accountability check-in for my interview study session.\nStart: ${session.start}\nEnd: ${session.end}\nTimezone: ${timezone}\nSession status: ${session.status}\nAsk whether I studied, what I practiced, and one small next step. Reply in text only. Do not start a phone call or contact anyone else.` : '';
  return <section className="panel">
    <div className="section-heading"><div><h2>Fo accountability</h2><p role="status">{labels[status] ?? 'Connection unavailable'}</p></div></div>
    <p>Fo has a separate website authorization. Your Copilot connection is not shared.</p>
    {message && <p role="status">{message}</p>}
    {!authenticated && (status === 'locked' || status === 'error') && <form onSubmit={event => { event.preventDefault(); void action('login', { password }); }}>
      <label className="field"><span>Local development password</span><input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} required minLength={32}/></label>
      <button disabled={busy}>Unlock local connection</button>
      <p className="subtle">Use FO_DEV_PASSWORD from your local environment file, not your Wajo password. Complete Wajo login and return here in this same browser/profile. If the local server restarts, unlock again and start a fresh connection.</p>
    </form>}
    {authenticated && <div className="row-actions">
      <button disabled={busy} onClick={() => void action('connect')}>{busy ? 'Connecting…' : status === 'connected' ? 'Verify connection' : 'Connect Fo'}</button>
      <button disabled={busy} onClick={() => void action('logout')}>Disconnect locally</button>
    </div>}
    <p className="subtle">Development only at localhost:3000. Tokens live in server memory for this local login and are lost on restart. Disconnect clears them locally; it does not revoke Wajo consent.</p>
    <label className="field"><span>Study session for check-in</span><select value={sessionId} onChange={e => setSessionId(e.target.value)}>
      <option value="">Choose a session</option>{sessions.map(s => <option key={s.id} value={s.id}>{new Date(s.start).toLocaleString(undefined, { timeZone: timezone })} · {s.status}</option>)}
    </select></label>
    <button disabled={!session} onClick={() => { setConfirmed(false); setPreview(true); }}>Request Fo check-in</button>
    <p className="subtle">Preview available. Sending and reply retrieval are blocked until Fo’s authenticated tool schemas are reviewed. No calls or automatic requests are enabled.</p>
    {preview && session && <Dialog title="Review Fo check-in" description="These are the exact proposed instructions. No problem history or notes are included." onClose={() => setPreview(false)}>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{instructions}</pre>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> I approve sending these exact instructions to Fo.</label>
      <p role="status">Submission unavailable: the Fo tool input and asynchronous reply schemas have not been verified. Nothing has been sent.</p>
      <button disabled title="Requires verified Fo schemas">Confirm and send (unavailable)</button>
    </Dialog>}
  </section>;
}
