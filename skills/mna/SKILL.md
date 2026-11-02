---
name: mna
description: >-
  Plan and manage trips end-to-end on My Next Adventure via the `mna` CLI — create trips,
  compare variants, build destinations and travel legs, research and book real accommodation,
  cost transport, set dates and cancellation deadlines, and keep it all in sync. Use this
  whenever the user wants to plan, research, price, build, or manage a trip / vacation /
  itinerary on My Next Adventure (or mentions `mna`), even if they don't name the app — e.g.
  "help me plan our summer trip", "find a lakefront place near X", "add a stopover on the way",
  "compare these two hotels", "set up a few options to compare", "what's this trip costing".
  Also covers travel goals, collections, trip sharing, and group voting.
---

# Planning trips with My Next Adventure (`mna`)

`mna` is a CLI over the My Next Adventure API (`app.mynextadventure.cloud`). The app is the
**source of truth** for a trip. Your job is to run the process: do the research and the
arithmetic, keep the plan structured, and let the user make the real calls.

## Bootstrap

Run `mna whoami` first. If it reports "Not logged in", ask the user to run `mna login`
themselves (browser consent) or `mna login --paste-token <key>` (key from the user menu →
API Keys on the site). **Always pass `--json`** so output is parseable.

## The data model (hold this in your head)

```
trip
└── variant            ← a whole-trip STRATEGY you compare (one is "selected")
    ├── destination    ← a place/leg, in travel order; one can be return-to-home
    │   ├── accommodation options   (one selected)   ← where you sleep
    │   ├── transport options       (one selected)   ← how you get TO this leg
    │   └── getting-around options  (one selected)   ← local mobility
    └── event           ← an activity/booking (optional)
```
Most things support multiple **options** so the user (and collaborators) can compare and vote;
exactly one per kind is **selected** and counts toward the plan.

## The process

Five phases. Most bad plans come from researching before eliciting, or building structure
before the destination is actually decided.

### 1. Elicit

Before any research, establish:

- **Anchors** — the fixed points nothing else can move: a booked flight, an event date, a
  pickup, a hard return-by date.
- **Party** — who travels, which legs (trips can split), and children's ages, which change room
  eligibility and price. Every variant stores this party (see step 3).
- **Dates** — exact if known, otherwise a window plus a night count.
- **Budget and home currency** — the ceiling, and the currency every total gets presented in.
  Never infer it from the destination or carry it over from a previous trip.
- **This trip's preferences** — not last trip's. "Have you been there, and did you like it?" is
  a good question; "yes, that's why we're going back" is as valid an answer as "yes, so
  somewhere new". Flag when a candidate is effectively a repeat, then let them decide.
- **Origin and mode** — own vehicle (ask for real consumption), rental, rail, air.

Then check what exists: `mna trips list --json`. They may already have this trip going — anchor
on it rather than spawning a duplicate. Let the *user* define the variant strategy; don't invent
structure they didn't ask for. Reserve a hard question (or `AskUserQuestion`) for genuine forks.

**Detect the mode.** Short answers, no engagement with the trade-offs, "you just pick" — that's a
request, not disinterest. Stop interviewing, make the smallest safe assumptions, state them, and
come back with one recommendation and a one-line rationale.

### 2. Research real availability

Never price from memory. Estimates run *low*, and in high season the gap is big enough to flip
conclusions — so anything not from a live search is labelled an estimate.

- Search with the real constraints: the exact dates for *that variant*, adults + children's
  ages, the user's currency, hard requirements as filters.
- **If the destination isn't settled, compare places before properties.** One representative
  option per candidate place with its transfer time, total and honest downside; drill into
  listings only for the shortlist. The data model assumes the place is known — often it's the
  open question.
- **Verify availability by name for the exact dates before recommending.** Search ranking hides
  available places, and a property free for a long stay may be unavailable for a short one.
- Present 2–4 candidates with the one trade-off that matters and a clear pick — not a menu. When
  priorities shift mid-search, re-run against the new criteria instead of defending the old list.

### 3. Structure it in MNA

Build what the user agreed to, one level at a time:

| Level | Command | Notes |
|---|---|---|
| trip | `mna trips create --name "…"` | the container |
| variant | `mna variants add <trip> --name "…" --start-date <date> --end-date <date> --adults <n> [--child-ages <a,b>]`, or `variants duplicate <trip> <var>` | a whole-trip **strategy** ("single base" vs "stopover + base"), not a tweak. Dates are required — exact, or the six flexible-date flags (see reference). **Always pass the party:** without it the variant is stored as one adult and its budget breakdown comes out wrong, with no error. Fork a baseline, then diverge; a duplicate keeps the party. |
| destination | `mna destinations add <trip> <var> --place "<City, Country>" --start-date <date> --end-date <date>` | in travel order; `--return-to-home` marks the home leg; `destinations reorder … --order=k1,k2,k3` fixes order |
| option | `mna options add <trip> <var> <dest> <kind> --from-json <file>`, then `mna options select …` | `<kind>` = `accommodation` \| `transport` \| `getting-around` |
| event | `mna events add <trip> <var> --from-json <file>` | only if the user wants them — the app is not a day-by-day itinerary planner, and many users don't want one |

