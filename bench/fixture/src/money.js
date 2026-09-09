// Integer-cent arithmetic. Every exported function takes and returns whole cents.

/** Assert that a value is an integer number of cents and return it. */
export function cents(amount) {
  if (!Number.isInteger(amount)) throw new TypeError(`cents must be an integer, got ${amount}`);
  return amount;
}

/** Round a fractional cent value half away from zero to a whole number of cents. */
export function roundHalfUp(value) {
  if (!Number.isFinite(value)) throw new TypeError(`cannot round ${value}`);
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Multiply whole cents by a factor and round once. */
export function multiply(amount, factor) {
  cents(amount);
  if (!Number.isFinite(factor)) throw new TypeError(`factor must be a finite number, got ${factor}`);
  return roundHalfUp(amount * factor);
}

/** Sum a list of whole-cent amounts. */
export function sum(amounts) {
  let total = 0;
  for (const a of amounts) total += cents(a);
  return total;
}

/** Parse a decimal string such as "12.34" or "-0.5" into cents. At most two decimal places. */
export function fromDecimal(text) {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(text).trim());
  if (!m) throw new SyntaxError(`not a decimal amount: ${text}`);
  const [, sign, whole, frac = ''] = m;
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return sign ? -value : value;
}

/** Format cents as a decimal string with two places, e.g. 1234 -> "12.34", -5 -> "-0.05". */
export function toDecimal(amount) {
  cents(amount);
  const abs = Math.abs(amount);
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return amount < 0 ? `-${text}` : text;
}

/**
 * Split a whole-cent total across ratios so the parts are whole cents and add up exactly to the total.
 * Uses the largest-remainder method; remainders are handed out in order of size, then position.
 */
export function allocate(total, ratios) {
  cents(total);
  if (!Array.isArray(ratios) || ratios.length === 0) throw new RangeError('ratios must be a non-empty array');
  const weight = ratios.reduce((a, r) => a + r, 0);
  if (!(weight > 0)) throw new RangeError('ratios must sum to a positive number');
  const raw = ratios.map((r) => (total * r) / weight);
  const parts = raw.map((v) => (v < 0 ? -Math.floor(-v) : Math.floor(v)));
  let remainder = total - parts.reduce((a, p) => a + p, 0);
  const order = raw
    .map((v, i) => ({ i, frac: Math.abs(v) - Math.floor(Math.abs(v)) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const step = remainder < 0 ? -1 : 1;
  for (let k = 0; remainder !== 0; k = (k + 1) % order.length) {
    parts[order[k].i] += step;
    remainder -= step;
  }
  return parts;
}
