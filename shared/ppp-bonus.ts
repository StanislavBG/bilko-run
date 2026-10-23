/**
 * PPP bonus credits: a country-based bonus paid as EXTRA Bilko Credits on a top-up.
 * PPP is bonus credits, never a lower charge (D-2026-10-20-14).
 *
 * Source: World Bank country income classification, FY2026 (effective 1 July 2025).
 * Tiers: high income 0% (not listed), upper-middle income 50%, lower-middle and
 * low income 100%. Unlisted or missing countries get 0%.
 *
 * HOW TO EDIT: change PPP_BONUS_PERCENT below. Keys are uppercase ISO 3166-1 alpha-2
 * codes, one per line, grouped by tier and alphabetical. To change a country, move its
 * line to another tier block (or delete it for 0%); the value must be 50 or 100.
 *
 * Keep this file pure — no fs, no env reads, no server imports — so it loads in the
 * browser bundle and on the server.
 */

export const PPP_BONUS_PERCENT: Readonly<Record<string, 50 | 100>> = {
  // Upper-middle income: 50%
  AL: 50,
  AM: 50,
  AR: 50,
  AZ: 50,
  BA: 50,
  BG: 50,
  BR: 50,
  BW: 50,
  BY: 50,
  BZ: 50,
  CN: 50,
  CO: 50,
  CR: 50,
  CU: 50,
  DM: 50,
  DO: 50,
  DZ: 50,
  EC: 50,
  FJ: 50,
  GA: 50,
  GD: 50,
  GE: 50,
  GQ: 50,
  GT: 50,
  GY: 50,
  ID: 50,
  IQ: 50,
  IR: 50,
  JM: 50,
  JO: 50,
  KZ: 50,
  LB: 50,
  LC: 50,
  LY: 50,
  MD: 50,
  ME: 50,
  MH: 50,
  MK: 50,
  MU: 50,
  MV: 50,
  MX: 50,
  MY: 50,
  NA: 50,
  PE: 50,
  PW: 50,
  PY: 50,
  RS: 50,
  SR: 50,
  SV: 50,
  TH: 50,
  TM: 50,
  TO: 50,
  TR: 50,
  TV: 50,
  VC: 50,
  WS: 50,
  ZA: 50,
  // Lower-middle and low income: 100%
  AF: 100,
  AO: 100,
  BD: 100,
  BF: 100,
  BI: 100,
  BJ: 100,
  BO: 100,
  BT: 100,
  CD: 100,
  CF: 100,
  CG: 100,
  CI: 100,
  CM: 100,
  CV: 100,
  DJ: 100,
  EG: 100,
  ER: 100,
  ET: 100,
  FM: 100,
  GH: 100,
  GM: 100,
  GN: 100,
  GW: 100,
  HN: 100,
  HT: 100,
  IN: 100,
  KE: 100,
  KG: 100,
  KH: 100,
  KM: 100,
  KP: 100,
  LA: 100,
  LK: 100,
  LR: 100,
  LS: 100,
  MA: 100,
  MG: 100,
  ML: 100,
  MM: 100,
  MN: 100,
  MR: 100,
  MW: 100,
  MZ: 100,
  NE: 100,
  NG: 100,
  NI: 100,
  NP: 100,
  PG: 100,
  PH: 100,
  PK: 100,
  PS: 100,
  RW: 100,
  SB: 100,
  SD: 100,
  SL: 100,
  SN: 100,
  SO: 100,
  SS: 100,
  ST: 100,
  SY: 100,
  SZ: 100,
  TD: 100,
  TG: 100,
  TL: 100,
  TN: 100,
  TZ: 100,
  UA: 100,
  UG: 100,
  UZ: 100,
  VN: 100,
  VU: 100,
  YE: 100,
  ZM: 100,
  ZW: 100,
};

/** Bonus percent (0, 50 or 100) for a country code. Case-insensitive; trims; 0 if unknown/invalid. */
export function pppBonusPercent(country: string | null | undefined): number {
  if (typeof country !== 'string') return 0;
  const code = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return 0;
  return Object.prototype.hasOwnProperty.call(PPP_BONUS_PERCENT, code) ? PPP_BONUS_PERCENT[code] : 0;
}

/** Bonus amount in cents for a paid amount in cents. 0 for non-positive or non-integer amounts. */
export function pppBonusCents(country: string | null | undefined, paidCents: number): number {
  if (!Number.isInteger(paidCents) || paidCents <= 0) return 0;
  return Math.floor((paidCents * pppBonusPercent(country)) / 100);
}
