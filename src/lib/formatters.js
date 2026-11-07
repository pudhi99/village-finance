/**
 * Universal formatters re-export — Village Finance
 * Safely bridges any imports of '@/lib/formatters' to '@/lib/money'.
 */

export {
  formatINR,
  formatPaise,
  rupeesToPaise,
  paiseToRupees,
  addPaise,
  subtractPaise,
} from './money/index.js';
