/**
 * Executive Hub Service (Master Directory & Resource Command Center)
 * Connects to the published Google Sheet CSV for Little Nap's Master Resource Directory
 */

export const EXECUTIVE_HUB_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQenkMP9m_42Ri1aud84duMRy_F7ho2e-Ax44Zb9ymFYmBpN8zDDX9m7xjyngotZ2natoKFuA6UYn_/pub?gid=1614456532&single=true&output=csv';

export type ResourceCategory = 
  | 'Leadership & MIS'
  | 'Finance & Costing'
  | 'Factory & Operations'
  | 'Sales, CRM & Growth'
  | 'Legal, IPO & Corporate'
  | 'Media, HR & Admin';

export type ResourceType = 
  | 'Google Sheet'
  | 'Google Drive'
  | 'Web App / Portal'
  | 'Looker Studio'
  | 'Google Script'
  | 'External Link';

export interface ExecutiveResource {
  id: string;
  sNo: number;
  title: string;
  description: string;
  link: string;
  category: ResourceCategory;
  resourceType: ResourceType;
  isPinned?: boolean;
  tags: string[];
}

export interface ExecutiveHubAnalytics {
  totalResources: number;
  totalSheets: number;
  totalDriveFolders: number;
  totalWebApps: number;
  totalLookerReports: number;
  categoryCounts: Record<ResourceCategory, number>;
}

const CACHE_KEY = 'ln_executive_hub_cache_v1';
const PINNED_STORAGE_KEY = 'ln_executive_hub_pinned_ids';
let memoryCache: ExecutiveResource[] = [];

/**
 * Determine Resource Type based on URL structure
 */
export function detectResourceType(url: string): ResourceType {
  const u = (url || '').toLowerCase();
  if (u.includes('docs.google.com/spreadsheets')) return 'Google Sheet';
  if (u.includes('drive.google.com')) return 'Google Drive';
  if (u.includes('lookerstudio.google.com')) return 'Looker Studio';
  if (u.includes('script.google.com')) return 'Google Script';
  if (u.includes('.run.app') || u.includes('vercel.app') || u.includes('sites.google.com')) return 'Web App / Portal';
  return 'External Link';
}

/**
 * Smart automatic categorisation based on title & description
 */
export function categorizeResource(title: string, desc: string): ResourceCategory {
  const combined = `${title} ${desc}`.toLowerCase();

  // Leadership & MIS
  if (
    combined.includes('mis') || 
    combined.includes('kra') || 
    combined.includes('delegation') || 
    combined.includes('mom') || 
    combined.includes('meeting')
  ) {
    return 'Leadership & MIS';
  }

  // Finance & Costing
  if (
    combined.includes('financial') || 
    combined.includes('fss') || 
    combined.includes('gross profit') || 
    combined.includes('costing') || 
    combined.includes('accounts') || 
    combined.includes('receivable') || 
    combined.includes('gp')
  ) {
    return 'Finance & Costing';
  }

  // Factory & Operations
  if (
    combined.includes('pms') || 
    combined.includes('manesar') || 
    combined.includes('indore') || 
    combined.includes('production') || 
    combined.includes('inventory') || 
    combined.includes('ims') || 
    combined.includes('over time') || 
    combined.includes('overtime') || 
    combined.includes('dispatch')
  ) {
    return 'Factory & Operations';
  }

  // Sales, CRM & Growth
  if (
    combined.includes('sale') || 
    combined.includes('nbd') || 
    combined.includes('crr') || 
    combined.includes('lead') || 
    combined.includes('client') || 
    combined.includes('customer') || 
    combined.includes('partner') || 
    combined.includes('pipeline') || 
    combined.includes('linktree')
  ) {
    return 'Sales, CRM & Growth';
  }

  // Legal, IPO & Corporate
  if (
    combined.includes('ipo') || 
    combined.includes('agreement') || 
    combined.includes('contract') || 
    combined.includes('legal') || 
    combined.includes('password') || 
    combined.includes('personal') || 
    combined.includes('document')
  ) {
    return 'Legal, IPO & Corporate';
  }

  // Media, HR & Admin
  return 'Media, HR & Admin';
}

