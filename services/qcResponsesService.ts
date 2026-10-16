import type { FinalQcRecord, QcMonthlyAggregate, Order } from '../types';
import { normalizeToYMD } from '../utils/dateUtils';

export const FINAL_QC_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYex0vsRmtmrWOt6G63MlFiZ4jkLAGALmnTNBZfnremcOTd07cyRQOOnX0XSM9sRNLDo-RbpidKfss/pub?gid=1551787833&single=true&output=csv';

let cachedRecords: FinalQcRecord[] | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute in-memory cache

const MONTH_NAMES_MAP: Record<string, string> = {
  'jan': '01', 'january': '01',
  'feb': '02', 'february': '02',
  'mar': '03', 'march': '03',
  'apr': '04', 'april': '04',
  'may': '05',
  'jun': '06', 'june': '06',
  'jul': '07', 'july': '07',
  'aug': '08', 'august': '08',
  'sep': '09', 'september': '09',
  'oct': '10', 'october': '10',
  'nov': '11', 'november': '11',
  'dec': '12', 'december': '12'
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Robust parser for Google Form / Google Sheets Final QC response timestamps.
 * Handles diverse and mixed formats that occur when form responses are appended:
 * - "03-Sep-2026 15:34:58", "3-Sep-2026", "02/Sep/2026" (DD-MMM-YYYY or D-MMM-YYYY)
 * - "Sep-03-2026", "September 3, 2026 17:14:51", "Sep 3 2026" (MMM-DD-YYYY)
 * - "9/3/2026 17:17:38", "9/5/2026 11:41:51", "09/03/2026" (Google Forms native M/D/YYYY)
 * - "25/09/2026 17:17:38", "25/9/2026" (DD/MM/YYYY when day > 12)
 * - "2026-09-03 17:14:51", "2026/09/03" (ISO YYYY-MM-DD or YYYY/MM/DD)
 * - AM/PM 12-hour timestamps e.g. "9/3/2026 5:17:38 PM"
 */
export const parseQcTimestamp = (rawTs: string): { dateYMD: string; monthKey: string } | null => {
  if (!rawTs || typeof rawTs !== 'string') return null;
  const clean = rawTs.trim();
  if (!clean || clean === '-' || clean === 'null' || clean === 'undefined') return null;

  // Format 1: Text month with day first: DD-MMM-YYYY (e.g. "04-Jun-2024 11:40:42", "03-Sep-2026 15:34:58")
  const textMonthDayFirst = clean.match(/^(\d{1,2})[-\/\.\s]([a-zA-Z]{3,9})[-\/\.\s](\d{2,4})/);
  if (textMonthDayFirst) {
    const day = textMonthDayFirst[1].padStart(2, '0');
    const mStr = textMonthDayFirst[2].toLowerCase();
    let y = parseInt(textMonthDayFirst[3], 10);
    if (y < 100) y += 2000;
    const monNum = MONTH_NAMES_MAP[mStr] || MONTH_NAMES_MAP[mStr.slice(0, 3)];
    if (monNum) {
      return { dateYMD: `${y}-${monNum}-${day}`, monthKey: `${y}-${monNum}` };
    }
  }

  // Format 2: Text month with month first: MMM-DD-YYYY (e.g. "Sep-03-2026", "September 3, 2026 17:14:51")
  const textMonthFirst = clean.match(/^([a-zA-Z]{3,9})[-\/\.\s](\d{1,2})[,\s-]+(\d{2,4})/);
  if (textMonthFirst) {
    const mStr = textMonthFirst[1].toLowerCase();
    const day = textMonthFirst[2].padStart(2, '0');
    let y = parseInt(textMonthFirst[3], 10);
    if (y < 100) y += 2000;
    const monNum = MONTH_NAMES_MAP[mStr] || MONTH_NAMES_MAP[mStr.slice(0, 3)];
    if (monNum) {
      return { dateYMD: `${y}-${monNum}-${day}`, monthKey: `${y}-${monNum}` };
    }
  }

  // Format 3: ISO format: YYYY-MM-DD or YYYY/MM/DD (e.g. "2026-09-03 17:14:51")
  const isoMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return { dateYMD: `${y}-${m}-${d}`, monthKey: `${y}-${m}` };
  }

  // Format 4: Google Forms Numeric Timestamp (e.g. "9/3/2026 17:17:38", "9/5/2026 11:41:51")
  const numMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (numMatch) {
    const p1 = parseInt(numMatch[1], 10);
    const p2 = parseInt(numMatch[2], 10);
    let y = parseInt(numMatch[3], 10);
    if (y < 100) y += 2000;

    let day = p2;
    let month = p1;

    // Disambiguate day and month:
    if (p1 > 12 && p2 <= 12) {
      // 25/09/2026 -> p1 is Day, p2 is Month
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // 09/25/2026 -> p1 is Month, p2 is Day
      month = p1;
      day = p2;
    } else {
      // Both numbers <= 12 (e.g. 9/3/2026 for Sep 3, 9/5/2026 for Sep 5):
      // In Google Form response sheets, default auto-timestamping outputs M/D/YYYY (Month first).
      month = p1;
      day = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && y >= 2000 && y <= 2100) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return { dateYMD: `${y}-${mStr}-${dStr}`, monthKey: `${y}-${mStr}` };
    }
  }

  // Format 5: Native JS Date fallback
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (y >= 2000 && y <= 2100) {
        return { dateYMD: `${y}-${m}-${day}`, monthKey: `${y}-${m}` };
      }
    }
  } catch {
    // Ignore fallback failure
  }

  // Format 6: General normalizeToYMD fallback
  const ymd = normalizeToYMD(clean);
  if (ymd) {
    const monthKey = ymd.slice(0, 7);
    return { dateYMD: ymd, monthKey };
  }

  return null;
};

