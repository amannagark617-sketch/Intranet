/**
 * Real-Time Gross Profit Service
 * Handles data fetching, parsing, and analytics for Gross Profit analysis
 */

export const REAL_TIME_GP_PORTAL_URL = 'https://realtimegp.vercel.app/';
export const REAL_TIME_GP_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTXGExKn9sGSYLxHgnEHx0uTNH9JvzRG-L8rpNvSqQuKOv_wXtczhCfKRfYRGtWz-5sTtXWkbKGHpcq/pub?gid=0&single=true&output=csv';

export interface GrossProfitRecord {
  id: string;
  orderMonth: string;
  quarterly: string;
  date: string;
  serialNo: string;
  clientName: string;
  orderFormUrl: string;
  segmentType: string; // Retail / Project / Online
  brandSegment: string; // Little Nap
  locationShowroom: string;
  isDealer: string;
  state: string;
  salesPerson: string;
  model: string;
  totalQty: number;
  reclinerQty: number;
  massageChairQty: number;
  accessoriesQty: number;
  othersQty: number;
  grossSales: number;
  commission: number;
  tax: number;
  freight: number;
  netSales: number;
  rmCost: number;
  grossProfitAmt: number;
  grossProfitPct: number;
  shipmentStatus: string;
}

export interface GrossProfitAnalytics {
  totalOrders: number;
  totalUnits: number;
  totalGrossSales: number;
  totalNetSales: number;
  totalRmCost: number;
  totalGrossProfitAmt: number;
  avgGrossProfitPct: number;
  segmentBreakdown: { [key: string]: { units: number; netSales: number; gpAmt: number; gpPct: number } };
  topSalesPersons: { name: string; units: number; netSales: number; gpAmt: number; gpPct: number }[];
}

let cachedGrossProfitData: GrossProfitRecord[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/%/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result;
}

