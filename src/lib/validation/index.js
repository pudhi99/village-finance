/**
 * Zod-based input validation helpers — Village Finance.
 *
 * All server-side inputs (Server Actions, Route Handlers) must be
 * validated with Zod before processing. This module provides
 * shared schemas and a typed parse helper.
 */
import { z } from 'zod';

export { z };

/**
 * Parse and validate data against a Zod schema.
 * Returns parsed data or throws a ValidationError with field-level messages.
 *
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.flatten());
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message, fieldErrors) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
    this.statusCode = 422;
  }
}

// ---- Shared base schemas ----

/** UUID string */
export const uuidSchema = z.string().uuid();

/** Positive integer paise amount */
export const paiseSchema = z
  .number()
  .int('Amount must be an integer (paise)')
  .positive('Amount must be positive');

/** Date string YYYY-MM-DD */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

/** Indian mobile number — 10 digits, optionally prefixed +91 */
export const mobileSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, 'Invalid Indian mobile number');