/**
 * Robust CSV Line Parser that respects quoted fields containing commas
 */
const parseCsvRow = (rowStr: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
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
 * Fetches and parses the Final QC Response Sheet CSV
 */
export const fetchFinalQcRecords = async (forceRefresh = false): Promise<FinalQcRecord[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedRecords && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedRecords;
  }

  try {
    const response = await fetch(FINAL_QC_SHEET_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Final QC sheet: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) {
      return cachedRecords || [];
    }

    const records: FinalQcRecord[] = [];

    // Row 0 is header, data starts on Row 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim() === '') continue;

      const cols = parseCsvRow(line);
      if (cols.length < 3) continue;

      const rawTs = cols[0] || '';
      const parsedDate = parseQcTimestamp(rawTs);
      if (!parsedDate) continue;

      const opfNo = cols[2]?.trim() || '';
      if (!opfNo || opfNo.toLowerCase() === 'na' || opfNo.toLowerCase().includes('opf no')) {
        continue;
      }

      const factoryNo = cols[3]?.trim() || '';
      const rawTotQty = cols[4]?.replace(/[^0-9.]/g, '') || '0';
      const rawPassQty = cols[5]?.replace(/[^0-9.]/g, '') || '0';
      const rawRejQty = cols[6]?.replace(/[^0-9.]/g, '') || '0';

      const totalQuantity = parseInt(rawTotQty, 10) || 0;
      let passQuantity = parseInt(rawPassQty, 10) || 0;
      const rejectedQuantity = parseInt(rawRejQty, 10) || 0;

      const qcInspector = cols[7]?.trim() || 'QC Team';
      const rawImages = cols[8]?.trim() || '';
      const productImageUrls = rawImages
        ? rawImages.split(/,\s*/).map((u) => u.trim()).filter((u) => u.startsWith('http'))
        : [];

      const rawStatus = (cols[9] || '').trim();
      const status: 'Pass' | 'Rejected' = rawStatus.toLowerCase() === 'pass' ? 'Pass' : 'Rejected';
      const passRemarks = cols[10]?.trim() || '';

      // If status is 'Pass' and passQuantity is 0, fall back to totalQuantity or 1
      if (status === 'Pass' && passQuantity === 0 && totalQuantity > 0) {
        passQuantity = totalQuantity;
      }

      records.push({
        timestamp: rawTs,
        dateYMD: parsedDate.dateYMD,
        monthKey: parsedDate.monthKey,
        opfNo,
        factoryNo,
        totalQuantity,
        passQuantity,
        rejectedQuantity,
        qcInspector,
        productImageUrls,
        status,
        passRemarks
      });
    }

    cachedRecords = records;
    lastFetchTime = now;
    return records;
  } catch (err) {
    console.error('Error loading Final QC Response Sheet:', err);
    if (cachedRecords) return cachedRecords;
    return [];
  }
};

import { DispatchRecord, getDispatchedUnitsByMonth } from './dispatchResponseService';

/**
 * Verified historical monthly dispatched figures provided by management (Image 2)
 * Month Wise (01-Apr-25 to 01-Jun-26)
 */
export const HISTORICAL_MONTHLY_DISPATCHED: Record<string, number> = {
  '2025-04': 984,
  '2025-05': 787,
  '2025-06': 813,
  '2025-07': 1192,
  '2025-08': 1293,
  '2025-09': 1654,
  '2025-10': 1477,
  '2025-11': 1083,
  '2025-12': 1024,
  '2026-01': 1156,
  '2026-02': 871,
  '2026-03': 1253,
  '2026-04': 1155,
  '2026-05': 1061,
  '2026-06': 1197,
};

