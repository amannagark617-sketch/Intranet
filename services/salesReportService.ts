/**
 * Sales Report Service
 * Connects to the published Google Sheet CSV and the embedded Cloud Run portal
 */

export const SALES_REPORT_PORTAL_URL = 'https://admin-team-performance-attendance-1033493166417.us-west1.run.app/';
export const SALES_REPORT_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR81fzbKkdsYyIffps9Aj_bUmPyD9OVWiMe7mC1QSIxKTkXFvIQcUweuAttiJnKC1chaym-P1cTcPvJ/pub?gid=991175139&single=true&output=csv';

export interface SalesReportRecord {
  id: string;
  date: string;
  salespersonName: string;
  opfNumber: string;
  region: string;
  visitType: string;
  segment: string;
  subSegment: string;
  leadSource: string;
  clientName: string;
  companyName: string;
  mobileNumber: string;
  emailId: string;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  city: string;
  state: string;
  brandName: string;
  model: string;
  functionality: string;
  category: string;
  crrNbd: string;
  typeOfBusiness: string;
  quantity: number;
  grossSales: number;
  commission: number;
  tax: number;
  freightCharges: number;
  netSales: number;
  advanceAmount: number;
  remarks: string;
  showroom: string;
  rawRow: Record<string, string>;
}

export interface SalesAnalytics {
  totalOrders: number;
  totalUnits: number;
  totalGrossSales: number;
  totalNetSales: number;
  totalAdvanceAmount: number;
  salesByPerson: Record<string, { count: number; units: number; netSales: number }>;
  salesByRegion: Record<string, { count: number; units: number; netSales: number }>;
  salesByBrand: Record<string, { count: number; units: number; netSales: number }>;
  salesBySegment: Record<string, { count: number; units: number; netSales: number }>;
}

const CACHE_KEY = 'ln_sales_report_cache_v1';
let memoryCache: SalesReportRecord[] = [];

/**
 * Robust CSV Line Parser handling quotes, commas, and newlines
 */
