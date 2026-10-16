export const READY_GOODS_SHEET_PUB_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5BLvJ43V0mGuTuVMlZCRAiGGPBdiKagCsKrTPtBSisW5Ksyr6nptWEokiYTYJ3Le02_ySm84PYCif/pub?gid=223115185&single=true&output=csv';

export interface ReadyGoodItem {
  id: string;
  opfNo: string; // Col X (23): *PMS OPF No.*
  orderQty: number; // Col Y (24): Order Qty.
  readyGoodsQty: number; // Col Z (25): Ready Goods Qty.
  creName: string; // Col AA (26): CRE Name
  salesPerson: string; // Col AB (27): *Sales Person*
  customerName: string; // Col AC (28): *Customer Name*
  companyName: string; // Col AD (29): Company Name
  location: string; // Col AE (30): Location
  grossAmount: number; // Col AF (31): Gross
  amountReceived: number; // Col AG (32): Amount Received
  bank: number; // Col AH (33): Bank
  receivable: number; // Col AI (34): Receivable
  warehouseCharges: number; // Col AJ (35): Warehouse Charges
  totalReceived: number; // Col AK (36): Total Received
  balancePayment: number; // Col AL (37): Balance Payment
  readyGoodsDate: string; // Col AM (38): Ready Goods Date
  pctBalancePayment: string; // Col AN (39): % Balance Payment
  daysInFactory: number; // Col AO (40): Days in Factory
  category: string; // Col AQ (42): Category
  dateRange: string; // Col AR (43): 2nd Category for Dashboard (e.g. '61 to 180 Days', 'More than 180 days')
  modelOfRecliners: string; // Col AX (49): Model Of Recliners
  creNextFollowUpDate: string; // Col AY (50): CRE Next Follow-Up Date
  creCallingRemarks: string; // Col AZ (51): CRE Calling Remarks
  noOfFollowUps: number; // Col BA (52): No. of Follow-Ups
  formLink: string; // Col BB (53): Form Link
}

export interface ReadyGoodsSummary {
  totalOrders: number;
  totalReadyGoodsQty: number;
  grossAmount: number;
  totalReceived: number;
  totalBalance: number;
  totalWarehouseCharges: number;
  pctReceived: number;
  pctBalance: number;
}

export interface DateRangeCategorySummary {
  dateRange: string;
  totalOrders: number;
  readyGoodsQty: number;
  grossAmount: number;
  warehouseCharges: number;
  totalReceived: number;
  balancePayment: number;
  pctBalancePayment: number;
}

import { INITIAL_READY_GOODS_ITEMS } from './readyGoodsFallback';

