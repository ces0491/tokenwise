import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentOff, volumeTier, applyDiscount, applyDiscounts } from '../src/discounts.js';

const tiers = [{ minQty: 10, percent: 5 }, { minQty: 50, percent: 12 }];

test('percentOff rounds once and validates the percentage', () => {
  assert.equal(percentOff(1000, 10), 100);
  assert.equal(percentOff(999, 10), 100);
  assert.equal(percentOff(1000, 0), 0);
  assert.throws(() => percentOff(1000, 101), RangeError);
  assert.throws(() => percentOff(1000, -1), RangeError);
});

test('volumeTier picks the highest applicable tier', () => {
  assert.equal(volumeTier(tiers, 9), null);
  assert.equal(volumeTier(tiers, 12), tiers[0]);
  assert.equal(volumeTier(tiers, 100), tiers[1]);
  assert.equal(volumeTier([tiers[1], tiers[0]], 20), tiers[0]);
});

test('applyDiscount handles each type and floors at zero', () => {
  assert.equal(applyDiscount(1000, { type: 'percent', value: 10 }), 900);
  assert.equal(applyDiscount(1000, { type: 'fixed', value: 500 }), 500);
  assert.equal(applyDiscount(1000, { type: 'fixed', value: 1500 }), 0);
  assert.equal(applyDiscount(1000, { type: 'volume', tiers }, 12), 950);
  assert.equal(applyDiscount(1000, { type: 'volume', tiers }, 5), 1000);
  assert.throws(() => applyDiscount(1000, { type: 'bogus' }), TypeError);
});

test('applyDiscounts applies in order', () => {
  assert.equal(applyDiscounts(1000, [{ type: 'percent', value: 10 }, { type: 'fixed', value: 100 }]), 800);
  assert.equal(applyDiscounts(1000, [{ type: 'fixed', value: 100 }, { type: 'percent', value: 10 }]), 810);
  assert.equal(applyDiscounts(1000, []), 1000);
});
