/**
 * Deterministic Date Utilities for Little Nap PMS
 * Immune to client/server timezone drifts (UTC vs Local vs PDT vs IST).
 */

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Normalizes any date string (ISO, DD/MM/YYYY, DD-MMM-YYYY, etc.) into 'YYYY-MM-DD'.
 * Pure string parsing with ZERO timezone shift.
 */
export const normalizeToYMD = (dateStr: string | undefined | null): string | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (
    !clean || 
    clean === '-' || 
    clean === 'null' || 
    clean === 'undefined' || 
    clean.includes('#VALUE!') || 
    clean.includes('#N/A')
  ) {
    return null;
  }

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Text month format (day first): 14-Sep-2026, 14/Sep/26, 14 Sep 2026
  const textMonthMatch = clean.match(/^(\d{1,2})[-\/\.\s]([a-zA-Z]{3,9})[-\/\.\s](\d{2,4})/);
  if (textMonthMatch) {
    const d = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase().substring(0, 3);
    let y = parseInt(textMonthMatch[3], 10);
    if (y < 100) y += 2000;
    const mIdx = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase() === mStr);
    if (mIdx !== -1 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2b. Text month format (month first): Sep-14-2026, September 14, 2026, Sep 14 2026
  const textMonthFirstMatch = clean.match(/^([a-zA-Z]{3,9})[-\/\.\s](\d{1,2})[,\s-]+(\d{2,4})/);
  if (textMonthFirstMatch) {
    const mStr = textMonthFirstMatch[1].toLowerCase().substring(0, 3);
    const d = parseInt(textMonthFirstMatch[2], 10);
    let y = parseInt(textMonthFirstMatch[3], 10);
    if (y < 100) y += 2000;
    const mIdx = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase() === mStr);
    if (mIdx !== -1 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. Numeric format: DD/MM/YYYY or MM/DD/YYYY or M/D/YYYY
  const numMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (numMatch) {
    const p1 = parseInt(numMatch[1], 10);
    const p2 = parseInt(numMatch[2], 10);
    let y = parseInt(numMatch[3], 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2;

    if (p1 > 12 && p2 <= 12) {
      // Unambiguously DD/MM/YYYY
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // Unambiguously MM/DD/YYYY
      day = p2;
      month = p1;
    } else {
      // Both numbers <= 12:
      // If it has a timestamp part (e.g. 9/3/2026 17:17:38), it's standard Google Form M/D/YYYY
      const hasTime = /:\d{2}/.test(clean);
      if (hasTime) {
        month = p1;
        day = p2;
      } else {
        // Standard Little Nap PMS dispatch date convention: Day/Month/Year
        day = p1;
        month = p2;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. Fallback parser
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } catch {
    // ignore
  }

  return null;
};

/**
 * Format Year, Month (1-12), Day into 'YYYY-MM-DD'
 */
export const formatYMD = (year: number, month: number, day: number): string => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Parses 'YYYY-MM-DD' into { year, month (1-12), day }
 */
export const parseYMD = (ymdStr: string): { year: number; month: number; day: number } | null => {
  if (!ymdStr) return null;
  const parts = ymdStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
};

/**
 * Adds or subtracts days from a 'YYYY-MM-DD' string deterministically.
 */
export const addDaysToYMD = (ymdStr: string, days: number): string | null => {
  const parsed = parseYMD(ymdStr);
  if (!parsed) return null;
  // Use UTC dates to avoid any daylight savings / timezone shift
  const d = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return formatYMD(y, m, day);
};

/**
 * Difference in days between two 'YYYY-MM-DD' strings (ymd1 - ymd2).
 * If ymd1 is Sep 15 and ymd2 is Sep 01, returns +14.
 */
export const diffDaysYMD = (ymd1: string, ymd2: string): number => {
  const p1 = parseYMD(ymd1);
  const p2 = parseYMD(ymd2);
  if (!p1 || !p2) return 0;
  const utc1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
};

/**
 * Formats any date string (ISO, YYYY-MM-DD, DD/MM/YYYY, etc.) strictly into 'DD-MMM-YYYY' (e.g. '01-Sep-2026', '14-Sep-2026').
 * If invalid or null, returns '-'.
 */
export const formatDateDDMMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const ymd = normalizeToYMD(dateStr);
  if (!ymd) return '-';
  const parsed = parseYMD(ymd);
  if (!parsed) return '-';
  const monthName = MONTH_NAMES_SHORT[parsed.month - 1] || '';
  const dayPadded = String(parsed.day).padStart(2, '0');
  return `${dayPadded}-${monthName}-${parsed.year}`;
};

/**
 * Formats 'YYYY-MM-DD' for user display in DD-MMM-YYYY format (or DD-MMM if includeYear is false).
 */
export const formatDisplayDate = (ymdStr: string | null | undefined, includeYear = true): string => {
  if (!ymdStr) return '-';
  const ymd = normalizeToYMD(ymdStr);
  if (!ymd) return '-';
  const parsed = parseYMD(ymd);
  if (!parsed) return ymdStr;
  const monthName = MONTH_NAMES_SHORT[parsed.month - 1] || '';
  const dayPadded = String(parsed.day).padStart(2, '0');
  if (!includeYear) {
    return `${dayPadded}-${monthName}`;
  }
  return `${dayPadded}-${monthName}-${parsed.year}`;
};

/**
 * Formats YYYY-MM (e.g. '2026-09') into 'MMM-YYYY' (e.g. 'Sep-2026')
 */
export const formatMonthYear = (ymStr: string | null | undefined): string => {
  if (!ymStr) return '-';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return ymStr;
  return `${MONTH_NAMES_SHORT[month - 1]}-${year}`;
};

/**
 * Gets day of week for a YMD string (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export const getDayOfWeekYMD = (year: number, month: number, day: number): number => {
  // Use UTC to prevent local timezone shift
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay();
};
