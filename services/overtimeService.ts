import * as XLSX from 'xlsx';
import { PRODUCTION_STAGES } from '../constants';
import type { ProductionStepName } from '../types';

export const REAL_OVERTIME_SHEET_CSV_URL = 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVHlBGSNdXxHigJ5LaCcu-dRzF1QnmKMCPdZa3rzp2SsG5r5yxRMBqb2hikdzj3QaxP7Ann1EaIwo_/pub?gid=1124091853&single=true&output=csv';

export const OVERTIME_PORTAL_URL = 'https://employee-overtime-portal-1033493166417.us-west1.run.app/';

export interface RealOvertimeRecord {
  id: string;
  timestamp: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  pmsStage: ProductionStepName | string;
  pmsStepNumber: number | null;
  payroll: string;
  dateStr: string;
  dateYMD: string; // YYYY-MM-DD
  dateDisplay: string; // DD-MMM-YYYY
  monthKey: string; // YYYY-MM (e.g. 2026-04)
  monthLabel: string; // April 2026
  overtimeHours: number;
  foodingApplicable: boolean;
  enteredBy: string;
  remarks: string;
  reasonForOvertime: string;
  approvalForOt: string;
  basicSalary: number;
  hra: number;
  splAllowance: number;
  conveyance: number;
  lta: number;
  otherAllowance: number;
  bonus: number;
  totalSalary: number;
  hourlyRate: number;
  estimatedOtCost: number;
  detectedReferences: string[];
}

export interface OvertimeAnalyticsSummary {
  totalHours: number;
  totalCost: number;
  totalRecords: number;
  uniqueEmployees: number;
  foodingCount: number;
  monthlyBreakdown: {
    monthKey: string;
    monthLabel: string;
    hours: number;
    cost: number;
    workerCount: number;
    recordsCount: number;
  }[];
  stageBreakdown: {
    stageName: string;
    stepNumber: number | null;
    hours: number;
    cost: number;
    workerCount: number;
    recordsCount: number;
    topRemarks: string[];
  }[];
  departmentBreakdown: {
    department: string;
    hours: number;
    cost: number;
    workerCount: number;
    sharePct: number;
  }[];
  payrollBreakdown: {
    payroll: string;
    hours: number;
    cost: number;
    workerCount: number;
  }[];
  topWorkers: {
    employeeCode: string;
    employeeName: string;
    department: string;
    designation: string;
    payroll: string;
    hours: number;
    cost: number;
    recordsCount: number;
  }[];
}

// Map real department names from the sheet to Little Nap's 14 PMS Stages
export function mapDepartmentToPmsStage(dept: string): { stage: string; stepNumber: number | null } {
  const d = (dept || '').trim().toLowerCase();

  if (d.includes('carpent')) return { stage: 'CARPENTRY', stepNumber: 1 };
  if (d.includes('polish') || d.includes('cladding')) return { stage: 'WOODEN POLISHING & CLADDING', stepNumber: 2 };
  if (d.includes('cutt')) return { stage: 'CUTTING OF UPHOLSTERY', stepNumber: 3 };
  if (d.includes('stitch')) return { stage: 'STITCHING OF UPHOLSTERY', stepNumber: 4 };
  if (d.includes('foam')) return { stage: 'FOAMING & LINING', stepNumber: 5 };
  if (d.includes('upholst')) return { stage: 'UPHOLSTERY', stepNumber: 6 };
  if (d.includes('fitting') || d.includes('fitter')) return { stage: 'FITTING', stepNumber: 8 };
  if (d.includes('quality') || d.includes('qc')) return { stage: 'QUALITY CONTROL', stepNumber: 9 };
  if (d.includes('pack')) return { stage: 'PACKING', stepNumber: 11 };
  if (d.includes('dispatch') || d.includes('logistic')) return { stage: 'DISPATCH', stepNumber: 14 };
  if (d.includes('inventory')) return { stage: 'RAW MATERIALS & INVENTORY', stepNumber: null };
  if (d.includes('r & d') || d.includes('r&d') || d.includes('innovation')) return { stage: 'R&D & PROTOTYPING', stepNumber: null };
  if (d.includes('admin') || d.includes('hr') || d.includes('security') || d.includes('mdo') || d.includes('pentry')) {
    return { stage: 'OPERATIONS & ADMIN SUPPORT', stepNumber: null };
  }

  return { stage: dept || 'OTHER OPERATIONS', stepNumber: null };
}

