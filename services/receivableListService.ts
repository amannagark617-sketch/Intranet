import { INITIAL_RECEIVABLE_LIST_ITEMS } from './receivableListFallback';

export const RECEIVABLE_LIST_SHEET_PUB_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQCVVSb6acERYz-36IoFuMZZBqfsjNhJ2xLvoPyeBI75sL2-ZK-4U6xsMS1jL_EqRhz49zFi5lJPzVZ/pub?gid=0&single=true&output=csv';

export interface ReceivableItem {
  id: string;
  sNo: number;
  customerName: string;
  opfNo: string;
  salesPerson: string;
  invoiceDate: string;
  invoiceNo: string;
  invoiceAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  dueDate: string;
  creSales: string;
  remarks: string;
  group: string;
  planning?: string;
  actual?: string;
  creRemarks?: string;
  status?: string;
  contactDetails?: string;
  formLink?: string;
  newDueDate?: string;
}

export interface ReceivableSummary {
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalReceivedAmount: number;
  pctReceived: number;
  totalBalanceAmount: number;
  pctBalance: number;
}

export interface GroupSummaryItem {
  group: string;
  invoiceAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  pctBalanceAmount: number;
  count: number;
}

export interface SalespersonSummaryItem {
  salesPerson: string;
  invoiceAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  count: number;
}

let cachedReceivables: ReceivableItem[] = INITIAL_RECEIVABLE_LIST_ITEMS;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export const getCachedReceivables = (): ReceivableItem[] => {
  return cachedReceivables && cachedReceivables.length > 0
    ? cachedReceivables
    : INITIAL_RECEIVABLE_LIST_ITEMS;
};

const cleanNum = (val: string | undefined): number => {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// Robust CSV parser supporting multiline quoted cells
const parseCSVFull = (text: string): string[][] => {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      records.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    records.push(row);
  }
  return records;
};

export const fetchReceivableListData = async (force = false): Promise<ReceivableItem[]> => {
  const now = Date.now();
  if (!force && cachedReceivables && cachedReceivables.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedReceivables;
  }

  let csvText = '';
  try {
    const res = await fetch(RECEIVABLE_LIST_SHEET_PUB_CSV_URL, { cache: 'no-store' });
    if (res.ok) {
      csvText = await res.text();
    }
  } catch (err) {
    console.error('Failed fetching Receivable List sheet:', err);
  }

  if (!csvText || csvText.trim().length === 0) {
    return cachedReceivables && cachedReceivables.length > 0 ? cachedReceivables : INITIAL_RECEIVABLE_LIST_ITEMS;
  }

  const records = parseCSVFull(csvText);
  if (records.length < 6) {
    return cachedReceivables && cachedReceivables.length > 0 ? cachedReceivables : INITIAL_RECEIVABLE_LIST_ITEMS;
  }

  const parsedItems: ReceivableItem[] = [];

  // Data rows start at row index 5 (0-indexed)
  for (let i = 5; i < records.length; i++) {
    const cols = records[i];
    if (!cols || cols.length < 4 || !cols[1]) continue;

    const sNoRaw = parseInt(cols[1].trim(), 10);
    if (isNaN(sNoRaw) || sNoRaw <= 0) continue;

    const item: ReceivableItem = {
      id: cols[0] || `REC-${sNoRaw}`,
      sNo: sNoRaw,
      customerName: cols[2] || '',
      opfNo: cols[3] || '',
      salesPerson: cols[4] || '',
      invoiceDate: cols[5] || '',
      invoiceNo: cols[6] || '',
      invoiceAmount: cleanNum(cols[7]),
      receivedAmount: cleanNum(cols[8]),
      balanceAmount: cleanNum(cols[9]),
      dueDate: cols[10] || '',
      creSales: cols[11] || '',
      remarks: cols[12] || '',
      group: cols[13] || 'Others',
      planning: cols[14] || '',
      actual: cols[15] || '',
      creRemarks: cols[16] || '',
      status: cols[17] || 'Pending',
      contactDetails: cols[18] || '',
      formLink: cols[19] || '',
      newDueDate: cols[20] || '',
    };

    parsedItems.push(item);
  }

  if (parsedItems.length > 0) {
    cachedReceivables = parsedItems;
    lastFetchTime = now;
  }

  return cachedReceivables;
};

export const calculateReceivableSummary = (items: ReceivableItem[]): ReceivableSummary => {
  const totalInvoices = items.length;
  let totalInvoiceAmount = 0;
  let totalReceivedAmount = 0;
  let totalBalanceAmount = 0;

  items.forEach((item) => {
    totalInvoiceAmount += item.invoiceAmount;
    totalReceivedAmount += item.receivedAmount;
    totalBalanceAmount += item.balanceAmount;
  });

  const pctReceived = totalInvoiceAmount > 0 ? Math.round((totalReceivedAmount / totalInvoiceAmount) * 100) : 0;
  const pctBalance = totalInvoiceAmount > 0 ? Math.round((totalBalanceAmount / totalInvoiceAmount) * 100) : 0;

  return {
    totalInvoices,
    totalInvoiceAmount,
    totalReceivedAmount,
    pctReceived,
    totalBalanceAmount,
    pctBalance,
  };
};

export const calculateGroupSummaries = (items: ReceivableItem[]): GroupSummaryItem[] => {
  const map = new Map<string, { inv: number; rec: number; bal: number; count: number }>();

  let totalBalAll = 0;
  items.forEach((item) => {
    const grp = item.group || 'Others';
    const curr = map.get(grp) || { inv: 0, rec: 0, bal: 0, count: 0 };
    curr.inv += item.invoiceAmount;
    curr.rec += item.receivedAmount;
    curr.bal += item.balanceAmount;
    curr.count += 1;
    totalBalAll += item.balanceAmount;
    map.set(grp, curr);
  });

  const list: GroupSummaryItem[] = [];
  map.forEach((val, grp) => {
    const pct = totalBalAll > 0 ? Number(((val.bal / totalBalAll) * 100).toFixed(2)) : 0;
    list.push({
      group: grp,
      invoiceAmount: val.inv,
      receivedAmount: val.rec,
      balanceAmount: val.bal,
      pctBalanceAmount: pct,
      count: val.count,
    });
  });

  // Sort by Balance Amount descending
  return list.sort((a, b) => b.balanceAmount - a.balanceAmount);
};

export const calculateSalespersonSummaries = (items: ReceivableItem[]): SalespersonSummaryItem[] => {
  const map = new Map<string, { inv: number; rec: number; bal: number; count: number }>();

  items.forEach((item) => {
    const sp = item.salesPerson || 'Unassigned';
    const curr = map.get(sp) || { inv: 0, rec: 0, bal: 0, count: 0 };
    curr.inv += item.invoiceAmount;
    curr.rec += item.receivedAmount;
    curr.bal += item.balanceAmount;
    curr.count += 1;
    map.set(sp, curr);
  });

  const list: SalespersonSummaryItem[] = [];
  map.forEach((val, sp) => {
    list.push({
      salesPerson: sp,
      invoiceAmount: val.inv,
      receivedAmount: val.rec,
      balanceAmount: val.bal,
      count: val.count,
    });
  });

  return list.sort((a, b) => b.balanceAmount - a.balanceAmount);
};

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(val));
};

export const formatINRInLakhsOrCrores = (val: number): string => {
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${formatCurrency(val)}`;
};
