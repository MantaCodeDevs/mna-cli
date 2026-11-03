# CLI map, JSON body shapes, and gotchas

Read this when you're building option/event bodies or need the exact command for a mutation.
The repo `README.md` has the exhaustive table; this file is the planning-focused subset plus
the field shapes you can't guess. Examples below use neutral placeholders.

## Command quick-map (all support `--json`)

```
trips        list | show <id> [--all-options] | create --name | edit <id> | delete <id> | share | unshare
variants     add <trip> --name <dates…> [--adults --child-ages --no-children --notes] | duplicate <trip> <var>
             edit <trip> <var> [--name --notes <dates…> --adults --child-ages --no-children] | select <trip> <var> | delete
destinations add <trip> <var> --place [--start-date --end-date --notes --return-to-home]
             edit <trip> <var> <destKey> [--place --notes --start-date --end-date --return-to-home/--no-…]
             reorder <trip> <var> --order=k1,k2,k3 | delete <trip> <var> <destKey>
options      add <trip> <var> <destKey> <kind> --from-json <file> [--free-cancellation-until <date>] [--details <json>] [--photos <json>] [--website <url>]
             edit <trip> <var> <destKey> <kind> <optKey> [--from-json <file>] [--free-cancellation-until <date>] [--details <json>] [--photos <json>] [--website <url>]
             select <trip> <var> <destKey> <kind> <optKey> | deselect <trip> <var> <destKey> <kind>
             delete <trip> <var> <destKey> <kind> <optKey>
events       add <trip> <var> --from-json <file> | edit <trip> <var> <eventKey> --from-json
             toggle <trip> <var> <eventKey> | delete <trip> <var> <eventKey>
access/vote  access list|invite|set-role|revoke|*-invite-link ; vote option|event ; votes list
goals        list|show|add|quick-add|edit|delete|link-trip|unlink-trip|mark-visited|mark-dreaming
collections  list|show|create|edit|delete|add-goal|remove-goal|share|open-shared
```

`<kind>` is one of `accommodation | transport | getting-around`.

## Option JSON bodies (`--from-json`)

### accommodation
```json
{
  "name": "Seaside Apartment",
  "type": "apartment",                          // hotel|hostel|apartment|house|camping|other
  "totalCost": 1200, "currency": "EUR",
  "location": { ...see "Location shape" below... },
  "roomDetails": { "numberOfRooms": 1 },        // optional: sizeInM2
  "externalRating": { "score": 9.7, "scale": 10, "count": 240, "source": "booking.com" },
  "features": ["beachfront", "privateKitchen", "freeParking"],
  "description": "Top-floor flat with a sea-facing terrace.",
  "url": "https://…",                           // the listing / property site
  "imageUrl": "https://…",                      // hotlinked photo, not copied
  "sourceUrl": "https://…",
  "notes": "Owner replies within the hour; parking is a shared yard.",
  "checkIn": "2026-07-07T12:00:00.000Z",        // ISO date-time
  "checkOut": "2026-07-15T12:00:00.000Z",
  "freeCancellationUntil": "2026-07-02T12:00:00.000Z"
}
```
`checkIn`/`checkOut`/`checkInTime`/`checkOutTime`/`freeCancellationUntil` can also be set with
`options edit … --free-cancellation-until <date>` (accommodation only) without a JSON file.
Everything else goes through `--from-json`, on both `options add` and `options edit`.

`externalRating.scale` is **required whenever `score` is set** — Booking.com publishes out of 10,
Google out of 5. Store both and quote the pair (`9.7/10`); never normalise or compare across scales.

`features` (all optional, use only what the listing actually states):
`beachfront`, `beachNearby`, `privateBeachArea`, `swimmingPool`, `kidsPool`, `kidsPlayArea`,
`privateKitchen`, `sharedKitchen`, `washingMachine`, `familyRooms`, `airConditioning`,
`freeParking`, `freeWifi`, `balconyTerrace`, `petsAllowed`.
`privateKitchen` and `sharedKitchen` are different things: Booking lists "Shared kitchen" at
property level, which is not what a user means by "an apartment with a kitchen".