// Excel date number or formatted string parser
export function parseExcelDate(val: any): { ymd: string; display: string; monthKey: string; monthLabel: string } {
  if (!val) {
    return { ymd: '2026-04-01', display: '01-Apr-2026', monthKey: '2026-04', monthLabel: 'April 2026' };
  }

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Numeric excel serial date
  if (typeof val === 'number' || (!isNaN(val) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const display = `${String(day).padStart(2, '0')}-${MONTH_SHORT[month]}-${year}`;
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_NAMES[month]} ${year}`;
      return { ymd, display, monthKey, monthLabel };
    }
  }

  const str = String(val).trim();

  // Try parsing DD-MMM-YYYY (e.g. 01-Apr-2026)
  const ddmmyyyy = str.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const mStr = ddmmyyyy[2].toLowerCase();
    const mIdx = MONTH_SHORT.findIndex(m => m.toLowerCase() === mStr);
    let year = parseInt(ddmmyyyy[3], 10);
    if (year < 100) year += 2000;
    if (mIdx !== -1) {
      const ymd = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const display = `${String(day).padStart(2, '0')}-${MONTH_SHORT[mIdx]}-${year}`;
      const monthKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_NAMES[mIdx]} ${year}`;
      return { ymd, display, monthKey, monthLabel };
    }
  }

  // Try parsing MM/DD/YY or MM/DD/YYYY
  const mmddyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (mmddyy) {
    const m = parseInt(mmddyy[1], 10) - 1;
    const day = parseInt(mmddyy[2], 10);
    let year = parseInt(mmddyy[3], 10);
    if (year < 100) year += 2000;
    if (m >= 0 && m < 12) {
      const ymd = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const display = `${String(day).padStart(2, '0')}-${MONTH_SHORT[m]}-${year}`;
      const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = `${MONTH_NAMES[m]} ${year}`;
      return { ymd, display, monthKey, monthLabel };
    }
  }

  // Default fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${String(day).padStart(2, '0')}-${MONTH_SHORT[month]}-${year}`;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES[month]} ${year}`;
    return { ymd, display, monthKey, monthLabel };
  }

  return { ymd: '2026-04-01', display: str || '01-Apr-2026', monthKey: '2026-04', monthLabel: 'April 2026' };
}

// In-memory cached records
let cachedRecords: RealOvertimeRecord[] | null = null;
let lastFetchTimestamp: number = 0;

