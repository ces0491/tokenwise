import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvField, toCsv, linesFromCsv } from '../src/csv.js';

test('parseCsv handles plain rows and line endings', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,\n'), [['a', '']]);
  assert.deepEqual(parseCsv(''), []);
});

test('parseCsv handles quotes', () => {
  assert.deepEqual(parseCsv('"x,y",z'), [['x,y', 'z']]);
  assert.deepEqual(parseCsv('"say ""hi""",z'), [['say "hi"', 'z']]);
  assert.deepEqual(parseCsv('"line1\nline2",z'), [['line1\nline2', 'z']]);
});

test('csvField quotes only when needed', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField(null), '');
});

test('toCsv round-trips through parseCsv', () => {
  const rows = [['sku', 'description'], ['A-1', 'Widget, large'], ['B-2', 'Says "hello"']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
  assert.ok(toCsv(rows).endsWith('\n'));
});

test('linesFromCsv builds invoice lines', () => {
  const text = 'sku,description,qty,unit\nA-1,Widget,2,12.50\nB-2,"Gadget, blue",1,3\n';
  assert.deepEqual(linesFromCsv(text), [
    { sku: 'A-1', description: 'Widget', qty: 2, unitCents: 1250 },
    { sku: 'B-2', description: 'Gadget, blue', qty: 1, unitCents: 300 },
  ]);
  assert.throws(() => linesFromCsv('sku,qty,unit\nA,1,1\n'), SyntaxError);
  assert.throws(() => linesFromCsv('sku,description,qty,unit\nA,x,0,1\n'), RangeError);
  assert.throws(() => linesFromCsv(''), SyntaxError);
});
