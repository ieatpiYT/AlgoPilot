# Ryluno

### Technical interview practice, modeled as an explainable scheduling system.

Ryluno's workspace design combines a problem journal, confidence-aware spaced repetition, and availability-based study planning. The companion visualization implementation turns those scheduling rules into inspectable graphs rather than hiding them behind a black box.

> **Implementation scope:** The original workspace specification describes a local-first Next.js application. This repository contains the TanStack Start visualization companion and a tested review-engine implementation. The workspace architecture diagrams below describe the original design; they do not claim that every workspace feature is implemented here.

## Overview

| Area | Approach |
| :--- | :--- |
| Review scheduling | Deterministic interval updates based on outcome and confidence |
| Explainability | Each interval follows an explicit, inspectable rule |
| Visualization | Computed curves, scheduling comparisons, and interactive figures |
| Workspace design | Local-first problem journal and availability-based planner |
| Current implementation | TanStack Start, React 19, TypeScript, Tailwind CSS v4, Recharts |
| Algorithm tests | Vitest |

## System architecture

The workspace design separates scheduling, planning, and persistence from presentation.

```mermaid
flowchart TB
    User([Learner]) --> Workspace[Practice workspace]

    subgraph Presentation[Presentation layer]
        Workspace --> Journal[Problem journal]
        Workspace --> Schedule[Study schedule]
        Workspace --> Analytics[Progress analytics]
    end

    subgraph Domain[Domain logic]
        Journal --> Review[Review engine]
        Schedule --> Planner[Timezone-aware planner]
        Review --> DueQueue[Prioritized review queue]
        Review --> Analytics
        Planner --> Sessions[Study sessions]
    end

    subgraph Persistence[Local-first persistence design]
        Validation[Schema validation]
        Store[(Versioned browser storage)]
        Backup[JSON backup and recovery]
        Validation --> Store
        Store <--> Backup
    end

    Journal --> Validation
    Sessions --> Validation
    Store --> Workspace

    classDef presentation fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e;
    classDef domain fill:#dcfce7,stroke:#15803d,color:#14532d;
    classDef storage fill:#fef3c7,stroke:#b45309,color:#78350f;
    class Workspace,Journal,Schedule,Analytics presentation;
    class Review,Planner,DueQueue,Sessions domain;
    class Validation,Store,Backup storage;
```

## Review interval growth

Independent solves grow the previous interval by a confidence-dependent multiplier. Stronger confidence produces longer gaps; the 90-day ceiling prevents unbounded growth.

The chart starts from a **1-day interval** and shows six consecutive independent solves. Values are computed from the review engine and rounded for display — not measured learning outcomes.

```mermaid
xychart-beta
    title "Independent solves: next review interval"
    x-axis "Consecutive independent solves" [1, 2, 3, 4, 5, 6]
    y-axis "Interval in days" 0 --> 90
    line [2.20, 4.84, 10.65, 23.43, 51.54, 90.00]
    line [2.80, 7.84, 21.95, 61.47, 90.00, 90.00]
```

**Series order:** confidence 3, then confidence 5. Both eventually reach the same ceiling, but confidence 5 reaches it sooner.

### Repeated failure response

Consecutive failures shorten the interval until it reaches the six-hour floor. This chart uses confidence 3, so the additional low-confidence adjustment does not apply.

```mermaid
xychart-beta
    title "Consecutive failures: next review interval"
    x-axis "Consecutive failures" [1, 2, 3, 4, 5, 6]
    y-axis "Interval in hours" 0 --> 24
    bar [24, 12, 8, 6, 6, 6]
```

## Scheduling algorithm

Attempts are processed chronologically. Each attempt updates the interval produced by the previous one.

| Outcome | Base interval rule |
| :--- | :--- |
| Failed | `max(6 hours, 24 hours / consecutive failures)` |
| Solved with hints | `clamp(previous interval × 0.75, 24 hours, 72 hours)` |
| Solved independently | `clamp(previous interval × (1.3 + confidence × 0.3), 48 hours, 2160 hours)` |

After the base rule, confidence **1–2** halves the interval, with a **six-hour minimum**. Consequently, the independent-solve two-day floor applies *before* the low-confidence adjustment.

