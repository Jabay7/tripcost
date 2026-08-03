/**
 * Visual language: a briefing board, not a consumer finance app.
 *
 * Constraints that drove these choices:
 *  - Read in a cab, often at night, often through polarized sunglasses.
 *    So: dark surface, high contrast, no thin light-grey-on-grey text.
 *  - Operated with gloves or one hand while parked. So: 48pt touch targets.
 *  - Status must be legible at a glance from arm's length. So: GREEN/AMBER/RED
 *    carry both color and a text label — never color alone, which also keeps it
 *    usable for the ~8% of male drivers with color vision deficiency.
 */

export const colors = {
  bg: '#0B0F14',
  surface: '#131A22',
  surfaceAlt: '#1A232D',
  border: '#26323F',
  borderBright: '#35465A',

  text: '#F2F6FA',
  textDim: '#9FB0C3',
  textFaint: '#6B7C8F',

  accent: '#F5A524',
  accentDim: '#7A5312',

  green: '#3FB950',
  greenDim: '#12331A',
  amber: '#E3A008',
  amberDim: '#3A2A05',
  red: '#F85149',
  redDim: '#3D1512',
  blue: '#58A6FF',
  blueDim: '#10263F',

  profit: '#3FB950',
  loss: '#F85149',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
  mono: { fontSize: 14, fontWeight: '600' as const },
} as const;

export const statusColor = (level: 'GREEN' | 'AMBER' | 'RED') =>
  level === 'GREEN' ? colors.green : level === 'AMBER' ? colors.amber : colors.red;

export const statusBg = (level: 'GREEN' | 'AMBER' | 'RED') =>
  level === 'GREEN' ? colors.greenDim : level === 'AMBER' ? colors.amberDim : colors.redDim;

/** Category accent used across cost breakdowns so buckets stay recognizable. */
export const categoryColor: Record<string, string> = {
  fuel: '#F5A524',
  variable: '#58A6FF',
  fixed: '#A371F7',
  driver: '#3FB950',
  trip: '#38BDAE',
  compliance: '#E3A008',
  business: '#8B949E',
  contingency: '#6B7C8F',
  incident: '#F85149',
};

export const usd = (n: number, decimals = 0): string => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  return `${sign}$${v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const usdCents = (n: number): string => usd(n, 2);

export const miles = (n: number): string => `${Math.round(n).toLocaleString('en-US')} mi`;

export const hours = (n: number): string => {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const shortDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
