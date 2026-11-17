# Ryluno

A local-first technical interview practice workspace. Ryluno tracks every attempt you make on a problem, schedules your next review with a deterministic, explainable algorithm, and plans study sessions around your real availability — all in the browser, with no accounts, no remote APIs, and no data leaving your machine.

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

- **Dashboard and analytics** calculated from recorded attempts and sessions — no sample progress, ever.
- **Problem journal** with tags, difficulty, optional LeetCode link, multiple attempts per problem, confidence ratings, reflection notes, search, filters, editing, and deletion.
- **Explainable deterministic review scheduling** with a prioritized due queue — every review date can be traced back to the exact rule that produced it.
- **Availability-based study planning** with timezone selection, interview-date cutoff, weekly goals, rescheduling, skipping, and completion tracking.
- **Versioned, validated browser storage** with JSON backup/import and a recovery export for invalid saved data.
- **Data visualization suite**: interval-growth curves on a log scale, an interactive recall simulator, a scheduling transfer function, a priority field bubble chart, topic-mastery radar, a DST gap illustration, an availability heatmap, and a GitHub-style streak grid.

## Architecture

- `src/lib/types.ts` — types and defaults
- `src/lib/review.ts` — review engine
- `src/lib/planner.ts` — timezone-aware planner
- `src/lib/storage.ts` — validation and persistence
- `src/components/` — client interface and figure components
- `tests/` — core algorithm tests

The server renders a stable loading state; storage loads after mounting. Mutations validate and persist before updating the interface, so storage failures are visible. Other tabs receive storage updates. Local data is not encrypted or synced — export backups before clearing browser data or switching devices.

## Review rules

The engine folds attempts in chronological order:

- **Failed attempts** use 1 day divided by consecutive failures (minimum 6 hours).
- **Hint-assisted solves** use 75% of the previous interval, clamped to 1–3 days.
- **Independent solves** multiply the previous interval by `1.3 + confidence × 0.3`, with a 2-day floor and 90-day ceiling.
- **Confidence 1–2** halves the resulting interval, with a 6-hour minimum.

Reviews are anchored to the latest attempt timestamp. Due priority combines overdue days, failure/hint outcome, and low confidence. Intervals are elapsed hours, independent of timezone.

Topic mastery averages the latest outcome score (independent = 1, hints = 0.5, failed = 0) multiplied by confidence / 5. It is a learning signal, not a validated proficiency assessment. Streaks use attempt dates in the configured timezone and permit an unfinished current day.

## Planner rules

- Generate up to 28 days, ending at the interview date.
- Availability uses IANA timezone wall-clock times. Spring-forward nonexistent times are rejected; ambiguous fall-back times resolve deterministically to one occurrence.
- Sessions never start in the past and never overlap active sessions.
- Week boundaries are Monday in the selected timezone.
- Completed and scheduled sessions count toward weekly goals; skipped sessions do not.
- Generation adds slots without replacing existing work — one new session per availability window per date. Regeneration may fill other free slots up to the goal.
- Manual rescheduling permits exceptions to availability and goals, but still rejects past times and overlaps.
- Completion becomes available after the session starts. Changing timezone preserves existing session instants.

## Built with

- **TanStack Start** — full-stack React framework with SSR and file-based routing
- **React 19** + **TypeScript** — strict, type-safe UI
- **Tailwind CSS v4** — token-based styling with a dark, research-paper visual system
- **Recharts** — composable charting for the analytics figures
- **Vitest** — unit tests for the scheduling and planning algorithms

## Testing

Tests cover review intervals, low-confidence behavior, recommendation eligibility, overlaps, scheduling constraints, DST conversion, and persistence validation:

```sh
npm test
```

## Manual acceptance check

1. Open a fresh browser profile: all metrics should be zero or empty.
2. Add a problem with tags, a failed outcome, low confidence, and notes. Expand it in Problems and verify the attempt.
3. Record another independent attempt; verify both attempts and the changed review time.
4. Reload and confirm persistence. Exercise search, topic/difficulty/outcome filters, edit, and delete.
5. In Settings, set your timezone and future availability. Save and generate a plan. Check all times against availability. Generate again and ensure there are no overlaps.
6. Reschedule a session to a future time, attempt an overlapping time, and skip a session. Completion is enabled once a session starts.
7. Export JSON, import that backup, and verify data. Invalid schema, duplicate IDs, unsafe problem URLs, and overlapping active sessions should be rejected without replacement.
8. Check narrow mobile layout, keyboard navigation, modal Escape, and focus containment.

## Design principles

- **Local-first**: your data is yours. No signup, no sync, no telemetry.
- **Explainable over clever**: deterministic rules you can read, not a black-box model.
- **Honest metrics**: every number on the dashboard is derived from attempts you actually recorded.