let cachedReadyGoods: ReadyGoodItem[] = INITIAL_READY_GOODS_ITEMS;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export const getCachedReadyGoods = (): ReadyGoodItem[] => {
  return cachedReadyGoods && cachedReadyGoods.length > 0 ? cachedReadyGoods : INITIAL_READY_GOODS_ITEMS;
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

const cleanNum = (val: string | undefined): number => {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/₹/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

/**
 * Formats a raw date like "10/02/26" or "26/07/24" into "Jul 26, 2024" if possible
 */
export const formatDisplayDate = (raw: string): string => {
  if (!raw) return '-';
  const clean = raw.trim();
  // Check if DD/MM/YY or DD/MM/YYYY
  const m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (mon >= 1 && mon <= 12) {
      return `${months[mon - 1]} ${day}, ${yr}`;
    }
  }
  return clean;
};

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

export const fetchReadyGoodsData = async (force = false): Promise<ReadyGoodItem[]> => {
  const now = Date.now();
  if (!force && cachedReadyGoods && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedReadyGoods;
  }

  let csvText = '';
  try {
    const res = await fetch(READY_GOODS_SHEET_PUB_CSV_URL, { cache: 'no-store' });
    if (res.ok) {
      csvText = await res.text();
    }
  } catch (err) {
    console.error('Failed fetching Ready Goods sheet:', err);
  }

  if (!csvText || csvText.trim().length === 0) {
    return cachedReadyGoods && cachedReadyGoods.length > 0 ? cachedReadyGoods : INITIAL_READY_GOODS_ITEMS;
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 4) {
    return cachedReadyGoods && cachedReadyGoods.length > 0 ? cachedReadyGoods : INITIAL_READY_GOODS_ITEMS;
  }

  // Rows 0-2 are summary & headers; data rows start at index 3
  const items: ReadyGoodItem[] = [];
  const dataLines = lines.slice(3);

  dataLines.forEach((line, idx) => {
    if (!line || !line.trim()) return;
    const cols = robustCsvSplit(line);
    // Col X is index 23
    if (cols.length <= 23) return;

    const rawOpf = cols[23]?.trim();
    if (!rawOpf || rawOpf.startsWith('*') || rawOpf.toLowerCase() === 'opf no.' || rawOpf.toLowerCase() === 'total opf') {
      return;
    }

    const opfNo = rawOpf;
    const orderQty = Math.round(cleanNum(cols[24]));
    const readyGoodsQty = Math.round(cleanNum(cols[25]));
    const creName = cols[26]?.trim() || '';
    const salesPerson = cols[27]?.trim() || '';
    const customerName = cols[28]?.trim() || '';
    const companyName = cols[29]?.trim() || '';
    const location = cols[30]?.trim() || '';
    const grossAmount = cleanNum(cols[31]);
    const amountReceived = cleanNum(cols[32]);
    const bank = cleanNum(cols[33]);
    const receivable = cleanNum(cols[34]);
    const warehouseCharges = cleanNum(cols[35]);
    const totalReceived = cleanNum(cols[36]);
    const balancePayment = cleanNum(cols[37]);
    const readyGoodsDate = cols[38]?.trim() || '';
    const pctBalancePayment = cols[39]?.trim() || '';
    const daysInFactory = Math.round(cleanNum(cols[40]));
    const category = cols[42]?.trim() || '';
    const dateRange = cols[43]?.trim() || 'Other';
    const modelOfRecliners = cols[49]?.trim() || '';
    const creNextFollowUpDate = cols[50]?.trim() || '';
    const creCallingRemarks = cols[51]?.trim() || '';
    const noOfFollowUps = Math.round(cleanNum(cols[52]));
    const formLink = cols[53]?.trim() || '';

    items.push({
      id: `rg-${opfNo}-${idx}`,
      opfNo,
      orderQty,
      readyGoodsQty,
      creName,
      salesPerson,
      customerName,
      companyName,
      location,
      grossAmount,
      amountReceived,
      bank,
      receivable,
      warehouseCharges,
      totalReceived,
      balancePayment,
      readyGoodsDate,
      pctBalancePayment,
      daysInFactory,
      category,
      dateRange,
      modelOfRecliners,
      creNextFollowUpDate,
      creCallingRemarks,
      noOfFollowUps,
      formLink,
    });
  });

  cachedReadyGoods = items;
  lastFetchTime = Date.now();
  return items;
};

export const calculateReadyGoodsSummary = (items: ReadyGoodItem[]): ReadyGoodsSummary => {
  const totalOrders = items.length;
  const totalReadyGoodsQty = items.reduce((sum, item) => sum + item.readyGoodsQty, 0);
  const grossAmount = items.reduce((sum, item) => sum + item.grossAmount, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.totalReceived, 0);
  const totalBalance = items.reduce((sum, item) => sum + item.balancePayment, 0);
  const totalWarehouseCharges = items.reduce((sum, item) => sum + item.warehouseCharges, 0);

  const pctReceived = grossAmount > 0 ? Math.round((totalReceived / grossAmount) * 100) : 0;
  const pctBalance = grossAmount > 0 ? Math.round((totalBalance / grossAmount) * 100) : 0;

  return {
    totalOrders,
    totalReadyGoodsQty,
    grossAmount,
    totalReceived,
    totalBalance,
    totalWarehouseCharges,
    pctReceived,
    pctBalance,
  };
};

export const calculateDateRangeBreakdown = (items: ReadyGoodItem[]): DateRangeCategorySummary[] => {
  const groups = new Map<string, {
    orders: number;
    qty: number;
    gross: number;
    wh: number;
    rec: number;
    bal: number;
  }>();

  // Desired ordering
  const standardRanges = [
    '61 to 180 Days',
    'More than 180 days',
    'Up to 15 Days',
    '31 to 60 Days',
    '16 to 30 Days',
  ];

  standardRanges.forEach(r => {
    groups.set(r, { orders: 0, qty: 0, gross: 0, wh: 0, rec: 0, bal: 0 });
  });

  items.forEach(item => {
    const range = item.dateRange || 'Other';
    if (!groups.has(range)) {
      groups.set(range, { orders: 0, qty: 0, gross: 0, wh: 0, rec: 0, bal: 0 });
    }
    const g = groups.get(range)!;
    g.orders += 1;
    g.qty += item.readyGoodsQty;
    g.gross += item.grossAmount;
    g.wh += item.warehouseCharges;
    g.rec += item.totalReceived;
    g.bal += item.balancePayment;
  });

  const totalBalAll = items.reduce((sum, i) => sum + i.balancePayment, 0);

  const result: DateRangeCategorySummary[] = [];
  groups.forEach((val, key) => {
    if (val.orders > 0) {
      const pctBal = totalBalAll > 0 ? Math.round((val.bal / totalBalAll) * 100) : 0;
      result.push({
        dateRange: key,
        totalOrders: val.orders,
        readyGoodsQty: val.qty,
        grossAmount: val.gross,
        warehouseCharges: val.wh,
        totalReceived: val.rec,
        balancePayment: val.bal,
        pctBalancePayment: pctBal,
      });
    }
  });

  // Sort according to standard order
  result.sort((a, b) => {
    const idxA = standardRanges.indexOf(a.dateRange);
    const idxB = standardRanges.indexOf(b.dateRange);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.dateRange.localeCompare(b.dateRange);
  });

  return result;
};
