import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cents, roundHalfUp, multiply, sum, fromDecimal, toDecimal, allocate } from '../src/money.js';

test('cents accepts integers and rejects fractions', () => {
  assert.equal(cents(0), 0);
  assert.equal(cents(-250), -250);
  assert.throws(() => cents(1.5), TypeError);
  assert.throws(() => cents('1'), TypeError);
});

test('roundHalfUp rounds half away from zero', () => {
  assert.equal(roundHalfUp(2.5), 3);
  assert.equal(roundHalfUp(-2.5), -3);
  assert.equal(roundHalfUp(2.4), 2);
  assert.equal(roundHalfUp(-2.4), -2);
  assert.equal(roundHalfUp(0.5), 1);
  assert.throws(() => roundHalfUp(NaN), TypeError);
});

test('multiply rounds once', () => {
  assert.equal(multiply(1000, 0.15), 150);
  assert.equal(multiply(30, 0.15), 5);
  assert.equal(multiply(10, 0.15), 2);
  assert.throws(() => multiply(10.5, 2), TypeError);
});

test('sum adds whole cents', () => {
  assert.equal(sum([1, 2, 3]), 6);
  assert.equal(sum([]), 0);
  assert.throws(() => sum([1, 1.5]), TypeError);
});

test('fromDecimal parses up to two places', () => {
  assert.equal(fromDecimal('12.34'), 1234);
  assert.equal(fromDecimal('12.3'), 1230);
  assert.equal(fromDecimal('7'), 700);
  assert.equal(fromDecimal('-0.5'), -50);
  assert.equal(fromDecimal(' 0.05 '), 5);
  assert.throws(() => fromDecimal('1.234'), SyntaxError);
  assert.throws(() => fromDecimal('abc'), SyntaxError);
});

test('toDecimal formats with two places', () => {
  assert.equal(toDecimal(1234), '12.34');
  assert.equal(toDecimal(-5), '-0.05');
  assert.equal(toDecimal(0), '0.00');
  assert.equal(toDecimal(100), '1.00');
});

test('allocate splits exactly by largest remainder', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(10, [1, 1, 1, 1]), [3, 3, 2, 2]);
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(allocate(1000, [70, 30]), [700, 300]);
  assert.throws(() => allocate(100, []), RangeError);
  assert.throws(() => allocate(100, [0, 0]), RangeError);
});