Order legs to avoid backtracking, keep far-flung sights as day-trips rather than extra bases,
and break a long drive with a stopover. Attach each transport leg to the destination it
*arrives at*, and put the journey home on the return-to-home destination so totals stay clean.

Set real data, not placeholders: exact coordinates on each option's `location`, per-destination
dates, check-in/out, `--free-cancellation-until` on accommodation. Replace stale options rather
than piling new ones on top. Write responses are thin — **re-fetch
`mna trips show <tripId> --all-options --json`** and confirm the field you set actually persisted. Without `--all-options` only the selected variant comes back, so a newly added one looks missing.

### 4. Compare end-to-end

Compare *trips*, not nightly rates. Total each variant as transfer there + stay + local
mobility + journey home, in the user's currency, and state what's excluded (food, activities,
tolls, parking).

`mna trips show <trip> --all-options` prints each destination's accommodation with cost, guest
rating and facilities, so a shortlist is comparable without re-reading your own notes.

### 5. Decide, select, share

`mna variants select <trip> <var>` and `mna options select …` record the decisions — a plan with
nothing selected has no totals. Then `mna trips share <trip>` for a link, `mna access invite`
for collaborators, and `mna vote option|event` when a group is choosing.

Keep a lightweight `PLAN.md` in the working directory alongside the app: IDs, decisions made,
open questions, running totals. It's what makes a later session resumable.

## Checks worth running

Not facts to know — categories to look up for *this* destination, season and party.

- **Local booking conventions.** Changeover days, minimum stays and weekly-versus-nightly pricing
  vary by region and season, and can lock or free specific date windows. Check before concluding
  a place is unavailable or overpriced.
- **Short-stay penalties.** Where the week is the real product, a few nights can price well above
  pro-rata. Compare candidates at the *same* night count or the comparison lies.
- **Getting there beyond fuel or fare.** Tolls, road-use charges, ferries, congestion zones,
  parking, baggage fees — these reorder candidates, not just inflate them, and crossings cost
  time as well as money.
- **What the marketing word means locally.** "Beach", "central", "sea view", "family friendly"
  aren't standardised. Verify against the map, the photos and the reviews before promising it.
- **Property-level versus unit-level facilities.** A shared kitchen at property level is not a
  kitchen in the apartment — that's why `privateKitchen` and `sharedKitchen` are separate.
- **Whether the party shape has a filter.** Adults-only, family rooms, accessible rooms, pet
  policies — use them when they're on-brief, ignore them when they're not.
- **Fixed points make routing.** When the itinerary must include a pickup or an event, compare
  variants by total transfer time and days lost. Routes that move *forward* through the fixed
  point usually beat a there-and-back detour.

## Field semantics

The app renders and totals these fields; misuse degrades the plan quietly.

- **`name` is a display name** — "Villa Ave", not "Villa Ave (best value, book by Friday)".
  Price belongs in `totalCost` + `currency`, the place in `location`, the score in
  `externalRating`, amenities in `features`, links in `url` / `sourceUrl`.
- **`notes` is for commentary** — where you found it, what still needs verifying, why it was
  ruled out. Anything with its own field goes in that field, or it renders twice, goes stale
  independently, and can't be sorted or compared.
- **Ratings keep their source's scale.** Store `externalRating.scale` beside the score (out of
  10, out of 5) and quote the pair. Never normalise, and never rank a /10 score against a /5 one.
- **The user's edits are authoritative.** A hand-corrected price, a fixed location or spelling —
  keep it, and don't revert to the scraped value on the next sync.

## Where the details live

- **`references/cli-and-schemas.md`** — the JSON body shapes for options and events, the enums
  (including the 15 accommodation `features`), the **flat-vs-nested location trap**, and the
  date/cancellation fields. Read it before building any `--from-json` body.
- **`references/research-and-costing.md`** — driving a hotel connector (search → verify
  availability → map into an option), area-specific searches, and own-vehicle fuel arithmetic.
- **repo `README.md`** — the complete command map (auth, trips, variants, destinations, options,
  events, access/voting, goals, collections).
- **`https://api.mynextadventure.cloud/v1/openapi.json`** — the contract of record when a body
  shape is unclear.
