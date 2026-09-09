import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VAT_RATES, vatRate, vatOn, grossFromNet, netFromGross } from '../src/tax.js';

test('vatRate returns configured rates', () => {
  assert.equal(vatRate('ZA'), 0.15);
  assert.equal(vatRate('GB'), 0.2);
  assert.equal(vatRate('US'), 0);
  assert.ok(Object.isFrozen(VAT_RATES));
});

test('vatRate rejects unknown regions', () => {
  assert.throws(() => vatRate('XX'), RangeError);
  assert.throws(() => vatRate('toString'), RangeError);
});

test('vatOn rounds once', () => {
  assert.equal(vatOn(1000, 'ZA'), 150);
  assert.equal(vatOn(30, 'ZA'), 5);
  assert.equal(vatOn(999, 'GB'), 200);
  assert.equal(vatOn(1000, 'US'), 0);
  assert.throws(() => vatOn(10.5, 'ZA'), TypeError);
});

test('gross and net conversions', () => {
  assert.equal(grossFromNet(1000, 'DE'), 1190);
  assert.equal(netFromGross(1190, 'DE'), 1000);
  assert.equal(netFromGross(1150, 'ZA'), 1000);
  assert.equal(netFromGross(115, 'ZA'), 100);
  assert.equal(netFromGross(500, 'US'), 500);
});