Put ratings and facilities in these fields rather than in `notes` — `mna trips show` renders them,
and `notes` should carry what no field covers. `type` and `roomDetails` come back on read too.

#### `stayDetails` and `photos`

Set these inside the `--from-json` body, or with the flags on `options add` and `options edit`:

```bash
mna options edit <trip> <var> <destKey> accommodation <optKey> \
  --details '{"highlight":"Only one with a private sauna","kitchen":"private","parking":"Garage, book ahead","sourceNote":"Listing page, Oct 2026","author":"agent"}' \
  --photos '[{"url":"https://…/balcony.jpg","credit":"Owner"}]'
```

All `stayDetails` properties are optional. Add one only when it helps choose between this trip's
options, and leave out anything equally true of all of them, or unknown.

| Property | Value |
|---|---|
| `highlight` | one line, up to 160 characters |
| `worthChecking` | list of up to 10 things to confirm before booking; hidden on share links that hide notes |
| `kitchen` | `private` \| `shared` \| `none` |
| `breakfast` | `included` \| `available` \| `none` |
| `skiBack` | `yes` \| `partly` \| `no`, only when confirmed |
| `bookability` | `bookable` \| `on_request` \| `price_unconfirmed` |
| `author` | `owner` \| `agent` \| `sonnet`; agents set `agent` |
| `bedrooms`, `bathrooms`, `maxGuests`, `sizeInM2` | numbers |
| `dinner`, `bedLayout`, `skiBackNote`, `mainLiftName`, `skiStorage`, `kidsFacilities`, `wellness`, `pool`, `beach`, `parking`, `noise`, `view`, `airConditioning`, `laundry`, `accessibility`, `pets`, `sourceNote` | text, up to 300 characters |

On an edit, only the `stayDetails` properties you send change. `null` clears one, and
`--website` is the place's own official site, never a booking or listing site; leave it out if you can't confirm it. Photos from it may then be linked automatically, credited to the site. `--website null` clears it. `--details null` clears them all. `--photos` replaces the whole list, up to 12 photos, and
`--photos null` clears it. Unknown properties are rejected.

`photos` take `{ "url", "credit"?, "creditUrl"? }`. Each URL must be a directly linkable http or
https image that the owner may use.

### transport
```json
{
  "transportType": "car",                       // car|plane|train|bus|ship|motorbike|bike|other
  "roundTrip": false,
  "totalCost": 120, "currency": "EUR",
  "from": { ...location... }, "to": { ...location... },
  "departAt": "2026-07-05T08:00", "arriveAt": "2026-07-05T11:00",
  "durationHours": 3, "durationMinutes": 0,
  "notes": "Own car, ~250 km. Fuel only."
}
```
Model each leg as the trip *into* a destination; attach it to that destination. Put the final
home-return drive on the `--return-to-home` destination so the per-variant total is clean.

### getting-around
```json
{ "type": "ownCar", "totalCost": 0, "currency": "EUR", "notes": "Own car throughout." }
```
`type`: walk|publicTransport|rideShare|ownCar|rentalCar|ownMotor|rentalMotor|bike|rentalBike|other.

### event (variant-level, `events add`)
```json
{ "name": "City walking tour", "start": "2026-07-06T10:00", "end": "2026-07-06T13:00",
  "totalCost": 0, "currency": "EUR", "link": "…", "notes": "…",
  "location": { "name": "Old Town", "formattedAddress": "…", "coordinates": { "lat": 0.0, "lng": 0.0 } } }
```

When the group has a real choice of price, add `"priceOptions": [{ "label": "4-day pass", "totalCost": 200 }, { "label": "6-day pass", "totalCost": 280 }]`,
up to 10, in the event's `currency`. On `events edit`, the list is replaced, and `null` clears it.

## Trip budget

`mna trips edit <trip> --budget '{"amount":4000,"currency":"EUR","appliesTo":"stay"}'`. `appliesTo`
is `stay` or `total`. Only the trip owner can change it, `--budget null` clears it, and it never
appears on share links. Set it only when the owner has stated a budget.

## Location shape — a non-obvious gotcha

Option locations are **written flat and read back nested**. Send `address` / `latitude` /
`longitude`; a nested `formattedAddress` + `coordinates` object is silently dropped and only
`name` survives (verified against production on both `options add` and `options edit`):

