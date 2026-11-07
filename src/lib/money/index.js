/**
 * Money utilities — Village Finance.
 *
 * All monetary values are stored and computed as integer paise (1 INR = 100 paise).
 * Never use floating-point arithmetic for financial calculations.
 *
 * Rules:
 * - Input from UI is in rupees (integer or decimal string); convert to paise immediately.
 * - Database stores paise as INTEGER or BIGINT.
 * - Display converts paise back to INR with Indian digit grouping.
 * - Rounding: half-up (Math.round) for display only; storage must be exact.
 */

/** Convert rupees (number or string) to paise (integer). */
export function rupeesToPaise(rupees) {
  const r = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(r)) throw new Error(`Invalid rupee value: ${rupees}`);
  return Math.round(r * 100);
}

/** Convert paise (integer) to rupees (number, 2 decimal places). */
export function paiseToRupees(paise) {
  if (!Number.isInteger(paise)) throw new Error(`Paise must be an integer: ${paise}`);
  return paise / 100;
}

/**
 * Format a rupee amount as an Indian-locale currency string.
 * Example: 12500 → "₹12,500" or "₹12,500.00"
 *
 * @param {number|string} rupees - Rupee amount
 * @param {object} [options]
 * @param {boolean} [options.showDecimal=false] - Whether to force 2 decimal places (.00)
 * @returns {string}
 */
export function formatINR(rupees, { showDecimal = false } = {}) {
  const r = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(r)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimal ? 2 : 0,
    maximumFractionDigits: showDecimal ? 2 : 0,
  }).format(r);
}

/**
 * Format integer paise as an Indian-locale currency string.
 * Example: 1250000 paise → "₹12,500"
 */
export function formatPaise(paise, options = {}) {
  if (!Number.isFinite(paise)) return '₹0';
  return formatINR(paise / 100, options);
}

/**
 * Safe integer addition for paise values.
 * @param {...number} values - Paise integers
 * @returns {number}
 */
export function addPaise(...values) {
  return values.reduce((sum, v) => {
    if (!Number.isInteger(v)) throw new Error(`Paise must be integer: ${v}`);
    return sum + v;
  }, 0);
}

/**
 * Safe integer subtraction for paise values.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function subtractPaise(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error(`Paise must be integers: ${a}, ${b}`);
  }
  return a - b;
}
