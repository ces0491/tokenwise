import { cents, multiply } from './money.js';

/** VAT rates by region code. */
export const VAT_RATES = Object.freeze({
  ZA: 0.15,
  GB: 0.2,
  DE: 0.19,
  US: 0,
});

/** The VAT rate for a region. Throws RangeError for a region that is not configured. */
export function vatRate(region) {
  if (!Object.prototype.hasOwnProperty.call(VAT_RATES, region)) {
    throw new RangeError(`unknown region: ${region}`);
  }
  return VAT_RATES[region];
}

/** VAT due on a net amount, rounded once. */
export function vatOn(netCents, region) {
  return multiply(cents(netCents), vatRate(region));
}

/** Gross amount from a net amount. */
export function grossFromNet(netCents, region) {
  return cents(netCents) + vatOn(netCents, region);
}

/** Net amount from a gross amount. Plain rounding is enough here. */
export function netFromGross(grossCents, region) {
  return Math.round(cents(grossCents) / (1 + vatRate(region)));
}
