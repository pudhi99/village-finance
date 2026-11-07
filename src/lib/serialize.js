/**
 * Recursively converts Prisma Decimal objects into native JavaScript numbers
 * to ensure plain object compatibility across the Server Component -> Client Component boundary.
 */
export function serializeDecimals(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'object') {
    // Check if it's a Decimal instance (Prisma.Decimal or decimal.js)
    if (typeof obj.toNumber === 'function') {
      return obj.toNumber();
    }
    if (obj.constructor && obj.constructor.name === 'Decimal') {
      return Number(obj.toString());
    }
    // Dates are natively supported by React Flight / RSC
    if (obj instanceof Date) {
      return obj;
    }
    // Arrays
    if (Array.isArray(obj)) {
      return obj.map(serializeDecimals);
    }
    // Plain objects
    const res = {};
    for (const [key, value] of Object.entries(obj)) {
      res[key] = serializeDecimals(value);
    }
    return res;
  }

  return obj;
}
