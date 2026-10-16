/**
 * Indore plant numbers, read from the Indore Google Sheet's "Dashboard" tab:
 * one row of headers with the value (a formula in the sheet) directly below it.
 *
 * Google's CSV output contains each cell's *calculated* value, so formulas need no
 * special handling here. We read the tab by name (not gid) so it does not matter
 * which tab the shared link points at. The sheet must be shared as
 * "Anyone with the link can view".
 *
 * Values are shown exactly as the sheet formats them (no recalculation).
 */
import { parseCSVToRows } from './salesReportService';

const SHEET_ID = '1iNNSLttWfjaCwLvHlZOjVt0OsSG2GNMS1hW1pCg3Nw4';
const DASHBOARD_TAB = 'Dashboard';
const DASHBOARD_GID = '1737193671'; // fallback if reading by tab name fails

export interface IndoreMetric {
  label: string;
  value: string;
}

const ERROR_CELL = /^#(N\/A|DIV\/0!|REF!|VALUE!|NAME\?|NUM!|NULL!|ERROR!)/i;

/** Keep only the "label -> value" pairs that actually hold a usable value. */
export const parseIndoreDashboard = (rows: string[][]): IndoreMetric[] => {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const values = rows[1];
  const out: IndoreMetric[] = [];
  headers.forEach((h, i) => {
    const label = (h || '').trim();
    const raw = (values[i] || '').trim();
    if (!label) return;
    out.push({ label, value: !raw || ERROR_CELL.test(raw) ? '—' : raw });
  });
  return out;
};

/**
 * Pick the handful of metrics a CEO needs, in a sensible order:
 * today's production, month/total produced, target, achievement.
 * Falls back to the first few columns if nothing matches.
 */
export const pickHeadlineMetrics = (all: IndoreMetric[], max = 4): IndoreMetric[] => {
  const rules: RegExp[] = [
    /today/i,
    /(month|mtd|till|to date|total|produc|achiev|actual|qc)/i,
    /target/i,
    /(%|percent|achiev)/i,
  ];
  const picked: IndoreMetric[] = [];
  const used = new Set<number>();
  rules.forEach(rule => {
    const idx = all.findIndex((m, i) => !used.has(i) && rule.test(m.label));
    if (idx >= 0) { used.add(idx); picked.push(all[idx]); }
  });
  all.forEach((m, i) => {
    if (picked.length < max && !used.has(i) && m.value !== '—') { used.add(i); picked.push(m); }
  });
  return picked.slice(0, max);
};

const tryFetch = async (url: string): Promise<IndoreMetric[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (/^\s*<!doctype html|<html/i.test(text)) throw new Error('Sheet is not shared for viewing');
  return parseIndoreDashboard(parseCSVToRows(text));
};

export interface IndoreResult {
  metrics: IndoreMetric[];
  status: 'ok' | 'unavailable';
}

export const fetchIndoreMetrics = async (): Promise<IndoreResult> => {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
  const attempts = [
    `${base}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(DASHBOARD_TAB)}`,
    `${base}/export?format=csv&gid=${DASHBOARD_GID}`,
  ];
  for (const url of attempts) {
    try {
      const metrics = await tryFetch(url);
      if (metrics.length > 0) return { metrics, status: 'ok' };
    } catch {
      // try the next URL
    }
  }
  return { metrics: [], status: 'unavailable' };
};
