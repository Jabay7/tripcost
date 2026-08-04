# TripCost

Trip costing and fleet management for CDL carriers.

Most of the time a driver gets a rate confirmation and a pickup number, and finds
out on the shoulder of I-80 what the load actually cost. TripCost works it out
first — every real cost, the hours, the weather, and whether the load is worth
running — and gives the carrier behind them a running picture of what the fleet
costs to operate.

---

## What it does

**Plan a trip → get a brief.** Route and states crossed, an hours-of-service
timeline with every legally required break and reset, weather segment by segment
at the time you will actually be standing in it, traffic, hazmat and tunnel
restrictions, and a full cost breakdown that ends in a single number: does this
load pay, or are you paying to haul it.

**Fleet cost, daily through yearly.** Cost per truck and combined, for the last
day, week, month, quarter or year. Select any subset of trucks to answer "what
are these three costing me out of the whole fleet?" and see that selection as a
share of the total.

**Drivers under the company.** The carrier is the account; trucks and drivers
both hang off it. Seat a driver in a unit, put two on one truck for a team, or
leave them on the bench. Cost rolls up per driver as well as per truck, and CDL
and DOT medical expiry dates are tracked with warnings at 60 and 30 days.

**Unplanned costs.** A tow, a blown steer tire, a citation, a motel night while
the truck is in the shop. Enter it and it flows into the trip total, the cash you
have to float, and the fleet report — as an actual, not an estimate.

**A driver copy with the money taken out.** From any brief, one tap produces the
driver's version — route, hours-of-service timeline, weather, closures,
restrictions, and a fuel plan telling them which state to fill in and which to
buy minimum through. No rate, no cost, no margin. The separation is structural:
`buildDriverBrief` returns a different object rather than hiding fields, so
nothing downstream can render a figure the driver should not see. A test asserts
the dispatch financials never appear in the payload or the shared text. Send it
over SMS, WhatsApp or email from the share sheet.

**Scan the paperwork instead of typing it.** Photograph a tow bill, invoice, fuel
receipt or scale ticket and the vendor, date, total and line items come off the
page into the ledger. Photograph a rate confirmation or BOL and it prefills the
trip planner instead — that is freight ahead, not money spent, and the two belong
in different places. See *Document scanning* below.

---

## Running it

```bash
npm install
npm start          # then press w for web, or scan the QR code with Expo Go
```

Other commands:

```bash
npm run preflight     # typecheck + tests + end-to-end verify. Run before shipping.
npm run typecheck     # tsc, strict
npm test              # 70 unit tests over cost, HOS, weather, fleet and driver-copy math
npm run verify        # prints a full brief, driver copy, leak check and fleet report
npm run bench         # where the time actually goes
npm run check:weather # is NWS reachable and returning sane data?
npm run icons         # regenerate the app icon set
npm run server        # extraction server for document scanning
```

## Building for phones

```bash
npm i -g eas-cli && eas login
eas build:configure
eas build --profile preview --platform android   # installable APK
eas build --profile production --platform all    # store builds
```

`eas.json` ships with three profiles: `development` (dev client), `preview`
(internal APK / ad-hoc IPA — the one to hand a driver for testing), and
`production` (app bundle for the stores). Set `EXPO_PUBLIC_NWS_USER_AGENT` in
each profile to your own contact address before building.

Store submission needs accounts you have to own: Apple Developer ($99/yr) and
Google Play ($25 once). `eas submit` handles the upload once those exist.

---

## The cost model

Three things this does differently from a napkin calculation, because these are
the three ways owner-operators talk themselves into a bad load:

1. **Deadhead is cost, never revenue.** Empty miles to the shipper burn fuel and
   wear at the same rate as loaded ones and pay nothing.
2. **Fixed costs are allocated by days consumed.** The truck payment does not
   pause because the load only paid for 400 miles. A truck sitting still still
   owes roughly $440 a day in this app's default profile.
3. **Cash to float is tracked separately from cost.** Fuel, tolls, lumpers,
   parking and meals come out of the driver's pocket now; settlement lands in 15
   to 45 days. That number decides whether you can take the load, not the profit.

Baseline figures are anchored to ATRI's *Analysis of the Operational Costs of
Trucking* — roughly $2.25–2.30 per mile all-in for a company truck, of which
about $0.93 is driver wage and benefits. The default profile is an
owner-operator, so it carries no wage line and the app compares it against the
benchmark with that component removed. Every number is editable per truck; a
driver's own settlement statements always win.

Trip-level line items the per-mile averages never show: lumper fees, CAT scale
tickets, reserved parking, trailer washouts, oversize permits per state, escort
cars, chain allowances in chain-law season, hazmat compliance, factoring and
dispatch percentages, and a contingency reserve that scales with the trip's risk
score.