export async function fetchRealOvertimeRecords(forceRefresh = false): Promise<RealOvertimeRecord[]> {
  // If cache is fresh (< 5 mins) and not force refreshing, return memory cache
  if (!forceRefresh && cachedRecords && cachedRecords.length > 0 && (Date.now() - lastFetchTimestamp < 300000)) {
    return cachedRecords;
  }

  try {
    const response = await fetch(REAL_OVERTIME_SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch live Overtime sheet: HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const workbook = XLSX.read(csvText, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

    const parsedRecords: RealOvertimeRecord[] = rawRows.map((row, index) => {
      const empCode = String(row['Employee Code'] || '').trim();
      const empName = String(row['Employee Name'] || 'Worker').trim();
      const designation = String(row['Designation'] || 'Specialist').trim();
      const department = String(row['Department'] || 'General Operations').trim();
      const payroll = String(row['Payroll'] || 'Little Nap').trim();
      const dateInfo = parseExcelDate(row['Date'] || row['Timestamp']);

      const hours = parseFloat(row['Overtime Hours']) || 0;
      const fooding = String(row['Fooding Applicable']).trim() === '1' || String(row['Fooding Applicable']).toLowerCase() === 'yes';
      const enteredBy = String(row['Entered By'] || 'Floor Manager').trim();
      const remarks = String(row['Remarks'] || '').trim();
      const reasonForOvertime = String(row['Reason for Overtime'] || '').trim();
      const approvalForOt = String(row['Approval for OT'] || '').trim();

      const basic = parseFloat(row['Basic']) || 0;
      const hra = parseFloat(row['HRA']) || 0;
      const splAllowance = parseFloat(row['Spl Allowance']) || 0;
      const conveyance = parseFloat(row['Conveyance']) || 0;
      const lta = parseFloat(row['LTA']) || 0;
      const otherAllowance = parseFloat(row['Other Allowance']) || 0;
      const bonus = parseFloat(row['Bonus']) || 0;
      const totalSalary = parseFloat(row['Total Salary']) || (basic + hra + splAllowance + conveyance + lta + otherAllowance + bonus);

      // Hourly rate based on monthly salary (26 working days * 8h = 208 working hours per month)
      const hourlyRate = totalSalary > 0 ? Math.round((totalSalary / 208) * 10) / 10 : 90;
      const estimatedOtCost = Math.round(hours * hourlyRate);

      const stageInfo = mapDepartmentToPmsStage(department);

      // Extract referenced OPFs, projects, models from remarks/reason
      const combinedText = `${reasonForOvertime} ${remarks}`;
      const opfMatches = combinedText.match(/(?:OPF|LND|SA|BLR|VT|AR|MB|FOC|AK|SER|MA)[-\s0-9A-Z]+/gi) || [];
      const detectedReferences = Array.from(new Set(opfMatches.map(m => m.trim()))).slice(0, 5);

      return {
        id: `OT-${dateInfo.ymd}-${index + 1}-${empCode}`,
        timestamp: String(row['Timestamp'] || ''),
        employeeCode: empCode,
        employeeName: empName,
        designation: designation,
        department: department,
        pmsStage: stageInfo.stage,
        pmsStepNumber: stageInfo.stepNumber,
        payroll: payroll,
        dateStr: String(row['Date'] || ''),
        dateYMD: dateInfo.ymd,
        dateDisplay: dateInfo.display,
        monthKey: dateInfo.monthKey,
        monthLabel: dateInfo.monthLabel,
        overtimeHours: hours,
        foodingApplicable: fooding,
        enteredBy: enteredBy,
        remarks: remarks,
        reasonForOvertime: reasonForOvertime,
        approvalForOt: approvalForOt,
        basicSalary: basic,
        hra: hra,
        splAllowance: splAllowance,
        conveyance: conveyance,
        lta: lta,
        otherAllowance: otherAllowance,
        bonus: bonus,
        totalSalary: totalSalary,
        hourlyRate: hourlyRate,
        estimatedOtCost: estimatedOtCost,
        detectedReferences: detectedReferences,
      };
    });

    cachedRecords = parsedRecords;
    lastFetchTimestamp = Date.now();
    return parsedRecords;
  } catch (err) {
    console.error('Error fetching live Overtime published Google Sheet', err);
    if (cachedRecords && cachedRecords.length > 0) {
      return cachedRecords;
    }
    throw err;
  }
}

// Get in-memory cached records synchronously
export function getCachedOvertimeData(): RealOvertimeRecord[] {
  return cachedRecords || [];
}

// Alias for fetchRealOvertimeRecords
export const fetchRealOvertimeData = fetchRealOvertimeRecords;

// Compute comprehensive aggregation analytics
export function computeOvertimeAnalytics(records: RealOvertimeRecord[]): OvertimeAnalyticsSummary {
  const totalRecords = records.length;
  let totalHours = 0;
  let totalCost = 0;
  let foodingCount = 0;
  const workerSet = new Set<string>();

  const monthMap: Record<string, { monthKey: string; monthLabel: string; hours: number; cost: number; workers: Set<string>; count: number }> = {};
  const stageMap: Record<string, { stageName: string; stepNumber: number | null; hours: number; cost: number; workers: Set<string>; count: number; remarks: Set<string> }> = {};
  const deptMap: Record<string, { department: string; hours: number; cost: number; workers: Set<string> }> = {};
  const payrollMap: Record<string, { payroll: string; hours: number; cost: number; workers: Set<string> }> = {};
  const workerMap: Record<string, { employeeCode: string; employeeName: string; department: string; designation: string; payroll: string; hours: number; cost: number; count: number }> = {};

  records.forEach((r) => {
    totalHours += r.overtimeHours;
    totalCost += r.estimatedOtCost;
    if (r.foodingApplicable) foodingCount += 1;
    if (r.employeeCode) workerSet.add(r.employeeCode);

    // Monthly
    if (!monthMap[r.monthKey]) {
      monthMap[r.monthKey] = {
        monthKey: r.monthKey,
        monthLabel: r.monthLabel,
        hours: 0,
        cost: 0,
        workers: new Set(),
        count: 0,
      };
    }
    monthMap[r.monthKey].hours += r.overtimeHours;
    monthMap[r.monthKey].cost += r.estimatedOtCost;
    monthMap[r.monthKey].workers.add(r.employeeCode);
    monthMap[r.monthKey].count += 1;

    // Stage
    const stg = r.pmsStage;
    if (!stageMap[stg]) {
      stageMap[stg] = {
        stageName: stg,
        stepNumber: r.pmsStepNumber,
        hours: 0,
        cost: 0,
        workers: new Set(),
        count: 0,
        remarks: new Set(),
      };
    }
    stageMap[stg].hours += r.overtimeHours;
    stageMap[stg].cost += r.estimatedOtCost;
    stageMap[stg].workers.add(r.employeeCode);
    stageMap[stg].count += 1;
    if (r.remarks && r.remarks !== 'NA' && r.remarks !== 'N.A.') {
      stageMap[stg].remarks.add(r.remarks);
    }
    if (r.reasonForOvertime && r.reasonForOvertime !== 'NA' && r.reasonForOvertime !== 'N.A.') {
      stageMap[stg].remarks.add(r.reasonForOvertime);
    }

    // Department
    const dept = r.department || 'Unassigned';
    if (!deptMap[dept]) {
      deptMap[dept] = { department: dept, hours: 0, cost: 0, workers: new Set() };
    }
    deptMap[dept].hours += r.overtimeHours;
    deptMap[dept].cost += r.estimatedOtCost;
    deptMap[dept].workers.add(r.employeeCode);

    // Payroll
    const pay = r.payroll || 'Little Nap';
    if (!payrollMap[pay]) {
      payrollMap[pay] = { payroll: pay, hours: 0, cost: 0, workers: new Set() };
    }
    payrollMap[pay].hours += r.overtimeHours;
    payrollMap[pay].cost += r.estimatedOtCost;
    payrollMap[pay].workers.add(r.employeeCode);

    // Top Workers
    const wKey = r.employeeCode || r.employeeName;
    if (!workerMap[wKey]) {
      workerMap[wKey] = {
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        department: r.department,
        designation: r.designation,
        payroll: r.payroll,
        hours: 0,
        cost: 0,
        count: 0,
      };
    }
    workerMap[wKey].hours += r.overtimeHours;
    workerMap[wKey].cost += r.estimatedOtCost;
    workerMap[wKey].count += 1;
  });

  // Sort monthly breakdown chronologically
  const monthlyBreakdown = Object.values(monthMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(m => ({
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      hours: Math.round(m.hours * 10) / 10,
      cost: m.cost,
      workerCount: m.workers.size,
      recordsCount: m.count,
    }));

  // Sort stages by total hours descending
  const stageBreakdown = Object.values(stageMap)
    .sort((a, b) => b.hours - a.hours)
    .map(s => ({
      stageName: s.stageName,
      stepNumber: s.stepNumber,
      hours: Math.round(s.hours * 10) / 10,
      cost: s.cost,
      workerCount: s.workers.size,
      recordsCount: s.count,
      topRemarks: Array.from(s.remarks).slice(0, 6),
    }));

  // Sort departments
  const departmentBreakdown = Object.values(deptMap)
    .sort((a, b) => b.hours - a.hours)
    .map(d => ({
      department: d.department,
      hours: Math.round(d.hours * 10) / 10,
      cost: d.cost,
      workerCount: d.workers.size,
      sharePct: totalHours > 0 ? Math.round((d.hours / totalHours) * 1000) / 10 : 0,
    }));

  // Sort payroll
  const payrollBreakdown = Object.values(payrollMap)
    .sort((a, b) => b.hours - a.hours)
    .map(p => ({
      payroll: p.payroll,
      hours: Math.round(p.hours * 10) / 10,
      cost: p.cost,
      workerCount: p.workers.size,
    }));

  // Top workers by OT hours
  const topWorkers = Object.values(workerMap)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20)
    .map(w => ({
      ...w,
      hours: Math.round(w.hours * 10) / 10,
      recordsCount: w.count,
    }));

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalCost,
    totalRecords,
    uniqueEmployees: workerSet.size,
    foodingCount,
    monthlyBreakdown,
    stageBreakdown,
    departmentBreakdown,
    payrollBreakdown,
    topWorkers,
  };
}
