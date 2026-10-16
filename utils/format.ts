/** Compact rupee format used across the dashboard: ₹2.44 Cr, ₹95.87 L, ₹12,500 */
export const formatInrCompact = (amount: number): string => {
  const n = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(2)} L`;
  return `${sign}₹${Math.round(n).toLocaleString('en-IN')}`;
};

/** "ARMONIA LOUNGER" -> "Armonia Lounger" (sheet data is often ALL CAPS). */
export const titleCase = (s: string | null | undefined): string =>
  (s || '').toLowerCase().replace(/(^|[\s(\-/&+,])([a-z])/g, (_m, p, c) => p + c.toUpperCase());
