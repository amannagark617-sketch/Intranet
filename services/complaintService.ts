/**
 * Service Complaint Tracker Service
 * Connects to the published Google Sheet CSV and the embedded Cloud Run portal
 */

export const SERVICE_COMPLAINTS_PORTAL_URL = 'https://little-nap-service-open-complaint-tracker-1033493166417.us-west1.run.app/';
export const SERVICE_COMPLAINTS_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQk1QeqPmVHjdNOvTLso5dTHLI_OMj9ntDdXRKVW5gDs9UcOp43_XN7DGkYjIhwRWfpwTa14hNM3vJO/pub?output=csv';

export interface ServiceComplaint {
  id: string;
  timestamp: string;
  complainReceiptUrl: string;
  opfNo: string;
  clientName: string;
  contactNumber: string;
  address: string;
  productDescription: string;
  zone: string;
  problems: string;
  state: string;
  city: string;
  source: string;
  status: string;
  brandName: string;
  callStatus: string;
  serviceRequired: string;
  invoiceReceived: string;
  comments: string;
  underWarranty: string;
  technicianVisitRequired: string;
  solution: string;
  creName: string;
  ratings: string;
  daysOpen?: number;
  rawRow: Record<string, string>;
}

export interface ComplaintAnalytics {
  totalComplaints: number;
  openComplaints: number;
  closedComplaints: number;
  underWarrantyCount: number;
  outOfWarrantyCount: number;
  technicianVisitsRequired: number;
  zoneBreakdown: Record<string, number>;
  brandBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}

const CACHE_KEY = 'ln_service_complaints_cache_v1';
let memoryCache: ServiceComplaint[] = [];

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

/**
 * Fetch and parse Service Complaint Records from Published Google Sheet CSV
 */
export async function fetchServiceComplaints(isManualRefresh = false): Promise<ServiceComplaint[]> {
  if (!isManualRefresh && memoryCache.length > 0) {
    return memoryCache;
  }

  try {
    const timestamp = Date.now();
    const fetchUrl = `${SERVICE_COMPLAINTS_SHEET_CSV_URL}&_cb=${timestamp}`;
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

    const tsIdx = findIndex(['timestamp']);
    const receiptIdx = findIndex(['receipt']);
    const opfIdx = findIndex(['opf no', 'opf']);
    const clientIdx = findIndex(['client name', 'customer name']);
    const contactIdx = findIndex(['contact number', 'phone', 'mobile']);
    const addressIdx = findIndex(['address']);
    const productIdx = findIndex(['product description', 'model', 'product']);
    const zoneIdx = findIndex(['zone']);
    const problemsIdx = findIndex(['problems', 'problem', 'issue']);
    const stateIdx = findIndex(['state']);
    const cityIdx = findIndex(['city']);
    const sourceIdx = findIndex(['source']);
    const statusIdx = findIndex(['status']);
    const brandIdx = findIndex(['brand_name', 'brand']);
    const callStatusIdx = findIndex(['call status']);
    const serviceReqIdx = findIndex(['service required']);
    const invRecIdx = findIndex(['invoice recieved', 'invoice']);
    const commentsIdx = findIndex(['comments', 'remarks']);
    const warrantyIdx = findIndex(['under warranty', 'warranty']);
    const techIdx = findIndex(['technician visit required']);
    const solutionIdx = findIndex(['solution']);
    const creIdx = findIndex(['cre name', 'filled by']);
    const ratingsIdx = findIndex(['ratings', 'rating']);

    const complaints: ServiceComplaint[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const getVal = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

      const opf = getVal(opfIdx);
      const client = getVal(clientIdx);
      const problems = getVal(problemsIdx);

      // Skip empty junk rows
      if (!opf && !client && !problems) continue;

      const rawRow: Record<string, string> = {};
      headers.forEach((h, i) => {
        rawRow[h] = row[i] || '';
      });

      const rawStatus = getVal(statusIdx) || 'Open';
      const status = rawStatus.toLowerCase().includes('close') ? 'Closed' : 'Open';

      complaints.push({
        id: `CMP-${r}-${opf || Math.random().toString(36).substring(2, 7)}`,
        timestamp: getVal(tsIdx),
        complainReceiptUrl: getVal(receiptIdx),
        opfNo: opf,
        clientName: client,
        contactNumber: getVal(contactIdx),
        address: getVal(addressIdx),
        productDescription: getVal(productIdx),
        zone: getVal(zoneIdx) || 'Unassigned',
        problems: problems,
        state: getVal(stateIdx),
        city: getVal(cityIdx),
        source: getVal(sourceIdx),
        status: status,
        brandName: getVal(brandIdx) || 'Little Nap',
        callStatus: getVal(callStatusIdx),
        serviceRequired: getVal(serviceReqIdx),
        invoiceReceived: getVal(invRecIdx),
        comments: getVal(commentsIdx),
        underWarranty: getVal(warrantyIdx),
        technicianVisitRequired: getVal(techIdx),
        solution: getVal(solutionIdx),
        creName: getVal(creIdx),
        ratings: getVal(ratingsIdx),
        rawRow,
      });
    }

    memoryCache = complaints;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(complaints));
    } catch {
      // ignore localStorage quotas
    }

    return complaints;
  } catch (error) {
    console.warn('Failed to fetch live service complaints CSV, falling back to cache:', error);
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

export function getCachedServiceComplaints(): ServiceComplaint[] {
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
export function computeComplaintAnalytics(complaints: ServiceComplaint[]): ComplaintAnalytics {
  const analytics: ComplaintAnalytics = {
    totalComplaints: complaints.length,
    openComplaints: 0,
    closedComplaints: 0,
    underWarrantyCount: 0,
    outOfWarrantyCount: 0,
    technicianVisitsRequired: 0,
    zoneBreakdown: {},
    brandBreakdown: {},
    statusBreakdown: {},
  };

  for (const c of complaints) {
    if (c.status.toLowerCase() === 'closed') {
      analytics.closedComplaints++;
    } else {
      analytics.openComplaints++;
    }

    const warrantyLower = c.underWarranty.toLowerCase();
    if (warrantyLower.includes('under') || warrantyLower === 'yes' || warrantyLower === 'valid') {
      analytics.underWarrantyCount++;
    } else if (warrantyLower.includes('out') || warrantyLower === 'no') {
      analytics.outOfWarrantyCount++;
    }

    if (c.technicianVisitRequired.toLowerCase().includes('yes') || c.technicianVisitRequired.toLowerCase().includes('true')) {
      analytics.technicianVisitsRequired++;
    }

    const zone = c.zone || 'Unassigned';
    analytics.zoneBreakdown[zone] = (analytics.zoneBreakdown[zone] || 0) + 1;

    const brand = c.brandName || 'Little Nap';
    analytics.brandBreakdown[brand] = (analytics.brandBreakdown[brand] || 0) + 1;

    const status = c.status || 'Open';
    analytics.statusBreakdown[status] = (analytics.statusBreakdown[status] || 0) + 1;
  }

  return analytics;
}