/**
 * Manual baseline target, achieved, and dispatched data for months before August 2025 (Image 1)
 * Apr 2025: Target 1,500 | Achieved 929 (62%) | Dispatched 984 (106%)
 * May 2025: Target 1,500 | Achieved 842 (56%) | Dispatched 787 (93%)
 * Jun 2025: Target 1,400 | Achieved 1,001 (72%) | Dispatched 813 (81%)
 * Jul 2025: Target 1,400 | Achieved 1,147 (82%) | Dispatched 1,192 (104%)
 */
export const MANUAL_MONTHLY_DATA_BEFORE_AUG_2025: Record<string, {
  target: number;
  achieved: number;
  dispatched: number;
}> = {
  '2025-04': { target: 1500, achieved: 929, dispatched: 984 },
  '2025-05': { target: 1500, achieved: 842, dispatched: 787 },
  '2025-06': { target: 1400, achieved: 1001, dispatched: 813 },
  '2025-07': { target: 1400, achieved: 1147, dispatched: 1192 },
};

/**
 * Monthly benchmark targets as per Little Nap production plan
 */
export const getMonthlyTarget = (monthKey: string): number => {
  if (MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[monthKey]) {
    return MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[monthKey].target;
  }
  return 1400;
};

/**
 * Builds monthly aggregates strictly combining manual management baseline (Image 1 & 2),
 * live Final QC records, PMS orders, and Dispatch Response Sheet.
 */
export const buildMonthlyAggregates = (
  records: FinalQcRecord[],
  orders: Order[],
  dispatchRecords: DispatchRecord[] = [],
  minMonthKey: string = '2025-04'
): QcMonthlyAggregate[] => {
  // Group live QC records by monthKey
  const monthMap = new Map<string, {
    passQty: number;
    rejQty: number;
    totalSubmissions: number;
  }>();

  records.forEach((rec) => {
    if (!monthMap.has(rec.monthKey)) {
      monthMap.set(rec.monthKey, {
        passQty: 0,
        rejQty: 0,
        totalSubmissions: 0,
      });
    }
    const entry = monthMap.get(rec.monthKey)!;
    entry.totalSubmissions += 1;

    if (rec.status === 'Pass' || rec.passQuantity > 0) {
      entry.passQty += rec.passQuantity;
    }
    entry.rejQty += rec.rejectedQuantity;
  });

  // Calculate dispatched per month from real PMS orders
  const dispatchedByMonth = new Map<string, number>();
  orders.forEach((order) => {
    if (order.overallStatus === 'Dispatched' && order.dispatchDate) {
      const mKey = order.dispatchDate.slice(0, 7);
      dispatchedByMonth.set(mKey, (dispatchedByMonth.get(mKey) || 0) + (order.quantity || 0));
    }
  });

  // Calculate dispatched from Dispatch Response Sheet (used for July 2026 onwards)
  const dispatchByMonthFromSheet = getDispatchedUnitsByMonth(dispatchRecords);

  // Compile full set of tracked months starting from minMonthKey ('2025-04')
  const allMonthKeysSet = new Set<string>([
    ...Object.keys(MANUAL_MONTHLY_DATA_BEFORE_AUG_2025),
    ...Object.keys(HISTORICAL_MONTHLY_DISPATCHED),
    ...Array.from(monthMap.keys()),
    ...Array.from(dispatchByMonthFromSheet.keys()),
  ]);

  const allMonths = Array.from(allMonthKeysSet)
    .filter((mKey) => !minMonthKey || mKey >= minMonthKey)
    .sort();
  
  const result: QcMonthlyAggregate[] = allMonths.map((mKey) => {
    const data = monthMap.get(mKey) || { passQty: 0, rejQty: 0, totalSubmissions: 0 };
    
    let target = getMonthlyTarget(mKey);
    let achieved = data.passQty;
    let dispatched = 0;

    // 1. Months before August 2025: apply exact manual baseline from Image 1
    if (MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[mKey]) {
      const manual = MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[mKey];
      target = manual.target;
      achieved = manual.achieved;
      dispatched = manual.dispatched;
    } else {
      // 2. Months from August 2025 onwards:
      // If historical manual dispatched is provided in Image 2, use it
      if (HISTORICAL_MONTHLY_DISPATCHED[mKey] !== undefined) {
        dispatched = HISTORICAL_MONTHLY_DISPATCHED[mKey];
      } else if (mKey >= '2026-07' && dispatchByMonthFromSheet.size > 0 && dispatchByMonthFromSheet.has(mKey)) {
        // From July 2026 onwards, live Dispatch Response Google sheet
        dispatched = dispatchByMonthFromSheet.get(mKey) || 0;
      } else {
        dispatched = dispatchedByMonth.get(mKey) || 0;
      }
    }

    const [yearStr, monStr] = mKey.split('-');
    const monIdx = parseInt(monStr, 10) - 1;
    const monthDisplay = `${MONTH_NAMES_SHORT[monIdx] || ''} ${yearStr}`;

    const achPct = target > 0 ? Math.round((achieved / target) * 100) : 0;
    const dispPct = achieved > 0 ? Math.round((dispatched / achieved) * 100) : 0;

    return {
      monthKey: mKey,
      monthDisplay,
      target,
      achieved,
      dispatched,
      achPct,
      dispPct,
      totalBatchSubmissions: data.totalSubmissions,
      passedUnits: achieved,
      rejectedUnits: data.rejQty,
    };
  });

  return result;
};