---

## Live data

Every external feed sits behind an interface with an offline implementation
today and a documented path to live. Swapping one does not touch anything else.

| Service | Now | Live path |
|---|---|---|
| **Weather** | **LIVE — api.weather.gov** | Already on. Free, no key. Set `EXPO_PUBLIC_NWS_USER_AGENT` to your contact address |
| Routing | Great-circle × circuity factor | HERE Routing v8 `transportMode=truck`, or Trimble/PC\*Miler for truck-legal |
| Fuel | EIA regional snapshot, spread by state diesel tax | EIA API v2 — free, key only. Per-station needs a commercial feed |
| Traffic | Corridor congestion model | HERE Traffic Incidents v7 + state 511 feeds |
| Restrictions | State reference table | FMCSA hazmat route registry + a commercial truck-attribute map |

Weather is live out of the box: forecasts are fetched per route segment for the
time the truck is projected to be there, in parallel, with `/points` responses
cached by grid cell. A segment that fails falls back to the model for that
segment only, so one flaky request costs a data point rather than the brief.
Check it with `npm run check:weather`.

The brief labels every section LIVE or OFFLINE and refuses to pretend otherwise —
there is a banner on the brief saying the numbers are directionally right but not
dispatch-grade until the live providers are connected.

NWS weather needs no key and can go live first. Construct a bundle in
`src/services/index.ts`:

```ts
const live: ServiceBundle = {
  ...MOCK_SERVICES,
  weather: new NwsWeather('TripCost (you@example.com)'),
};
```

API keys belong on a server proxy, never in the app bundle.

---

## Document scanning

Scanning works offline out of the box — it returns a clearly-labeled sample so
the capture → review → apply flow can be demonstrated without a key. To read real
paperwork, run the extraction server.

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # get one at console.anthropic.com
node server/index.mjs                   # listens on :8787

# In another terminal — use your machine's LAN IP so a phone can reach it
EXPO_PUBLIC_API_BASE=http://192.168.1.20:8787 npm start
```

**The key lives on the server, never in the app.** A mobile bundle ships to
devices and can be unpacked, so anything embedded in it is public. `server/index.mjs`
is the only component that holds the key; the app sends document bytes and gets
structured JSON back.

**Extraction proposes, the driver disposes.** Nothing reaches the ledger or the
trip until it has been shown on a review screen and confirmed. A model reading a
crumpled tow bill at 0200 will occasionally turn a 1 into a 7, and a wrong number
written silently into the books is worse than no automation. The total is an
editable field on that screen, and anything the model was unsure about is listed
as a warning above it. Confirming is one tap.

Uses Claude Opus 5 with structured outputs, so the response is constrained to a
JSON schema and parses every time — no regex over prose. Roughly $5 per million
input tokens and $25 per million output; a receipt runs on the order of 1–2k
input tokens plus the image (up to ~4.8k tokens at full resolution). Switch the
model string in `server/index.mjs` if you want to trade accuracy for cost at
volume — that is a business decision, not a default worth making for you.

Accepts JPEG, PNG, GIF, WebP and PDF, up to 12 MB.

## Layout

```
app/                     Expo Router screens
  (tabs)/
    index.tsx            Trip planner
    fleet.tsx            Fleet cost report — period, truck selection, per-driver
    trucks.tsx           Truck list
    drivers.tsx          Roster + carrier details
    ledger.tsx           Recorded costs and revenue
  brief.tsx              The trip brief
  scan.tsx               Photograph a document → review → apply
  add-cost.tsx           Unplanned cost entry
  truck/[id].tsx         Truck cost basis editor
  driver/[id].tsx        Driver, CDL, endorsements, assignment

server/index.mjs         Extraction proxy — the only thing holding an API key

src/
  calc/                  costs · hos · risk · fleet
  services/              routing · fuel · weather · traffic · restrictions · documents
  data/                  states · geo · defaults · incidents
  store/                 persisted fleet + ledger, ephemeral trip draft
  ui/                    theme and components

test/calc.test.ts        48 tests
scripts/verify.ts        End-to-end smoke check
```

## What is modeled, and what is not

Hours of service covers the 11-hour driving limit, the 14-hour window, the
30-minute break and the 10-hour reset, plus the 60/70-hour cycle. It does **not**
model sleeper-berth splits, the 34-hour restart, or the short-haul and
adverse-conditions exceptions. All of those buy the driver time, so the plan is
the conservative case — a driver who can legally split will do better than the
brief shows, never worse.

Routing is a straight-line estimate inflated by a circuity factor. It is not
truck-legal and the brief says so. Bridge clearances and restricted roads must be
verified until a real truck router is wired in.

This is a planning tool. It does not replace an ELD, and nothing in it is legal
or tax advice.
