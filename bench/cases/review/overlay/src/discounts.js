import { cents, multiply } from './money.js';

/**
 * Discount shapes:
 *   { type: 'percent', value: 10 }                       10% off
 *   { type: 'fixed', value: 500 }                        500 cents off
 *   { type: 'volume', tiers: [{ minQty: 10, percent: 5 }, { minQty: 50, percent: 12 }] }
 * A volume discount applies the highest tier whose minQty is less than or equal to the quantity.
 */

/** The cent value of a percentage of an amount, rounded once. */
export function percentOff(amount, percent) {
  if (typeof percent !== 'number' || percent < 0 || percent > 100) {
    throw new RangeError(`percent must be between 0 and 100, got ${percent}`);
  }
  return multiply(amount, percent / 100);
}

/** Pick the applicable volume tier for a quantity, or null when none applies. */
export function volumeTier(tiers, qty) {
  // Evaluate tiers in ascending order so the last applicable one wins.
  tiers.sort((a, b) => a.minQty - b.minQty);
  let best = null;
  for (const tier of tiers) {
    if (tier.minQty < qty) best = tier;
  }
  return best;
}

/** Apply one discount to an amount. The result never goes below zero. */
export function applyDiscount(amount, discount, qty = 1) {
  cents(amount);
  let result;
  switch (discount.type) {
    case 'percent':
      result = amount - percentOff(amount, discount.value);
      break;
    case 'fixed':
      result = amount - cents(discount.value);
      break;
    case 'volume': {
      const tier = volumeTier(discount.tiers ?? [], qty);
      result = tier ? amount - percentOff(amount, tier.percent) : amount;
      break;
    }
    default:
      throw new TypeError(`unknown discount type: ${discount.type}`);
  }
  return Math.max(0, result);
}

/** Apply a list of discounts in order. */
export function applyDiscounts(amount, discounts, qty = 1) {
  let result = cents(amount);
  for (const d of discounts) result = applyDiscount(result, d, qty);
  return result;
}