```json
"location": {
  "name": "Seaside Apartment",
  "address": "<full address>, <City>, <Country>",
  "latitude": 0.000000,
  "longitude": 0.000000,
  "locationiqPlaceId": "…"
}
```
`trips show` returns the same place as `formattedAddress` + `coordinates.lat`/`.lng` — that's the
read shape, not something to echo back on a write. `locationiqPlaceId` (and `googlePlaceId`)
round-trip, so pass whichever your geocoder gave you and the app can re-resolve the place later.
`location` is **replaced wholesale**, never merged: a partial `location` in an `options edit` body
clears whatever you left out. Get exact coordinates from the search result, or geocode the address
(e.g. OpenStreetMap Nominatim). After setting, **verify with `trips show`** — never trust the 2xx
alone. Event locations are a different DTO but coordinate keys are still `lat`/`lng` — an event
body with `coordinates.latitude`/`.longitude` is a 500, not a silent drop (verified against
production).

## Dates

`variants add` requires dates: `--start-date/--end-date` for exact, or all six of
`--depart-not-before/--depart-not-after/--return-not-before/--return-not-after/--min-nights/--max-nights`
for flexible. `destinations --start-date/--end-date`, accommodation
`checkIn/checkOut/freeCancellationUntil`, and event `start/end` are all ISO date-time. Accept
`YYYY-MM-DD` from the user and normalize.
Using `T12:00:00.000Z` (noon UTC) avoids timezone off-by-one on the displayed calendar date.

### Variant dates — required on create

The variant is what carries the trip's dates, and the API refuses to store one without them.
`variants add` takes one of two complete shapes; a half-filled or mixed set is rejected locally:

```bash
mna variants add <trip> --name "Beach option" --start-date 2026-09-01 --end-date 2026-09-08
mna variants add <trip> --name "Flexible option" \
  --depart-not-before 2026-09-01 --depart-not-after 2026-09-03 \
  --return-not-before 2026-09-10 --return-not-after 2026-09-12 \
  --min-nights 7 --max-nights 10
```

`variants edit` takes the same flags; leave them off and the existing dates stay untouched.
Switching a variant between the two shapes is just an edit with the other flag set.

## Variant party — set it on create

Each variant stores who is travelling, and its budget breakdown is worked out from that. Omit it
on `variants add` and the variant is silently stored as **one adult**, so always pass the party the
user gave you:

```bash
mna variants add <trip> --name "Family option" --start-date 2026-09-01 --end-date 2026-09-08 \
  --adults 2 --child-ages 8,5
mna variants add <trip> --name "Couple option" --start-date 2026-09-01 --end-date 2026-09-08 --adults 2
```

- `--adults` — whole number, at least 1.
- `--child-ages` — one age per child, a whole number from 0 to 17 at the time of the trip; anyone
  older counts as an adult. Comma-separated (`8,5`) or repeated. Needs `--adults` on `add`.
- `--no-children` — adults only. On `edit`, this is how to remove children.

To correct a variant, use `variants edit` with only the flags that changed:

```bash
mna variants edit <trip> <var> --adults 3
mna variants edit <trip> <var> --child-ages 8,5,2
mna variants edit <trip> <var> --no-children
```

The API's `participants` field replaces the whole party, so the CLI reads the current one and merges
your change; children, adults and any stored room count you didn't name survive. With no party flag
it isn't sent at all. `variants duplicate` copies the party. If a raw API body is ever needed, send
the complete `{ adults, children: [{ age }], numberOfRooms? }`, without the `_id`s a read returns.

## Verify-after-write

Mutation responses are intentionally thin (often just the new key). Confirm the state with
`mna trips show <tripId> --all-options --json` and parse the field you changed. This is the reliable way to
catch a silently-dropped field or an accidental duplicate create. Without `--all-options` the read
returns only the selected variant, so a newly added or unselected one looks missing.

## Auth / config

Header is `X-API-Key` (handled by the CLI). Creds live at `~/.config/mna/credentials`
(`XDG_CONFIG_HOME` overrides). `MNA_API_KEY` / `MNA_API_BASE_URL` env vars override for CI/dev.