/**
 * Interface representing an individual OPF's QC Passed vs Dispatched status in a month
 */
export interface QcOpfReconciliationItem {
  opfNo: string;
  normalizedOpf: string;
  modelName: string;
  customerName: string;
  factoryNo: string;
  qcPassDate: string;
  qcTimestamp: string;
  qcInspector: string;
  qcRemarks: string;
  qcPassedQty: number;
  dispatchedQty: number;
  notDispatchedQty: number; // qcPassedQty - dispatchedQty (min 0)
  status: 'Not Dispatched' | 'Partially Dispatched' | 'Dispatched';
  dispatchDate?: string;
  productImageUrls: string[];
}

export interface QcMonthReconciliation {
  monthKey: string;
  totalQcPassedUnits: number;
  totalQcPassedOpfs: number;
  dispatchedUnits: number;
  dispatchedOpfs: number;
  notDispatchedUnits: number;
  notDispatchedOpfs: number;
  items: QcOpfReconciliationItem[];
}

/**
 * Calculates OPF-by-OPF QC Passed vs Dispatched reconciliation for the selected month.
 *
 * User requirement:
 * "if a Final qc is done for any order suppose based on OPF number in this month,
 *  check for that opf against is that dispatched, or not, that's how you have to calculate,
 *  if the order is ready this month, and is that dispatched or not in this month"
 */
