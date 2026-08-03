# TripCost

A convoy brief for civilian CDL drivers.

Before a Marine Corps motor transport convoy rolls, someone stands up and briefs
it: route, timeline, hazards, what to do when it goes wrong. Owner-operators and
small fleets get none of that. They get a rate confirmation and a pickup number,
and they find out on the shoulder of I-80 what the load actually cost them.

TripCost gives a driver that brief, and gives the company behind them a running
picture of what the fleet costs to operate.

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

---

## Running it

```bash
npm install
npm start          # then press w for web, or scan the QR code with Expo Go
```

Other commands:

```bash
npm run typecheck  # tsc, strict
npm test           # 48 unit tests over the cost, HOS, weather and fleet math
npm run verify     # prints a full brief + fleet report to the console
npm run web        # web only
```

Deploying to phones uses EAS: `npx eas build --platform ios` (or `android`).

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
| Routing | Great-circle × circuity factor | HERE Routing v8 `transportMode=truck`, or Trimble/PC\*Miler for truck-legal |
| Fuel | EIA regional snapshot, spread by state diesel tax | EIA API v2 — free, key only. Per-station needs a commercial feed |
| Weather | Climatological model by latitude and month | api.weather.gov — free, no key |
| Traffic | Corridor congestion model | HERE Traffic Incidents v7 + state 511 feeds |
| Restrictions | State reference table | FMCSA hazmat route registry + a commercial truck-attribute map |

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

## Layout

```
app/                     Expo Router screens
  (tabs)/
    index.tsx            Trip planner
    fleet.tsx            Fleet cost report — period, truck selection, per-driver
    trucks.tsx           Truck list
    drivers.tsx          Roster + carrier details
    ledger.tsx           Recorded costs and revenue
  brief.tsx              The convoy brief
  add-cost.tsx           Unplanned cost entry
  truck/[id].tsx         Truck cost basis editor
  driver/[id].tsx        Driver, CDL, endorsements, assignment

src/
  calc/                  costs · hos · risk · fleet
  services/              routing · fuel · weather · traffic · restrictions
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
