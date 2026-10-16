import { INITIAL_READY_STOCK_ITEMS } from './readyStockFallback';

export const READY_STOCK_SHEET_PUB_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQoKPTOSeAhLF9KbJTUO3pvSATMv7LRfeA1OdsY0GZcAtuMubWgGvqYS96h2UDOg3sVVk1BYhNXfqOS/pub?gid=1983939021&single=true&output=csv';

export interface ReadyStockItem {
  srNo: number;
  timestamp: string;
  email: string;
  code: string;
  model: string;
  functionality: string;
  upholsteryType: string;
  upholsteryCode: string;
  photos: string;
  driveId?: string;
  description: string;
  dimensions: string;
  qty: number;
}

export interface ReadyStockSummary {
  totalItems: number;
  totalUnits: number;
  totalModels: number;
  motorisedUnits: number;
  manualUnits: number;
  otherUnits: number;
  leatheretteUnits: number;
  fabricUnits: number;
  leatherUnits: number;
}

export interface ModelDistributionItem {
  model: string;
  count: number;
  units: number;
  percentage: number;
}

export interface UpholsteryDistributionItem {
  type: string;
  count: number;
  units: number;
  percentage: number;
}

let cachedReadyStock: ReadyStockItem[] = INITIAL_READY_STOCK_ITEMS;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export const getCachedReadyStock = (): ReadyStockItem[] => {
  return cachedReadyStock && cachedReadyStock.length > 0
    ? cachedReadyStock
    : INITIAL_READY_STOCK_ITEMS;
};

// Robust state machine CSV parser
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

export const fetchReadyStockData = async (force = false): Promise<ReadyStockItem[]> => {
  const now = Date.now();
  if (!force && cachedReadyStock && cachedReadyStock.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedReadyStock;
  }

  let csvText = '';
  try {
    const res = await fetch(READY_STOCK_SHEET_PUB_CSV_URL, { cache: 'no-store' });
    if (res.ok) {
      csvText = await res.text();
    }
  } catch (err) {
    console.error('Failed fetching Ready Stock sheet:', err);
  }

  if (!csvText || csvText.trim().length === 0) {
    return cachedReadyStock && cachedReadyStock.length > 0 ? cachedReadyStock : INITIAL_READY_STOCK_ITEMS;
  }

  const records = parseCSVFull(csvText);
  if (records.length < 3) {
    return cachedReadyStock && cachedReadyStock.length > 0 ? cachedReadyStock : INITIAL_READY_STOCK_ITEMS;
  }

  const parsedItems: ReadyStockItem[] = [];

  // Data rows start at index 2 (row 3 of sheet)
  for (let i = 2; i < records.length; i++) {
    const r = records[i];
    if (!r || r.length < 5) continue;
    const srNo = parseInt(r[0], 10);
    if (isNaN(srNo)) continue;
    const qty = parseInt(r[11] || '1', 10) || 1;

    let photoUrl = r[8] || '';
    let driveId = '';
    const match = photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || photoUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match) {
      driveId = match[1];
    }

    parsedItems.push({
      srNo,
      timestamp: r[1] || '',
      email: r[2] || '',
      code: r[3] || 'READY STOCK',
      model: r[4] || 'RECLINER',
      functionality: r[5] || 'MANUAL',
      upholsteryType: r[6] || 'PREMIUM FABRIC',
      upholsteryCode: r[7] || '',
      photos: photoUrl,
      driveId,
      description: r[9] || '',
      dimensions: r[10] || '',
      qty,
    });
  }

  if (parsedItems.length > 0) {
    cachedReadyStock = parsedItems;
    lastFetchTime = now;
  }

  return cachedReadyStock;
};

export const calculateReadyStockSummary = (items: ReadyStockItem[]): ReadyStockSummary => {
  const totalItems = items.length;
  let totalUnits = 0;
  let motorisedUnits = 0;
  let manualUnits = 0;
  let otherUnits = 0;
  let leatheretteUnits = 0;
  let fabricUnits = 0;
  let leatherUnits = 0;

  const modelSet = new Set<string>();

  items.forEach((item) => {
    totalUnits += item.qty;
    if (item.model) modelSet.add(item.model.trim().toUpperCase());

    const func = (item.functionality || '').toUpperCase();
    if (func.includes('MOTORISED') || func.includes('MOTORIZED')) {
      motorisedUnits += item.qty;
    } else if (func.includes('MANUAL')) {
      manualUnits += item.qty;
    } else {
      otherUnits += item.qty;
    }

    const uph = (item.upholsteryType || '').toUpperCase();
    if (uph.includes('LEATHERETTE')) {
      leatheretteUnits += item.qty;
    } else if (uph.includes('FABRIC')) {
      fabricUnits += item.qty;
    } else if (uph.includes('LEATHER')) {
      leatherUnits += item.qty;
    } else {
      fabricUnits += item.qty;
    }
  });

  return {
    totalItems,
    totalUnits,
    totalModels: modelSet.size,
    motorisedUnits,
    manualUnits,
    otherUnits,
    leatheretteUnits,
    fabricUnits,
    leatherUnits,
  };
};

export const calculateModelDistribution = (items: ReadyStockItem[]): ModelDistributionItem[] => {
  const map = new Map<string, { count: number; units: number }>();
  let totalUnits = 0;

  items.forEach((item) => {
    const m = (item.model || 'OTHER').trim().toUpperCase();
    const curr = map.get(m) || { count: 0, units: 0 };
    curr.count += 1;
    curr.units += item.qty;
    totalUnits += item.qty;
    map.set(m, curr);
  });

  const list: ModelDistributionItem[] = [];
  map.forEach((val, model) => {
    list.push({
      model,
      count: val.count,
      units: val.units,
      percentage: totalUnits > 0 ? Number(((val.units / totalUnits) * 100).toFixed(1)) : 0,
    });
  });

  return list.sort((a, b) => b.units - a.units);
};

export const calculateUpholsteryDistribution = (items: ReadyStockItem[]): UpholsteryDistributionItem[] => {
  const map = new Map<string, { count: number; units: number }>();
  let totalUnits = 0;

  items.forEach((item) => {
    const uph = (item.upholsteryType || 'OTHER').trim().toUpperCase();
    const curr = map.get(uph) || { count: 0, units: 0 };
    curr.count += 1;
    curr.units += item.qty;
    totalUnits += item.qty;
    map.set(uph, curr);
  });

  const list: UpholsteryDistributionItem[] = [];
  map.forEach((val, type) => {
    list.push({
      type,
      count: val.count,
      units: val.units,
      percentage: totalUnits > 0 ? Number(((val.units / totalUnits) * 100).toFixed(1)) : 0,
    });
  });

  return list.sort((a, b) => b.units - a.units);
};
