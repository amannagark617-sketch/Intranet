import { normalizeToYMD } from '../utils/dateUtils';

export const DISPATCH_SHEET_PUB_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRU01gvN8eLy_Zo_N2f8GIUwMgWQJu8PQ10wGomUcLMgvfDGsVxW_rQ07ppRnhGsIwKD93J5QeFyQiQ/pub?gid=320192434&single=true&output=csv';

export interface DispatchRecord {
  id: string;
  timestamp: string;
  dateYMD: string;
  monthKey: string; // YYYY-MM
  quantity: number; // Number of Boxes
  opfNo?: string;
  modelName?: string;
  pictureUrl?: string | null;
  remarks?: string | null;
}

// In-memory cache
let cachedDispatchRecords: DispatchRecord[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

const MONTH_NAMES_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const robustCsvSplit = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Parses timestamp from Google Form dispatch response sheet e.g. "01-Jul-2026 14:48:17" or "07/09/2026 12:32:10"
 */
export const parseDispatchTimestamp = (rawTs: string): { dateYMD: string; monthKey: string } | null => {
  if (!rawTs || typeof rawTs !== 'string') return null;
  const clean = rawTs.trim();
  if (!clean || clean === '-' || clean === 'null' || clean === 'undefined') return null;

  // Format 1: DD-MMM-YYYY or DD/MMM/YYYY or DD MMM YYYY (e.g. "01-Jul-2026 14:48:17")
  const textMatch = clean.match(/^(\d{1,2})[-\/\.\s]([a-zA-Z]{3,9})[-\/\.\s](\d{2,4})/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const mStr = textMatch[2].toLowerCase();
    const mon = MONTH_NAMES_MAP[mStr] || MONTH_NAMES_MAP[mStr.slice(0, 3)];
    let yr = parseInt(textMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (mon) {
      return { dateYMD: `${yr}-${mon}-${day}`, monthKey: `${yr}-${mon}` };
    }
  }

  // Format 2: MMM-DD-YYYY (e.g. "Jul-01-2026")
  const mFirst = clean.match(/^([a-zA-Z]{3,9})[-\/\.\s](\d{1,2})[,\s-]+(\d{2,4})/);
  if (mFirst) {
    const mStr = mFirst[1].toLowerCase();
    const day = mFirst[2].padStart(2, '0');
    let yr = parseInt(mFirst[3], 10);
    if (yr < 100) yr += 2000;
    const mon = MONTH_NAMES_MAP[mStr] || MONTH_NAMES_MAP[mStr.slice(0, 3)];
    if (mon) {
      return { dateYMD: `${yr}-${mon}-${day}`, monthKey: `${yr}-${mon}` };
    }
  }

  // Format 3: DD/MM/YYYY or MM/DD/YYYY numeric
  const dmyMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2;
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && y >= 2000 && y <= 2100) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return { dateYMD: `${y}-${mStr}-${dStr}`, monthKey: `${y}-${mStr}` };
    }
  }

  // Fallback to general normalizeToYMD
  const ymd = normalizeToYMD(clean);
  if (ymd) {
    return { dateYMD: ymd, monthKey: ymd.slice(0, 7) };
  }

  return null;
};

/**
 * Fetches and parses all dispatch response records from the Google Sheet
 */
export const fetchDispatchRecords = async (force = false): Promise<DispatchRecord[]> => {
  const now = Date.now();
  if (!force && cachedDispatchRecords && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedDispatchRecords;
  }

  let csvText = '';
  try {
    const res = await fetch(DISPATCH_SHEET_PUB_CSV_URL);
    if (res.ok) {
      csvText = await res.text();
    }
  } catch (err) {
    console.error('Failed fetching dispatch response sheet:', err);
  }

  if (!csvText || csvText.trim().length === 0) {
    return cachedDispatchRecords || [];
  }

  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Row 0 is header: Timestamp,Number of Boxes ,,2024-12-01
  const records: DispatchRecord[] = [];
  const dataLines = lines.slice(1);

  dataLines.forEach((line, idx) => {
    if (!line || !line.trim()) return;
    const cols = robustCsvSplit(line);
    if (cols.length < 2) return;

    const rawTs = cols[0]?.trim();
    if (!rawTs || rawTs.toLowerCase().includes('timestamp')) return;

    const parsedDate = parseDispatchTimestamp(rawTs);
    if (!parsedDate) return;

    const rawQty = cols[1]?.trim()?.replace(/[^0-9]/g, '') || '';
    const quantity = rawQty ? parseInt(rawQty, 10) : 1;

    records.push({
      id: `disp-${parsedDate.dateYMD}-${idx}`,
      timestamp: rawTs,
      dateYMD: parsedDate.dateYMD,
      monthKey: parsedDate.monthKey,
      quantity: Math.max(1, quantity),
      opfNo: cols[2]?.trim() || '',
      modelName: cols[3]?.trim() || '',
    });
  });

  cachedDispatchRecords = records;
  lastFetchTime = Date.now();
  return records;
};

/**
 * Returns a map of monthKey (YYYY-MM) to total dispatched units
 */
export const getDispatchedUnitsByMonth = (records: DispatchRecord[]): Map<string, number> => {
  const map = new Map<string, number>();
  records.forEach((rec) => {
    map.set(rec.monthKey, (map.get(rec.monthKey) || 0) + rec.quantity);
  });
  return map;
};
