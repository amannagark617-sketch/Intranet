/**
 * CEO sales summary: sales vs target for the current month and financial year,
 * with a showroom/region breakdown.
 *
 * Reads the same Google Sheet as the embedded Sales Admin panel:
 *   - "Data" tab    (gid 991175139)  one row per sale / visit report
 *   - "Target" tab  (gid 1850303239) salesperson, month, target
 * The panel's "ID Password" tab is deliberately never read here.
 *
 * Achievement is measured as Gross Sales / Target, exactly like the admin panel.
 */
import { fetchSalesReportData, parseCSVToRows } from './salesReportService';

const SHEET_ID = '1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU';
const exportUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
const DATA_GID = '991175139';
const TARGET_GID = '1850303239';

export interface CeoSalesRow {
  monthKey: string; // YYYY-MM
  dateYMD: string;
  salesperson: string;
  region: string;
  units: number;
  gross: number;
}

export interface CeoTargetRow {
  salesperson: string;
  monthKey: string; // YYYY-MM
  target: number;
  region: string; // attributed showroom (see attributeTargetRegions)
}

export interface CeoSalesPeriod {
  label: string;
  sales: number;
  target: number | null;
  orders: number;
  units: number;
}

export interface CeoRegionRow {
  name: string;
  sales: number;
  target: number;
}

