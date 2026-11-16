# AlgoPilot

A local-first technical interview practice workspace built with Next.js App Router, TypeScript, and Tailwind. No accounts, remote APIs, scraping, calendar sync, or Fo connection are implemented.

## Run

Use Node.js 22.18+ (Node 24 recommended):

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

Open http://localhost:3000. All navigation is within the local workspace.

## Features

- Dashboard and analytics calculated from recorded attempts and sessions; no sample progress.
- Manual problem journal with tags, difficulty, optional LeetCode link, multiple attempts, confidence, reflection notes, search, filters, editing, and deletion.
- Explainable deterministic review scheduling and a prioritized due queue.
- Availability-based study planning, timezone selection, interview cutoff, weekly goals, rescheduling, skipping, and completion.
- Versioned, validated browser storage, JSON backup/import, and recovery export for invalid saved data.
- Disabled Fo integration card and a stored interest preference only.

## Architecture

- [Types and defaults](src/lib/types.ts)
- [Review engine](src/lib/review.ts)
- [Timezone-aware planner](src/lib/planner.ts)
- [Validation and persistence](src/lib/storage.ts)
- [Client interface](src/components/algopilot.tsx)
- [Core tests](tests/core.test.ts)

The server renders a stable loading state. Storage loads after mounting. Mutations validate and persist before updating the interface, so storage failures are visible. Other tabs receive storage updates. Local data is not encrypted or synced; export backups before clearing browser data or switching devices.

## Review rules

The engine folds attempts in chronological order. Failed attempts use 1 day divided by consecutive failures (minimum 6 hours). Hint-assisted solves use 75% of the previous interval, clamped to 1–3 days. Independent solves multiply the previous interval by 1.3 + confidence × 0.3, with a 2-day floor and 90-day ceiling. Confidence 1–2 halves the resulting interval, with a 6-hour minimum. Reviews are anchored to the latest attempt timestamp. Due priority combines overdue days, failure/hint outcome, and low confidence. Intervals are elapsed hours, independent of timezone.

Topic mastery averages the latest outcome score (independent = 1, hints = 0.5, failed = 0) multiplied by confidence / 5. It is a learning signal, not a validated proficiency assessment. Streaks use attempt dates in the configured timezone and permit an unfinished current day.

## Planner rules

Generate up to 28 days, ending at the interview date. Availability uses IANA timezone wall-clock times. Spring-forward nonexistent times are rejected; ambiguous fall-back times resolve deterministically to one occurrence. Sessions never start in the past and never overlap active sessions. Week boundaries are Monday in the selected timezone. Completed and scheduled sessions count toward weekly goals; skipped sessions do not. Generation adds slots without replacing existing work, using one new session per availability window per date. Regeneration may fill other free slots up to the goal. Manual rescheduling permits exceptions to availability and goals, but still rejects past times and overlaps. Complete becomes available after the session starts. Changing timezone preserves existing session instants.

## Manual acceptance check

1. Open a fresh browser profile: all metrics should be zero or empty.
2. Add a problem with tags, a failed outcome, low confidence, and notes. Expand it in Problems and verify the attempt.
3. Record another independent attempt; verify both attempts and the changed review time.
4. Reload and confirm persistence. Exercise search, topic/difficulty/outcome filters, edit, and delete.
5. In Settings, set your timezone and future availability. Save and generate a plan. Check all times against availability. Generate again and ensure there are no overlaps.
6. Reschedule a session to a future time, attempt an overlapping time, and skip a session. Completion is enabled once a session starts.
7. Export JSON, import that backup, and verify data. Invalid schema, duplicate IDs, unsafe problem URLs, and overlapping active sessions should be rejected without replacement.
8. Check narrow mobile layout, keyboard navigation, modal Escape, and focus containment.

Tests cover review intervals, low-confidence behavior, recommendation eligibility, overlaps, scheduling constraints, DST conversion, and persistence validation. Browser interaction and visual checks should also be performed before release.
