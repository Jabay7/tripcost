/**
 * The first-run walkthrough.
 *
 * Written for someone who runs trucks, not someone who evaluates software. Each
 * step answers "what is this for" before "where do I tap", because a driver who
 * understands *why* cash-to-float is separate from profit will use the app
 * correctly forever, and one who only learned which button to press will not.
 *
 * Kept as data rather than JSX so the copy can be edited without touching a
 * screen, and so a test can assert the tour actually covers the concepts a user
 * has to understand to get right answers out of this thing.
 */

export type WalkthroughStep = {
  id: string;
  /** Shown in the progress rail. Two or three words. */
  chip: string;
  title: string;
  /** The lead. One or two sentences, plain. */
  body: string;
  /** Concrete points. Kept short — this is read standing up. */
  points: string[];
  /**
   * The thing most people get wrong, or the reason this screen exists at all.
   * This is the part worth reading twice.
   */
  watchOut?: string;
  /** Optional deep link so they can go look at the real thing. */
  visit?: { label: string; href: string };
};

export const WALKTHROUGH: WalkthroughStep[] = [
  {
    id: 'what',
    chip: 'What it is',
    title: 'Know what a load pays before you book it',
    body:
      'Most of the time you get a rate confirmation and a pickup number, and you find out on the shoulder what the load actually cost you. This works it out first — every real cost, the hours, the weather, and whether the load is worth running.',
    points: [
      'Tells you what a load pays after every real cost, before you book it.',
      'Tells you what the road is going to do to you along the way.',
      'Tracks what your trucks cost to run, per truck and combined.',
    ],
    watchOut:
      'This is a planning tool. It is not an ELD, not a system of record for hours of service, and not legal or tax advice.',
  },
  {
    id: 'truck',
    chip: 'Your truck',
    title: 'Start with your truck — everything else hangs off it',
    body:
      'Every cost number in this app comes from the truck profile. The defaults are industry averages from ATRI, which are a reasonable starting point and are not your numbers.',
    points: [
      'Set your real fuel economy from your own fuel receipts, not the brochure figure.',
      'Enter your actual truck payment, insurance, and permits.',
      'Set maintenance per mile from what you actually spent last year, divided by the miles you ran.',
    ],
    watchOut:
      'Ten minutes with your settlement statements here is the difference between a number you can bet on and a guess with a dollar sign in front of it.',
    visit: { label: 'Open Trucks', href: '/(tabs)/trucks' },
  },
  {
    id: 'plan',
    chip: 'Plan a trip',
    title: 'Four questions, mostly tapping',
    body:
      'Route, load, pay, extras. Weight, deadhead and departure are quick-pick buttons — the only thing you normally type is the rate.',
    points: [
      'Deadhead miles are asked for on purpose. Empty miles burn fuel and earn nothing.',
      'Skip on the first screen jumps straight to a brief using sensible defaults.',
      'The progress bar at the top is tappable — jump back to any step.',
    ],
    visit: { label: 'Open Plan Trip', href: '/(tabs)' },
  },
  {
    id: 'extras',
    chip: 'Fixed vs optional',
    title: 'The part that makes the numbers honest',
    body:
      'Diesel, tolls, tires and your truck payment happen whether you like it or not, so they are always counted. A pilot car, a lumper, a washout or chains only happen because this particular load needs them — so the app asks instead of assuming.',
    points: [
      'Nothing on the extras list is charged unless you turn it on.',
      'Items your load probably needs are tagged LIKELY and float to the top — tagged, not ticked.',
      'Per-mile items price against real route miles; per-night items against nights you are actually out.',
    ],
    watchOut:
      'An earlier version quietly billed every oversize load $2,249 for an escort nobody hired. That is why it asks.',
  },
  {
    id: 'brief',
    chip: 'The brief',
    title: 'GREEN, AMBER, RED — and three numbers',
    body:
      'The brief opens with a go/no-go and the bottom line, then shows you exactly how it got there. Every cost line states its own arithmetic.',
    points: [
      'Break-even per mile: below this you are paying to haul the load.',
      'All-in rate per mile: revenue divided by every mile including deadhead.',
      'Cash to float: what leaves your pocket before settlement arrives.',
    ],
    watchOut:
      'Cash to float is not profit and is not a cost. It is the money you need on hand now — fuel, tolls, lumpers, meals — while settlement is 15 to 45 days out. A profitable load you cannot fund is still a load you cannot take.',
  },
  {
    id: 'road',
    chip: 'The road',
    title: 'Hours, weather and what can stop you',
    body:
      'The timeline models the 11-hour driving limit, the 14-hour window, the 30-minute break and the 10-hour reset, and tells you whether the load can be delivered legally on time.',
    points: [
      'Weather is live from the National Weather Service, forecast for when you will actually be there — not for right now.',
      'Hazmat tunnel bans, chain laws and overweight limits are flagged before you roll.',
      'En-route watch keeps checking while you drive and warns you about what is ahead.',
    ],
    watchOut:
      'The timeline does not model sleeper-berth splits or the 34-hour restart, both of which buy you time. So it is the conservative case — you will do better than it shows, never worse. Your ELD is the authority on your hours.',
  },
  {
    id: 'driver',
    chip: 'Driver copy',
    title: 'Send the brief without sending your rates',
    body:
      'One tap on any brief produces the driver version: route, timeline, weather, restrictions and a fuel plan telling them which state to fill in. No rate, no cost, no margin.',
    points: [
      'Shares as plain text over SMS, WhatsApp or email.',
      'Add a note from dispatch — gate code, dock hours, who to call.',
      'Fuel prices per gallon are included on purpose: a driver told to fill in Texas needs to know why.',
    ],
    visit: { label: 'See how it works', href: '/(tabs)' },
  },
  {
    id: 'fleet',
    chip: 'Fleet',
    title: 'What your trucks cost, day through year',
    body:
      'Cost per truck and combined, for any period. Tap any subset of trucks to answer "what are these three costing me out of the whole fleet?"',
    points: [
      'Operating ratio is the headline: under 95% is healthy, over 100% is losing money.',
      'Fixed costs accrue on calendar days — a parked truck still owes its payment.',
      'Switch to By driver to see the same numbers per person.',
    ],
    visit: { label: 'Open Fleet', href: '/(tabs)/fleet' },
  },
  {
    id: 'ledger',
    chip: 'Real costs',
    title: 'Photograph the bill instead of typing it',
    body:
      'A tow, a blown tire, a citation. Scan it and the vendor, date and total come off the page into your ledger, against the right truck.',
    points: [
      'Scan a rate confirmation or BOL instead and it prefills a trip — that is freight ahead, not money spent.',
      'Recorded costs make the fleet report your actual books rather than a projection.',
      'Everything scanned lands on a review screen before it is saved.',
    ],
    watchOut:
      'Always check the total against the paper. A photo taken at night on the shoulder can turn a 1 into a 7, and a wrong number saved silently is worse than no scanning at all.',
    visit: { label: 'Open Ledger', href: '/(tabs)/ledger' },
  },
  {
    id: 'limits',
    chip: 'Straight talk',
    title: 'What this does not do yet',
    body:
      'Worth knowing before you rely on it for anything that matters.',
    points: [
      'Routing is a straight-line estimate, not truck-legal. Verify bridge clearances and restricted roads yourself.',
      'Fuel prices are regional averages, not the price at a specific truck stop.',
      'Traffic and road restrictions are modeled, not live feeds.',
    ],
    watchOut:
      'Every brief labels each data source LIVE or OFFLINE. If it says OFFLINE, treat the number as directionally right and check it before it costs you.',
  },
];

/** Re-exported so screens and tests agree on the count without hardcoding it. */
export const WALKTHROUGH_STEPS = WALKTHROUGH.length;