export const calculateQcPassedDispatchedReconciliation = (
  monthKey: string,
  qcRecordsForMonth: FinalQcRecord[],
  dispatchRecords: DispatchRecord[],
  orders: Order[]
): QcMonthReconciliation => {
  const norm = (s: string) => (s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Group Final QC records for this month that passed QC
  interface OpfQcGroup {
    opfNo: string;
    normalizedOpf: string;
    qcPassedQty: number;
    factoryNo: string;
    qcInspector: string;
    qcRemarks: string;
    qcPassDate: string;
    qcTimestamp: string;
    productImageUrls: string[];
  }

  const qcOpfMap = new Map<string, OpfQcGroup>();

  qcRecordsForMonth.forEach((rec) => {
    if (rec.status !== 'Pass' && rec.passQuantity <= 0) return;
    const nOpf = norm(rec.opfNo);
    if (!nOpf) return;

    const qty = rec.passQuantity > 0 ? rec.passQuantity : (rec.totalQuantity > 0 ? rec.totalQuantity : 1);

    if (!qcOpfMap.has(nOpf)) {
      qcOpfMap.set(nOpf, {
        opfNo: rec.opfNo.trim(),
        normalizedOpf: nOpf,
        qcPassedQty: qty,
        factoryNo: rec.factoryNo || '',
        qcInspector: rec.qcInspector || '',
        qcRemarks: rec.passRemarks || '',
        qcPassDate: rec.dateYMD,
        qcTimestamp: rec.timestamp,
        productImageUrls: [...rec.productImageUrls],
      });
    } else {
      const existing = qcOpfMap.get(nOpf)!;
      existing.qcPassedQty += qty;
      if (rec.dateYMD > existing.qcPassDate) {
        existing.qcPassDate = rec.dateYMD;
        existing.qcTimestamp = rec.timestamp;
      }
      if (rec.passRemarks && !existing.qcRemarks) {
        existing.qcRemarks = rec.passRemarks;
      }
      rec.productImageUrls.forEach((url) => {
        if (!existing.productImageUrls.includes(url)) {
          existing.productImageUrls.push(url);
        }
      });
    }
  });

  // 2. Pre-index dispatches in this month by normalized OPF
  const dispInMonthByOpf = new Map<string, { qty: number; date?: string }>();
  dispatchRecords
    .filter((d) => d.monthKey === monthKey)
    .forEach((d) => {
      const nOpf = norm(d.opfNo || '');
      if (!nOpf) return;
      const current = dispInMonthByOpf.get(nOpf) || { qty: 0 };
      current.qty += d.quantity || 1;
      if (d.dateYMD && (!current.date || d.dateYMD > current.date)) {
        current.date = d.dateYMD;
      }
      dispInMonthByOpf.set(nOpf, current);
    });

  // 3. Pre-index PMS orders by normalized OPF
  const pmsOrdersByOpf = new Map<string, Order>();
  orders.forEach((o) => {
    const nOpf = norm(o.opfNo);
    if (nOpf && !pmsOrdersByOpf.has(nOpf)) {
      pmsOrdersByOpf.set(nOpf, o);
    }
  });

  // 4. Build reconciliation items
  const items: QcOpfReconciliationItem[] = [];
  let totalQcPassedUnits = 0;
  let dispatchedUnits = 0;
  let dispatchedOpfs = 0;
  let notDispatchedUnits = 0;
  let notDispatchedOpfs = 0;

  Array.from(qcOpfMap.values()).forEach((qcItem) => {
    const pmsOrder = pmsOrdersByOpf.get(qcItem.normalizedOpf);
    const dispSheet = dispInMonthByOpf.get(qcItem.normalizedOpf);

    const modelName = pmsOrder?.modelName || 'Standard Recliner';
    const customerName = pmsOrder?.upholstery || (pmsOrder?.currentResponsible ? `Responsible: ${pmsOrder.currentResponsible}` : 'Customer Order');

    // Check dispatch from Dispatch sheet first
    let dispatchedInThisMonthQty = dispSheet?.qty || 0;
    let dispatchDateStr = dispSheet?.date;

    // Also check PMS order dispatch
    if (pmsOrder && pmsOrder.overallStatus === 'Dispatched') {
      const pmsDispYMD = pmsOrder.dispatchDate ? pmsOrder.dispatchDate.slice(0, 10) : '';
      if (pmsDispYMD.startsWith(monthKey)) {
        dispatchedInThisMonthQty = Math.max(dispatchedInThisMonthQty, pmsOrder.quantity || 0);
        if (!dispatchDateStr && pmsOrder.dispatchDate) {
          dispatchDateStr = pmsOrder.dispatchDate;
        }
      }
    }

    const effectiveDispQty = Math.min(qcItem.qcPassedQty, dispatchedInThisMonthQty);
    const remainingInFactory = Math.max(0, qcItem.qcPassedQty - dispatchedInThisMonthQty);

    let status: 'Not Dispatched' | 'Partially Dispatched' | 'Dispatched' = 'Not Dispatched';
    if (remainingInFactory === 0) {
      status = 'Dispatched';
      dispatchedOpfs += 1;
    } else if (effectiveDispQty > 0) {
      status = 'Partially Dispatched';
      notDispatchedOpfs += 1;
    } else {
      status = 'Not Dispatched';
      notDispatchedOpfs += 1;
    }

    totalQcPassedUnits += qcItem.qcPassedQty;
    dispatchedUnits += effectiveDispQty;
    notDispatchedUnits += remainingInFactory;

    items.push({
      opfNo: qcItem.opfNo,
      normalizedOpf: qcItem.normalizedOpf,
      modelName,
      customerName,
      factoryNo: qcItem.factoryNo,
      qcPassDate: qcItem.qcPassDate,
      qcTimestamp: qcItem.qcTimestamp,
      qcInspector: qcItem.qcInspector,
      qcRemarks: qcItem.qcRemarks,
      qcPassedQty: qcItem.qcPassedQty,
      dispatchedQty: effectiveDispQty,
      notDispatchedQty: remainingInFactory,
      status,
      dispatchDate: dispatchDateStr,
      productImageUrls: qcItem.productImageUrls,
    });
  });

  // Sort: Not Dispatched first, then by QC pass date descending
  items.sort((a, b) => {
    if (a.status !== 'Dispatched' && b.status === 'Dispatched') return -1;
    if (a.status === 'Dispatched' && b.status !== 'Dispatched') return 1;
    return b.qcPassDate.localeCompare(a.qcPassDate);
  });

  return {
    monthKey,
    totalQcPassedUnits,
    totalQcPassedOpfs: qcOpfMap.size,
    dispatchedUnits,
    dispatchedOpfs,
    notDispatchedUnits,
    notDispatchedOpfs,
    items,
  };
};