```mermaid
flowchart TD
    A[Read next chronological attempt] --> B{Outcome}
    B -->|Failed| C[Increment failure streak]
    C --> D[24 hours divided by streak; minimum 6 hours]
    B -->|Hints| E[Reset failure streak]
    E --> F[Previous interval times 0.75; clamp to 24-72 hours]
    B -->|Independent| G[Reset failure streak]
    G --> H[Multiply by 1.3 + confidence times 0.3; clamp to 48-2160 hours]
    D --> I{Confidence 1 or 2?}
    F --> I
    H --> I
    I -->|Yes| J[Halve interval; minimum 6 hours]
    I -->|No| K[Keep base interval]
    J --> L[Anchor next review to latest attempt time]
    K --> L
```

### Core implementation

Intervals are represented in elapsed hours, independently of the user's timezone.

```typescript
type Outcome = "failed" | "hints" | "independent";

interface Attempt {
  outcome: Outcome;
  confidence: number;
}

export function nextInterval(
  previousHours: number,
  attempt: Attempt,
  consecutiveFailures: number,
): number {
  let hours: number;

  if (attempt.outcome === "failed") {
    hours = Math.max(6, 24 / Math.max(1, consecutiveFailures));
  } else if (attempt.outcome === "hints") {
    hours = Math.min(72, Math.max(24, previousHours * 0.75));
  } else {
    const multiplier = 1.3 + attempt.confidence * 0.3;
    hours = Math.min(2160, Math.max(48, previousHours * multiplier));
  }

  if (attempt.confidence <= 2) {
    hours = Math.max(6, hours / 2);
  }

  return hours;
}
```

The companion implementation lives in `src/lib/algo/review.ts`.

## UML: workspace domain model

This conceptual model describes the original workspace design, not an exact declaration of the companion repository's TypeScript types.

```mermaid
classDiagram
    class Workspace {
        +Problem[] problems
        +StudySession[] sessions
        +Settings settings
    }

    class Problem {
        +string title
        +string difficulty
        +string[] topics
        +string optionalUrl
    }

    class Attempt {
        +datetime recordedAt
        +Outcome outcome
        +int confidence
        +string reflection
    }

    class ReviewEngine {
        +fold(attempts) intervals
        +nextInterval(previousHours, attempt, failures) hours
        +priority(overdueDays, outcome, confidence) score
    }

    class Settings {
        +string timezone
        +date interviewDate
        +int weeklyGoal
    }

    class AvailabilityWindow {
        +int weekday
        +time startTime
        +time endTime
    }

    class StudySession {
        +datetime start
        +datetime end
        +SessionStatus status
    }

    class Planner {
        +generate(settings, windows, sessions) sessions
    }

    class Storage {
        +validate(data) result
        +save(workspace) result
        +exportBackup() JSON
    }

    Workspace "1" *-- "0..*" Problem : contains
    Problem "1" *-- "0..*" Attempt : records
    Workspace "1" *-- "0..*" StudySession : contains
    Workspace "1" *-- "1" Settings : configures
    Settings "1" *-- "0..*" AvailabilityWindow : defines
    ReviewEngine ..> Attempt : evaluates
    Planner ..> Settings : reads
    Planner ..> AvailabilityWindow : resolves
    Planner ..> StudySession : generates
    Storage ..> Workspace : validates and persists
```

## UML: recording an attempt

The workspace persistence design validates and saves a mutation before presenting it as successful. A failed write must not appear as a saved attempt.

```mermaid
sequenceDiagram
    actor Learner
    participant UI as Practice workspace
    participant Validator as Schema validator
    participant Engine as Review engine
    participant Storage as Browser storage

    Learner->>UI: Submit outcome, confidence, and reflection
    UI->>Validator: Validate candidate workspace

    alt Invalid data
        Validator-->>UI: Validation errors
        UI-->>Learner: Keep existing data and show errors
    else Valid data
        Validator-->>UI: Validated workspace
        UI->>Engine: Fold chronological attempt history
        Engine-->>UI: Computed review interval
        UI->>Storage: Persist validated workspace

        alt Write succeeds
            Storage-->>UI: Saved
            UI-->>Learner: Updated attempt history and review date
        else Write fails
            Storage-->>UI: Storage error
            UI-->>Learner: Save failed - previous workspace retained
        end
    end
```


## UML: study-session lifecycle

The workspace design distinguishes scheduled, completed, and skipped sessions. Completion becomes available once a session starts.