export function parseCSVToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumeric(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/[₹$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Fetch and parse Sales Report Records from Published Google Sheet CSV
 */
export async function fetchSalesReportData(isManualRefresh = false): Promise<SalesReportRecord[]> {
  if (!isManualRefresh && memoryCache.length > 0) {
    return memoryCache;
  }

  try {
    const timestamp = Date.now();
    const fetchUrl = `${SALES_REPORT_SHEET_CSV_URL}&_cb=${timestamp}`;
    const response = await fetch(fetchUrl, {
      cache: isManualRefresh ? 'reload' : 'default',
      headers: {
        'Accept': 'text/csv,text/plain,*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCSVToRows(csvText);

    if (rows.length < 2) {
      return memoryCache.length > 0 ? memoryCache : [];
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());

    const findIndex = (searchTerms: string[]): number => {
      return headers.findIndex(h => searchTerms.some(term => h.includes(term.toLowerCase())));
    };

    const dateIdx = findIndex(['date']);
    const spIdx = findIndex(['salesperson name', 'salesperson', 'sales person']);
    const opfIdx = findIndex(['opf number', 'opf no', 'opf']);
    const regionIdx = findIndex(['region']);
    const visitTypeIdx = findIndex(['visit type']);
    const segmentIdx = findIndex(['segment']);
    const subSegIdx = findIndex(['sub-segment', 'subsegment']);
    const leadSrcIdx = findIndex(['lead source', 'source']);
    const clientIdx = findIndex(['client name', 'customer name']);
    const compIdx = findIndex(['company name']);
    const mobIdx = findIndex(['mobile number', 'contact number', 'phone']);
    const emailIdx = findIndex(['email id', 'email']);
    const dealerNameIdx = findIndex(['dealer name']);
    const dealerCityIdx = findIndex(['dealer city']);
    const dealerStateIdx = findIndex(['dealer state']);
    const cityIdx = findIndex(['city']);
    const stateIdx = findIndex(['state']);
    const brandIdx = findIndex(['brand name', 'brand']);
    const modelIdx = findIndex(['model']);
    const funcIdx = findIndex(['functionality']);
    const catIdx = findIndex(['category']);
    const crrIdx = findIndex(['crr/nbd', 'crr']);
    const bizTypeIdx = findIndex(['type of business', 'business']);
    const qtyIdx = findIndex(['quantity', 'qty']);
    const grossIdx = findIndex(['gross sales', 'gross']);
    const commIdx = findIndex(['commission']);
    const taxIdx = findIndex(['tax', 'gst']);
    const freightIdx = findIndex(['freight charges', 'freight']);
    const netSalesIdx = findIndex(['net sales', 'net']);
    const advanceIdx = findIndex(['advance amount', 'advance']);
    const remarksIdx = findIndex(['remarks', 'comments']);
    const showroomIdx = findIndex(['showroom']);

    const salesRecords: SalesReportRecord[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const getVal = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

      const opf = getVal(opfIdx);
      const sp = getVal(spIdx);
      const client = getVal(clientIdx);
      const gross = parseNumeric(getVal(grossIdx));
      const net = parseNumeric(getVal(netSalesIdx));

      // Skip empty header / total rows
      if (!opf && !sp && !client && gross === 0 && net === 0) continue;

      const rawRow: Record<string, string> = {};
      headers.forEach((h, i) => {
        rawRow[h] = row[i] || '';
      });

      salesRecords.push({
        id: `SALE-${r}-${opf || Math.random().toString(36).substring(2, 7)}`,
        date: getVal(dateIdx),
        salespersonName: sp,
        opfNumber: opf,
        region: getVal(regionIdx) || 'Unassigned',
        visitType: getVal(visitTypeIdx),
        segment: getVal(segmentIdx),
        subSegment: getVal(subSegIdx),
        leadSource: getVal(leadSrcIdx),
        clientName: client,
        companyName: getVal(compIdx),
        mobileNumber: getVal(mobIdx),
        emailId: getVal(emailIdx),
        dealerName: getVal(dealerNameIdx),
        dealerCity: getVal(dealerCityIdx),
        dealerState: getVal(dealerStateIdx),
        city: getVal(cityIdx),
        state: getVal(stateIdx),
        brandName: getVal(brandIdx) || 'Little Nap',
        model: getVal(modelIdx),
        functionality: getVal(funcIdx),
        category: getVal(catIdx),
        crrNbd: getVal(crrIdx),
        typeOfBusiness: getVal(bizTypeIdx),
        quantity: parseNumeric(getVal(qtyIdx)) || 1,
        grossSales: gross,
        commission: parseNumeric(getVal(commIdx)),
        tax: parseNumeric(getVal(taxIdx)),
        freightCharges: parseNumeric(getVal(freightIdx)),
        netSales: net || gross,
        advanceAmount: parseNumeric(getVal(advanceIdx)),
        remarks: getVal(remarksIdx),
        showroom: getVal(showroomIdx),
        rawRow,
      });
    }

    memoryCache = salesRecords;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(salesRecords));
    } catch {
      // ignore localStorage quota
    }

    return salesRecords;
  } catch (error) {
    console.warn('Failed to fetch live sales report CSV, falling back to cache:', error);
    if (memoryCache.length > 0) return memoryCache;

    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        memoryCache = JSON.parse(saved);
        return memoryCache;
      }
    } catch {
      // ignore
    }
    return [];
  }
}

export function getCachedSalesReport(): SalesReportRecord[] {
  if (memoryCache.length > 0) return memoryCache;
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      memoryCache = JSON.parse(saved);
      return memoryCache;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Helper to compute high level metrics for AI Agent & Dashboards
 */
export function computeSalesAnalytics(records: SalesReportRecord[]): SalesAnalytics {
  const analytics: SalesAnalytics = {
    totalOrders: records.length,
    totalUnits: 0,
    totalGrossSales: 0,
    totalNetSales: 0,
    totalAdvanceAmount: 0,
    salesByPerson: {},
    salesByRegion: {},
    salesByBrand: {},
    salesBySegment: {},
  };

  for (const item of records) {
    const units = item.quantity || 1;
    analytics.totalUnits += units;
    analytics.totalGrossSales += item.grossSales || 0;
    analytics.totalNetSales += item.netSales || 0;
    analytics.totalAdvanceAmount += item.advanceAmount || 0;

    // By Salesperson
    const sp = item.salespersonName || 'Unassigned';
    if (!analytics.salesByPerson[sp]) {
      analytics.salesByPerson[sp] = { count: 0, units: 0, netSales: 0 };
    }
    analytics.salesByPerson[sp].count++;
    analytics.salesByPerson[sp].units += units;
    analytics.salesByPerson[sp].netSales += item.netSales || 0;

    // By Region
    const reg = item.region || 'Unassigned';
    if (!analytics.salesByRegion[reg]) {
      analytics.salesByRegion[reg] = { count: 0, units: 0, netSales: 0 };
    }
    analytics.salesByRegion[reg].count++;
    analytics.salesByRegion[reg].units += units;
    analytics.salesByRegion[reg].netSales += item.netSales || 0;

    // By Brand
    const brand = item.brandName || 'Little Nap';
    if (!analytics.salesByBrand[brand]) {
      analytics.salesByBrand[brand] = { count: 0, units: 0, netSales: 0 };
    }
    analytics.salesByBrand[brand].count++;
    analytics.salesByBrand[brand].units += units;
    analytics.salesByBrand[brand].netSales += item.netSales || 0;

    // By Segment
    const seg = item.segment || 'General';
    if (!analytics.salesBySegment[seg]) {
      analytics.salesBySegment[seg] = { count: 0, units: 0, netSales: 0 };
    }
    analytics.salesBySegment[seg].count++;
    analytics.salesBySegment[seg].units += units;
    analytics.salesBySegment[seg].netSales += item.netSales || 0;
  }

  return analytics;
}
