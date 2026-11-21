# Fo integration: verified foundation, submission blocked

## Evidence inspected on November 20, 2026 (Toronto)

- The unauthenticated Fo endpoint returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://mcp.api.wajo.ai/.well-known/oauth-protected-resource/fo"`.
- [Protected resource metadata](https://mcp.api.wajo.ai/.well-known/oauth-protected-resource/fo) names resource `https://mcp.api.wajo.ai/fo`, authorization server `https://mcp.api.wajo.ai`, and scope `mcp`.
- [Authorization metadata](https://mcp.api.wajo.ai/.well-known/oauth-authorization-server) advertises `/oauth/authorize`, `/oauth/token`, `/oauth/register`, authorization-code and refresh-token grants, public-client token authentication (`none`), and PKCE `S256`.
- The referenced Copilot configuration contains only an HTTP server URL and no headers. Its separately managed OAuth credentials were not accessed or reused.
- Consulted official [v2 OAuth documentation](https://ts.sdk.modelcontextprotocol.io/v2/clients/oauth.md), [client transport documentation](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect.md), and installed SDK declarations. The supported official client is `@modelcontextprotocol/client` 2.4.0. Some current documentation describes logging options absent from this installed release; the integration does not rely on those options.

## What is implemented

Server-only SDK transport, ephemeral OAuth provider, dynamic registration support, PKCE, issuer/resource restrictions, expiring one-use state bound to the local authenticated browser, callback handling, and authenticated read-only tool discovery. Settings displays connection state and exact proposed text instructions for a chosen session. Existing planner data remains browser-local.

All Fo routes require development mode, explicit enablement, the exact localhost origin/host, and (except login) a random HttpOnly session cookie. Writes also require the matching Origin. A 32-character minimum local password gates login; failed login attempts are throttled. Production routes fail closed. Use one local Node process, no public tunnel, reverse proxy, shared machine, or multi-user deployment.

Tokens, registration information, verifier, and schemas remain in server memory, never Git, browser storage, or logs. Local login lasts one hour; a new login replaces the previous session. Restarting loses authorization. There is no durable token vault. Local disconnect deletes the connection; revoke consent at Wajo separately if needed. SDK error descriptions are sanitized and Next development request logging is disabled so callback codes do not appear in request logs.

## Exact next setup step

1. Create an ignored `.env.local` in the project root with `FO_DEV_ENABLED=true` and `FO_DEV_PASSWORD=<a unique random secret of at least 32 characters>`. Do not use a Wajo password or token. Generate a secret locally, for example `openssl rand -hex 32`.
2. Start `npm run dev -- --hostname localhost --port 3000` and open `http://localhost:3000`. Open Preferences, enter that local secret, and select **Unlock local connection**, then **Connect Fo**.
3. Ryluno attempts dynamic registration with callback **`http://localhost:3000/api/fo/callback`**, application type `web`, scope `mcp`, and PKCE. Complete Wajo consent in the browser. No manual client registration is assumed necessary because DCR is advertised, but registration and callback acceptance have NOT been live-tested. If rejected, ask Wajo to enable a public web OAuth client for this exact callback and confirm whether localhost web redirects are accepted. A manually issued client ID would require a separately reviewed configuration path; none is fabricated here.
4. After successful consent, return to Preferences and verify connection. In the same authenticated browser, inspect `http://localhost:3000/api/fo/schemas`. This returns the actual discovered tool definitions, not credentials. Review `ask_fo`, `get_fo_reply`, and `get_fo_conversation` schemas and documented result examples before implementing an argument/result adapter. The current discovery stores the first tools/list page only; inspect pagination if needed.

## Deliberate blocker

No website OAuth consent or authenticated tool listing was available during implementation. Therefore **there is no tool call implementation**. No input keys, task IDs, polling intervals, approval protocol, or success responses are invented. The preview confirmation control cannot send. Even direct or repeated requests to the authenticated check-in endpoint return `blocked`; unconfirmed requests return `approval_required`. These are local application states, not claimed Fo responses.

Connection operations expose pending/error states and reject concurrent attempts. Actual asynchronous Fo replies, tasks, and remote approvals remain unimplemented pending verified schemas and output contracts. No automatic polling, retries of check-ins, background actions, or telephone calls are enabled. OAuth/connection may perform SDK authentication negotiation; that never invokes a Fo tool.

Before enabling submission, add a schema-validated adapter, durable per-session idempotency records written before dispatch (including ambiguous timeouts), exact instruction binding at confirmation, explicit approval presentation, and safe status-only polling using verified reply fields. Test real text submission only with explicit user confirmation of the preview. A real end-to-end check-in has **not** succeeded or been claimed.

## Validation

`npm test` uses Node's `react-server` condition to load server-only modules in route tests. Tests cover production/origin/host authorization, unauthenticated access, state expiry/replay, issuer/resource restrictions, connection pending/failure, concurrent connection suppression, and repeated blocked submissions. They do not simulate a successful Fo response or establish Wajo compatibility.

The official SDK OAuth flow is additionally tested against mock discovery, registration, and token endpoints (including PKCE and resource binding). Final verification: 14 tests passed, TypeScript passed, ESLint passed, and the production build passed. The build required an unrestricted run because Turbopack's local worker port was blocked by the sandbox. No deployment or push was performed.