```mermaid
stateDiagram-v2
    [*] --> Scheduled : Generate session
    Scheduled --> Scheduled : Reschedule to a valid future slot
    Scheduled --> Completed : Mark complete after start
    Scheduled --> Skipped : Skip session
    Completed --> [*]
    Skipped --> [*]

    note right of Scheduled
        Active sessions cannot overlap.
        Rescheduling rejects past starts.
    end note

    note right of Completed
        Counts toward the weekly goal.
    end note

    note right of Skipped
        Does not count toward the weekly goal.
    end note
```

## Availability-based planning

The original planner specification uses local wall-clock availability while preserving existing session instants when the timezone changes.

```mermaid
flowchart LR
    A[Weekly availability] --> D[Resolve local times in IANA timezone]
    B[Timezone] --> D
    C[Interview date and weekly goal] --> E[Bound planning horizon]
    D --> F[Candidate session slots]
    E --> F
    F --> G[Reject past starts and active overlaps]
    G --> H[Add sessions without replacing existing work]
```

### Planner constraints

- Generate up to **28 days**, ending at the interview date.
- Use **Monday-based weeks** in the configured timezone.
- Reject nonexistent spring-forward local times.
- Resolve ambiguous fall-back local times deterministically.
- Never start a new session in the past or overlap active sessions.
- Count scheduled and completed sessions toward weekly goals; exclude skipped sessions.
- Add at most one new session per availability window per date in a generation pass.
- Permit manual rescheduling outside availability and weekly-goal limits, while retaining past-time and overlap checks.

## Explainable analytics

### Review priority

The companion engine computes:

```text
priority = max(0, overdueDays)
         + outcomePenalty
         + (5 - confidence) × 0.5

outcomePenalty:
  failed       = 2
  hints        = 1
  independent  = 0
```

Higher values indicate greater review urgency.

### Topic mastery design

The original workspace specification defines topic mastery as the average of each problem's latest outcome score, weighted by confidence:

```text
problemContribution = outcomeScore × confidence / 5

outcomeScore:
  independent = 1.0
  hints       = 0.5
  failed      = 0.0
```

This is a transparent learning signal, **not a validated proficiency assessment**.

### Visualization companion

The companion explores the scheduling model through:

- Log-scale interval-growth curves.
- An interactive recall illustration.
- A scheduling transfer function.
- A review-priority bubble chart.
- A topic-mastery radar.
- A daylight-saving-time gap illustration.
- An availability heatmap.
- A contribution-style streak grid.

Illustrative figures are not evidence of a user's actual progress or empirically validated memory predictions.

## Built with

| Technology | Role in this repository |
| :--- | :--- |
| TanStack Start | Application framework |
| TanStack Router | File-based routing |
| React 19 | Interface and interactive figures |
| TypeScript | Typed data and scheduling logic |
| Tailwind CSS v4 | Styling and design tokens |
| Recharts | Data visualizations |
| Vitest | Automated tests |
| Vite | Development and production tooling |

The original workspace document names **Next.js App Router**. That is a separate stack description; this companion repository uses **TanStack Start**.

## Run locally

```sh
npm install
npm run dev
```

Open the local address printed by the development server.

```sh
# Run automated tests
npm test

# Check lint rules
npm run lint

# Produce a production build
npm run build
```

## Implementation map

```text
src/
├── routes/
│   ├── __root.tsx        # Shared application shell
│   └── index.tsx         # Visualization page
├── lib/
│   └── algo/
│       ├── review.ts     # Interval, priority, and outcome calculations
│       └── review.test.ts
├── components/
│   └── ui/               # Shared interface primitives
└── styles.css            # Global styling and theme tokens
```

## Engineering principles

Fo website integration setup and its current limitations are documented in [Fo integration](docs/fo-integration.md). The OAuth foundation is development-only; text submission remains blocked until authenticated Fo tool schemas are verified.

- **Explainable over opaque:** scheduling decisions follow explicit rules.
- **Bounded behavior:** interval floors and ceilings constrain the model.
- **Separation of concerns:** calculations remain independent of chart rendering.
- **Honest presentation:** illustrative data is distinguished from recorded progress.
- **Local-first workspace design:** browser persistence, explicit backups, and no required account.
- **Timezone-aware planning:** wall-clock availability and elapsed review intervals are treated as different concepts.

---

**Ryluno — deliberate practice with decisions you can inspect.**