/**
 * Parse CSV rows robustly
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
 * Get stored pinned IDs from localStorage
 */
export function getPinnedResourceIds(): string[] {
  try {
    const saved = localStorage.getItem(PINNED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Toggle pin status of a resource
 */
export function togglePinResource(id: string): string[] {
  const current = getPinnedResourceIds();
  let updated: string[];
  if (current.includes(id)) {
    updated = current.filter(item => item !== id);
  } else {
    updated = [...current, id];
  }
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

/**
 * Fetch and parse Executive Hub Resources from Published Google Sheet CSV
 */
export async function fetchExecutiveHubData(isManualRefresh = false): Promise<ExecutiveResource[]> {
  if (!isManualRefresh && memoryCache.length > 0) {
    return memoryCache;
  }

  try {
    const timestamp = Date.now();
    const fetchUrl = `${EXECUTIVE_HUB_SHEET_CSV_URL}&_cb=${timestamp}`;
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

    const sNoIdx = findIndex(['s.no', 'sno', 'sr no', 's. no.']);
    const titleIdx = findIndex(['sheet name', 'name', 'title', 'dashboard']);
    const descIdx = findIndex(['description', 'desc', 'details']);
    const linkIdx = findIndex(['sheet link', 'link', 'url']);

    const pinnedIds = getPinnedResourceIds();
    const resources: ExecutiveResource[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const getVal = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

      const title = getVal(titleIdx !== -1 ? titleIdx : 1);
      const desc = getVal(descIdx !== -1 ? descIdx : 2);
      const link = getVal(linkIdx !== -1 ? linkIdx : 3);
      const sNoRaw = getVal(sNoIdx !== -1 ? sNoIdx : 0);

      // Skip invalid or empty rows
      if (!title && !link) continue;

      const sNo = parseInt(sNoRaw, 10) || r;
      const resourceId = `RES-${sNo}-${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15)}`;
      const resourceType = detectResourceType(link);
      const category = categorizeResource(title, desc);

      const tags: string[] = [];
      if (title.toLowerCase().includes('manesar')) tags.push('Manesar');
      if (title.toLowerCase().includes('indore')) tags.push('Indore');
      if (title.toLowerCase().includes('rg')) tags.push('Executive');
      if (title.toLowerCase().includes('ipo')) tags.push('IPO');
      if (link.includes('lookerstudio')) tags.push('Analytics');
      if (link.includes('drive.google')) tags.push('Docs');

      resources.push({
        id: resourceId,
        sNo,
        title: title || `Resource #${sNo}`,
        description: desc || 'Direct company resource link and documentation.',
        link: link,
        category,
        resourceType,
        isPinned: pinnedIds.includes(resourceId),
        tags,
      });
    }

    memoryCache = resources;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(resources));
    } catch {
      // ignore
    }

    return resources;
  } catch (error) {
    console.warn('Failed to fetch live Executive Hub CSV, falling back to cache:', error);
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

export function getCachedExecutiveHub(): ExecutiveResource[] {
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
 * Analytics calculator
 */
export function computeExecutiveHubAnalytics(resources: ExecutiveResource[]): ExecutiveHubAnalytics {
  const analytics: ExecutiveHubAnalytics = {
    totalResources: resources.length,
    totalSheets: 0,
    totalDriveFolders: 0,
    totalWebApps: 0,
    totalLookerReports: 0,
    categoryCounts: {
      'Leadership & MIS': 0,
      'Finance & Costing': 0,
      'Factory & Operations': 0,
      'Sales, CRM & Growth': 0,
      'Legal, IPO & Corporate': 0,
      'Media, HR & Admin': 0,
    },
  };

  for (const r of resources) {
    if (r.resourceType === 'Google Sheet') analytics.totalSheets++;
    else if (r.resourceType === 'Google Drive') analytics.totalDriveFolders++;
    else if (r.resourceType === 'Web App / Portal') analytics.totalWebApps++;
    else if (r.resourceType === 'Looker Studio') analytics.totalLookerReports++;

    if (analytics.categoryCounts[r.category] !== undefined) {
      analytics.categoryCounts[r.category]++;
    }
  }

  return analytics;
}