export async function fetchGrossProfitData(forceRefresh = false): Promise<GrossProfitRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedGrossProfitData.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedGrossProfitData;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(REAL_TIME_GP_SHEET_CSV_URL, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`Failed to fetch Gross Profit data: ${res.status} ${res.statusText}`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      return cachedGrossProfitData;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    
    // Find index helpers
    const getIdx = (candidates: string[]) => {
      return headers.findIndex(h => candidates.some(c => h.includes(c.toLowerCase())));
    };

    const orderMonthIdx = getIdx(['order month']);
    const quarterlyIdx = getIdx(['quarterly']);
    const dateIdx = getIdx(['date']);
    const serialNoIdx = getIdx(['serial no', 'serial']);
    const clientNameIdx = getIdx(['client name', 'client']);
    const orderFormIdx = getIdx(['order form']);
    const segmentTypeIdx = getIdx(['retail/project/online', 'retail/project']);
    const segmentIdx = getIdx(['segment']);
    const locationIdx = getIdx(['location/showroom', 'location', 'showroom']);
    const isDealerIdx = getIdx(['dealer (yes/no)', 'dealer']);
    const stateIdx = getIdx(['state']);
    const salesPersonIdx = getIdx(['sales person', 'salesperson']);
    const modelIdx = getIdx(['model']);
    const totalQtyIdx = getIdx(['total qty', 'qty']);
    const reclinerIdx = getIdx(['recliner']);
    const massageIdx = getIdx(['massage chair']);
    const assessoriesIdx = getIdx(['massage assessories', 'assessories', 'accessories']);
    const othersQtyIdx = getIdx(['others']);
    const grossSalesIdx = getIdx(['gross sales']);
    const commissionIdx = getIdx(['commission']);
    const taxIdx = getIdx(['tax']);
    const freightIdx = getIdx(['freight']);
    const netSalesIdx = getIdx(['net sales']);
    const rmCostIdx = getIdx(['rm cost']);
    const gpAmtIdx = getIdx(['gross profit(₹)', 'gross profit (₹)', 'gross profit amt', 'gross profit']);
    const gpPctIdx = getIdx(['gross profit(in %)', 'gross profit (in %)', 'gross profit%']);
    const shipmentStatusIdx = getIdx(['shipment status', 'status']);

    const records: GrossProfitRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const serialNo = serialNoIdx >= 0 && cols[serialNoIdx] ? cols[serialNoIdx].trim() : '';
      const clientName = clientNameIdx >= 0 && cols[clientNameIdx] ? cols[clientNameIdx].trim() : '';
      
      if (!serialNo && !clientName) continue;

      const netSales = netSalesIdx >= 0 ? parseNumeric(cols[netSalesIdx]) : 0;
      const rmCost = rmCostIdx >= 0 ? parseNumeric(cols[rmCostIdx]) : 0;
      let gpAmt = gpAmtIdx >= 0 ? parseNumeric(cols[gpAmtIdx]) : (netSales - rmCost);
      let gpPct = gpPctIdx >= 0 ? parseNumeric(cols[gpPctIdx]) : (netSales > 0 ? (gpAmt / netSales) * 100 : 0);

      records.push({
        id: `gp-${i}-${serialNo || Math.random()}`,
        orderMonth: orderMonthIdx >= 0 ? (cols[orderMonthIdx] || '').trim() : '',
        quarterly: quarterlyIdx >= 0 ? (cols[quarterlyIdx] || '').trim() : '',
        date: dateIdx >= 0 ? (cols[dateIdx] || '').trim() : '',
        serialNo,
        clientName,
        orderFormUrl: orderFormIdx >= 0 ? (cols[orderFormIdx] || '').trim() : '',
        segmentType: segmentTypeIdx >= 0 ? (cols[segmentTypeIdx] || '').trim() : 'Retail',
        brandSegment: segmentIdx >= 0 ? (cols[segmentIdx] || '').trim() : 'Little Nap',
        locationShowroom: locationIdx >= 0 ? (cols[locationIdx] || '').trim() : '',
        isDealer: isDealerIdx >= 0 ? (cols[isDealerIdx] || '').trim() : 'No',
        state: stateIdx >= 0 ? (cols[stateIdx] || '').trim() : '',
        salesPerson: salesPersonIdx >= 0 ? (cols[salesPersonIdx] || '').trim() : '',
        model: modelIdx >= 0 ? (cols[modelIdx] || '').trim() : '',
        totalQty: totalQtyIdx >= 0 ? parseNumeric(cols[totalQtyIdx]) || 1 : 1,
        reclinerQty: reclinerIdx >= 0 ? parseNumeric(cols[reclinerIdx]) : 0,
        massageChairQty: massageIdx >= 0 ? parseNumeric(cols[massageIdx]) : 0,
        accessoriesQty: assessoriesIdx >= 0 ? parseNumeric(cols[assessoriesIdx]) : 0,
        othersQty: othersQtyIdx >= 0 ? parseNumeric(cols[othersQtyIdx]) : 0,
        grossSales: grossSalesIdx >= 0 ? parseNumeric(cols[grossSalesIdx]) : 0,
        commission: commissionIdx >= 0 ? parseNumeric(cols[commissionIdx]) : 0,
        tax: taxIdx >= 0 ? parseNumeric(cols[taxIdx]) : 0,
        freight: freightIdx >= 0 ? parseNumeric(cols[freightIdx]) : 0,
        netSales,
        rmCost,
        grossProfitAmt: gpAmt,
        grossProfitPct: gpPct,
        shipmentStatus: shipmentStatusIdx >= 0 ? (cols[shipmentStatusIdx] || '').trim() : ''
      });
    }

    cachedGrossProfitData = records;
    lastFetchTime = now;
    return records;
  } catch (err) {
    console.error('Error fetching Gross Profit data:', err);
    return cachedGrossProfitData;
  }
}

export function getCachedGrossProfit(): GrossProfitRecord[] {
  return cachedGrossProfitData;
}