export interface CeoSalesSummary {
  month: CeoSalesPeriod;
  fy: CeoSalesPeriod;
  regions: CeoRegionRow[];
  hasTargets: boolean;
  latestSaleYMD: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

const num = (v: string | undefined): number => {
  if (!v) return 0;
  const n = Number(v.replace(/["',₹\s]/g, ''));
  return isNaN(n) ? 0 : n;
};

/** Accepts ISO, "22-Sep-2026 17:44:14", and day-first "22/09/2026". */
export const toYMD = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
};

/** Target-sheet month cells come as DD/MM/YYYY, MM-YYYY, YYYY-MM, "Sep-2026", etc. */
const toMonthKey = (raw: string): string | null => {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[2]}-${pad(+m[1])}`;
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}`;
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`;
  const ymd = toYMD(s);
  return ymd ? ymd.slice(0, 7) : null;
};

const fetchCsv = async (url: string): Promise<string[][]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSVToRows(await res.text());
};

const fetchSalesRows = async (): Promise<CeoSalesRow[]> => {
  const rows = await fetchCsv(exportUrl(DATA_GID));
  const out: CeoSalesRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dateYMD = toYMD(r[0]);
    const gross = num(r[26]);
    if (!dateYMD || gross <= 0) continue; // visit-only reports carry no sale
    out.push({
      monthKey: dateYMD.slice(0, 7),
      dateYMD,
      salesperson: (r[1] || '').trim(),
      // Column AK is the showroom/region the admin panel groups by
      region: (r[36] || '').trim() || (r[3] || '').trim() || 'Unassigned',
      units: num(r[25]) || 1,
      gross,
    });
  }
  return out;
};

/** Fallback if the sheet's export link is not reachable: reuse the published CSV the Sales tab already reads. */
const fetchSalesRowsFallback = async (): Promise<CeoSalesRow[]> => {
  const recs = await fetchSalesReportData(false);
  const out: CeoSalesRow[] = [];
  recs.forEach(r => {
    const dateYMD = toYMD(r.date);
    if (!dateYMD || !(r.grossSales > 0)) return;
    out.push({
      monthKey: dateYMD.slice(0, 7),
      dateYMD,
      salesperson: r.salespersonName,
      region: r.showroom || r.region || 'Unassigned',
      units: r.quantity || 1,
      gross: r.grossSales,
    });
  });
  return out;
};

const fetchTargets = async (): Promise<Omit<CeoTargetRow, 'region'>[]> => {
  const rows = await fetchCsv(exportUrl(TARGET_GID));
  const out: Omit<CeoTargetRow, 'region'>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const salesperson = (r[0] || '').trim();
    const monthKey = toMonthKey(r[1] || '');
    const target = num(r[2]);
    if (!salesperson || !monthKey || target <= 0) continue;
    out.push({ salesperson, monthKey, target });
  }
  return out;
};

/**
 * A target belongs to the showroom where that salesperson actually sold that month,
 * otherwise their most recent earlier showroom (same rule as the admin panel).
 */
export const attributeTargetRegions = (
  targets: Omit<CeoTargetRow, 'region'>[],
  sales: CeoSalesRow[]
): CeoTargetRow[] => {
  const byPersonMonth = new Map<string, Map<string, number>>();
  const history = new Map<string, Array<{ ymd: string; region: string }>>();
  sales.forEach(s => {
    const p = s.salesperson.toLowerCase();
    const k = `${p}|${s.monthKey}`;
    if (!byPersonMonth.has(k)) byPersonMonth.set(k, new Map());
    const m = byPersonMonth.get(k)!;
    m.set(s.region, (m.get(s.region) || 0) + 1);
    if (!history.has(p)) history.set(p, []);
    history.get(p)!.push({ ymd: s.dateYMD, region: s.region });
  });
  history.forEach(list => list.sort((a, b) => a.ymd.localeCompare(b.ymd)));

  return targets.map(t => {
    const p = t.salesperson.toLowerCase();
    let region = '';
    const counts = byPersonMonth.get(`${p}|${t.monthKey}`);
    if (counts) {
      let best = 0;
      counts.forEach((c, r) => { if (c > best) { best = c; region = r; } });
    }
    if (!region) {
      const past = (history.get(p) || []).filter(h => h.ymd.slice(0, 7) <= t.monthKey);
      if (past.length) region = past[past.length - 1].region;
    }
    return { ...t, region: region || 'Unassigned' };
  });
};

/** Financial year runs April to March. */
const fyOf = (monthKey: string): { start: string; label: string } => {
  const y = +monthKey.slice(0, 4);
  const mo = +monthKey.slice(5, 7);
  const startYear = mo >= 4 ? y : y - 1;
  return {
    start: `${startYear}-04`,
    label: `FY ${startYear}-${String(startYear + 1).slice(2)}`,
  };
};

export const computeCeoSales = (
  sales: CeoSalesRow[],
  targets: CeoTargetRow[],
  todayYMD: string
): CeoSalesSummary => {
  const monthKey = todayYMD.slice(0, 7);
  const fy = fyOf(monthKey);
  const hasTargets = targets.length > 0;

  const inMonth = sales.filter(s => s.monthKey === monthKey);
  const inFy = sales.filter(s => s.monthKey >= fy.start && s.monthKey <= monthKey);
  const sum = (list: CeoSalesRow[]) => list.reduce((a, s) => a + s.gross, 0);
  const units = (list: CeoSalesRow[]) => list.reduce((a, s) => a + s.units, 0);

  const monthTargets = targets.filter(t => t.monthKey === monthKey);
  const fyTargets = targets.filter(t => t.monthKey >= fy.start && t.monthKey <= monthKey);
  const tsum = (list: CeoTargetRow[]) => list.reduce((a, t) => a + t.target, 0);

  const regionMap = new Map<string, CeoRegionRow>();
  const ensure = (name: string) => {
    if (!regionMap.has(name)) regionMap.set(name, { name, sales: 0, target: 0 });
    return regionMap.get(name)!;
  };
  inMonth.forEach(s => { ensure(s.region).sales += s.gross; });
  monthTargets.forEach(t => { ensure(t.region).target += t.target; });
  const regions = Array.from(regionMap.values())
    .filter(r => r.sales > 0 || r.target > 0)
    .sort((a, b) => b.sales - a.sales || b.target - a.target);

  const latest = sales.reduce<string | null>((a, s) => (!a || s.dateYMD > a ? s.dateYMD : a), null);

  return {
    month: {
      label: `${MONTH_LABELS[+monthKey.slice(5, 7) - 1]} ${monthKey.slice(0, 4)}`,
      sales: sum(inMonth),
      target: hasTargets ? tsum(monthTargets) : null,
      orders: inMonth.length,
      units: units(inMonth),
    },
    fy: {
      label: fy.label,
      sales: sum(inFy),
      target: hasTargets ? tsum(fyTargets) : null,
      orders: inFy.length,
      units: units(inFy),
    },
    regions,
    hasTargets,
    latestSaleYMD: latest,
  };
};

let cache: { at: number; rows: CeoSalesRow[]; targets: CeoTargetRow[] } | null = null;
const TTL_MS = 60_000;

export const fetchCeoSales = async (todayYMD: string, force = false): Promise<CeoSalesSummary> => {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return computeCeoSales(cache.rows, cache.targets, todayYMD);
  }

  let rows: CeoSalesRow[] = [];
  try {
    rows = await fetchSalesRows();
  } catch {
    try {
      rows = await fetchSalesRowsFallback();
    } catch {
      rows = [];
    }
  }

  let targets: CeoTargetRow[] = [];
  try {
    targets = attributeTargetRegions(await fetchTargets(), rows);
  } catch {
    targets = []; // sales still show; target comparison is hidden
  }

  cache = { at: Date.now(), rows, targets };
  return computeCeoSales(rows, targets, todayYMD);
};
