import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  PackageCheck, 
  Clock, 
  ReceiptText, 
  Headphones, 
  TrendingUp, 
  Factory, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  ChevronRight, 
  User, 
  MapPin, 
  Building2, 
  Layers, 
  RefreshCw, 
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatInrCompact } from '../utils/format';
import type { Order } from '../types';
import { normalizeToYMD, MONTH_NAMES_SHORT, MONTH_NAMES_FULL } from '../utils/dateUtils';
import { getCachedOrders, fetchAndParseData } from '../services/googleSheetService';
import { getCachedReadyGoods, fetchReadyGoodsData, type ReadyGoodItem } from '../services/readyGoodsService';
import { getCachedOvertimeData, fetchRealOvertimeData, type RealOvertimeRecord } from '../services/overtimeService';
import { getCachedReceivables, fetchReceivableListData, type ReceivableItem } from '../services/receivableListService';
import { getCachedServiceComplaints, fetchServiceComplaints, type ServiceComplaint } from '../services/complaintService';
import { getCachedSalesReport, fetchSalesReportData, type SalesReportRecord } from '../services/salesReportService';

interface DailyEnterpriseSummaryViewProps {
  onBackToDashboard?: () => void;
  onNavigateToModule?: (module: string) => void;
}

type PillarFilter = 'all' | 'production' | 'overtime' | 'readyGoods' | 'receivables' | 'complaints' | 'sales';

const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

const SummaryBlock: React.FC<{
  title: string;
  headline: string;
  detail?: string;
  empty: string;
  rows: Array<{ key: string; left: string; sub?: string; right?: string }>;
}> = ({ title, headline, detail, empty, rows }) => (
  <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {detail && <span className="text-[13px] text-slate-500">{detail}</span>}
    </div>
    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{headline}</div>
    {rows.length === 0 ? (
      <p className="mt-3 text-sm text-slate-500">{empty}</p>
    ) : (
      <ul className="mt-4 divide-y divide-slate-100">
        {rows.slice(0, 6).map(r => (
          <li key={r.key} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-slate-800 truncate block">{r.left}</span>
              {r.sub && <span className="text-[13px] text-slate-500 truncate block">{r.sub}</span>}
            </span>
            {r.right && <span className="shrink-0 tabular-nums text-slate-600">{r.right}</span>}
          </li>
        ))}
        {rows.length > 6 && <li className="pt-2.5 text-[13px] text-slate-500">+ {rows.length - 6} more (see Export)</li>}
      </ul>
    )}
  </section>
);

export const DailyEnterpriseSummaryView: React.FC<DailyEnterpriseSummaryViewProps> = ({
  onBackToDashboard,
  onNavigateToModule
}) => {
  // Datasets loaded from cache or live fetches
  const [orders, setOrders] = useState<Order[]>(() => getCachedOrders());
  const [overtimeRecords, setOvertimeRecords] = useState<RealOvertimeRecord[]>(() => getCachedOvertimeData());
  const [readyGoodsItems, setReadyGoodsItems] = useState<ReadyGoodItem[]>(() => getCachedReadyGoods());
  const [receivables, setReceivables] = useState<ReceivableItem[]>(() => getCachedReceivables());
  const [complaints, setComplaints] = useState<ServiceComplaint[]>(() => getCachedServiceComplaints());
  const [salesRecords, setSalesRecords] = useState<SalesReportRecord[]>(() => getCachedSalesReport());

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activePillar, setActivePillar] = useState<PillarFilter>('all');
  const [pillarSearch, setPillarSearch] = useState<string>('');

  // Collect all unique active dates across all operational datasets
  const availableActiveDates = useMemo(() => {
    const datesSet = new Set<string>();

    // From Production orders (actual dates of steps, receive dates, dispatch dates)
    orders.forEach(o => {
      if (o.steps) {
        o.steps.forEach(s => {
          const ymd = normalizeToYMD(s.actualDate);
          if (ymd) datesSet.add(ymd);
        });
      }
      const dispYmd = normalizeToYMD(o.dispatchDate);
      if (dispYmd) datesSet.add(dispYmd);
    });

    // From Overtime
    overtimeRecords.forEach(r => {
      const ymd = r.dateYMD || normalizeToYMD(r.dateStr);
      if (ymd) datesSet.add(ymd);
    });

    // From Ready Goods (Final QC dates)
    readyGoodsItems.forEach(rg => {
      const ymd = normalizeToYMD(rg.finalQcDate) || normalizeToYMD(rg.orderDate);
      if (ymd) datesSet.add(ymd);
    });

    // From Receivables (Invoice Date or Due Date)
    receivables.forEach(r => {
      const ymd = normalizeToYMD(r.invoiceDate) || normalizeToYMD(r.dueDate);
      if (ymd) datesSet.add(ymd);
    });

    // From Service Complaints
    complaints.forEach(c => {
      const ymd = normalizeToYMD(c.timestamp);
      if (ymd) datesSet.add(ymd);
    });

    // From Sales Report
    salesRecords.forEach(s => {
      const ymd = normalizeToYMD(s.date);
      if (ymd) datesSet.add(ymd);
    });

    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [orders, overtimeRecords, readyGoodsItems, receivables, complaints, salesRecords]);

  // Today's normalized date in local YYYY-MM-DD
  const todayYMD = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Yesterday's normalized date
  const yesterdayYMD = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Default to today if it has activity, else latest recorded date
  const initialSelectedDate = useMemo(() => {
    if (availableActiveDates.includes(todayYMD)) return todayYMD;
    if (availableActiveDates.length > 0) return availableActiveDates[0];
    return todayYMD;
  }, [availableActiveDates, todayYMD]);

  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate);

  // Sync initial date when available dates load
  useEffect(() => {
    if (availableActiveDates.length > 0 && !availableActiveDates.includes(selectedDate)) {
      if (availableActiveDates.includes(todayYMD)) {
        setSelectedDate(todayYMD);
      } else {
        setSelectedDate(availableActiveDates[0]);
      }
    }
  }, [availableActiveDates, todayYMD]);

  // Background fetch to ensure latest data
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      const [ord, ot, rg, rec, cmp, sls] = await Promise.allSettled([
        fetchAndParseData(),
        fetchRealOvertimeData(true),
        fetchReadyGoodsData(true),
        fetchReceivableListData(true),
        fetchServiceComplaints(),
        fetchSalesReportData(true),
      ]);

      if (ord.status === 'fulfilled' && ord.value) setOrders(ord.value);
      if (ot.status === 'fulfilled' && ot.value) setOvertimeRecords(ot.value);
      if (rg.status === 'fulfilled' && rg.value) setReadyGoodsItems(rg.value);
      if (rec.status === 'fulfilled' && rec.value) setReceivables(rec.value);
      if (cmp.status === 'fulfilled' && cmp.value) setComplaints(cmp.value);
      if (sls.status === 'fulfilled' && sls.value) setSalesRecords(sls.value);
    } catch (err) {
      console.warn('Error refreshing daily enterprise summary data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Human friendly formatting for selected date (e.g., "Tuesday, 08 September 2026")
  const formattedSelectedDateDisplay = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[dateObj.getDay()];
      const monthName = MONTH_NAMES_FULL[m] || MONTH_NAMES_SHORT[m];
      return `${dayName}, ${String(d).padStart(2, '0')} ${monthName} ${y}`;
    }
    return selectedDate;
  }, [selectedDate]);

  // ==========================================
  // PILLAR 1: PRODUCTION ON SELECTED DATE
  // ==========================================
  const productionSummary = useMemo(() => {
    let stepsCompletedCount = 0;
    let unitsCompletedCount = 0;
    const matchedOrders: Array<{
      order: Order;
      stepsToday: Array<{ stage: string; actualDate: string; plannedDate: string; delay: number; qtyPass?: number; remarks?: string }>;
      isFinalQcToday: boolean;
      isDispatchToday: boolean;
    }> = [];

    const stageBreakdown: Record<string, number> = {};

    orders.forEach(order => {
      const stepsToday = (order.steps || []).filter(step => {
        const ymd = normalizeToYMD(step.actualDate);
        return ymd === selectedDate;
      }).map(s => ({
        stage: s.name,
        actualDate: s.actualDate || '',
        plannedDate: s.plannedDate || '',
        delay: s.delay || 0,
        qtyPass: s.qtyPass,
        remarks: s.remarks,
      }));

      const finalQcStep = (order.steps || []).find(s => s.name === 'QUALITY CONTROL');
      const isFinalQcToday = normalizeToYMD(finalQcStep?.actualDate) === selectedDate;

      const dispatchStep = (order.steps || []).find(s => s.name === 'DISPATCH');
      const isDispatchToday = normalizeToYMD(dispatchStep?.actualDate) === selectedDate;

      if (stepsToday.length > 0 || isFinalQcToday || isDispatchToday) {
        stepsCompletedCount += stepsToday.length;
        if (isFinalQcToday || stepsToday.length > 0) {
          unitsCompletedCount += order.quantity || 0;
        }

        stepsToday.forEach(st => {
          stageBreakdown[st.stage] = (stageBreakdown[st.stage] || 0) + 1;
        });

        matchedOrders.push({
          order,
          stepsToday,
          isFinalQcToday,
          isDispatchToday,
        });
      }
    });

    return {
      totalStepsToday: stepsCompletedCount,
      totalUnitsProduced: unitsCompletedCount,
      totalOpfsActive: matchedOrders.length,
      orders: matchedOrders,
      stageBreakdown,
    };
  }, [orders, selectedDate]);

  // ==========================================
  // PILLAR 2: OVERTIME ON SELECTED DATE
  // ==========================================
  const overtimeSummary = useMemo(() => {
    const records = overtimeRecords.filter(r => {
      const ymd = r.dateYMD || normalizeToYMD(r.dateStr);
      return ymd === selectedDate;
    });

    const totalHours = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
    const totalCost = records.reduce((sum, r) => sum + (r.estimatedOtCost || 0), 0);
    const uniqueEmployees = new Set(records.map(r => r.employeeCode || r.employeeName)).size;

    const deptMap: Record<string, { hours: number; cost: number; count: number }> = {};
    records.forEach(r => {
      const d = r.department || 'Unassigned';
      if (!deptMap[d]) deptMap[d] = { hours: 0, cost: 0, count: 0 };
      deptMap[d].hours += r.overtimeHours;
      deptMap[d].cost += r.estimatedOtCost;
      deptMap[d].count += 1;
    });

    return {
      totalHours,
      totalCost,
      uniqueEmployees,
      totalRecords: records.length,
      records,
      deptBreakdown: deptMap,
    };
  }, [overtimeRecords, selectedDate]);

  // ==========================================
  // PILLAR 3: READY GOODS ON SELECTED DATE
  // ==========================================
  const readyGoodsSummary = useMemo(() => {
    // Items that entered ready goods on this date (Final QC date == selected date)
    const newAddedToday = readyGoodsItems.filter(rg => {
      const ymd = normalizeToYMD(rg.finalQcDate);
      return ymd === selectedDate;
    });

    // Total factory ready goods stock currently holding
    const totalStockUnits = readyGoodsItems.reduce((sum, i) => sum + (i.readyGoodsQty || 0), 0);
    const totalBalanceDue = readyGoodsItems.reduce((sum, i) => sum + (i.balancePayment || 0), 0);
    const criticalOverdue = readyGoodsItems.filter(i => i.daysInFactory > 60);

    const newUnitsToday = newAddedToday.reduce((sum, i) => sum + (i.readyGoodsQty || 0), 0);
    const newBalanceToday = newAddedToday.reduce((sum, i) => sum + (i.balancePayment || 0), 0);

    return {
      newAddedCount: newAddedToday.length,
      newUnitsToday,
      newBalanceToday,
      newItems: newAddedToday,
      totalStockUnits,
      totalBalanceDue,
      totalStockOrders: readyGoodsItems.length,
      criticalOverdueCount: criticalOverdue.length,
    };
  }, [readyGoodsItems, selectedDate]);

  // ==========================================
  // PILLAR 4: RECEIVABLES ON SELECTED DATE
  // ==========================================
  const receivablesSummary = useMemo(() => {
    // Invoices generated or due on this date
    const dateMatchedInvoices = receivables.filter(r => {
      const invYmd = normalizeToYMD(r.invoiceDate);
      const dueYmd = normalizeToYMD(r.dueDate);
      return invYmd === selectedDate || dueYmd === selectedDate;
    });

    const totalInvoiceAmountToday = dateMatchedInvoices.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);
    const totalReceivedAmountToday = dateMatchedInvoices.reduce((sum, r) => sum + (r.receivedAmount || 0), 0);
    const totalBalanceAmountToday = dateMatchedInvoices.reduce((sum, r) => sum + (r.balanceAmount || 0), 0);

    // Global outstanding overview
    const globalTotalBalance = receivables.reduce((sum, r) => sum + (r.balanceAmount || 0), 0);

    return {
      countToday: dateMatchedInvoices.length,
      totalInvoiceAmountToday,
      totalReceivedAmountToday,
      totalBalanceAmountToday,
      invoicesToday: dateMatchedInvoices,
      globalTotalBalance,
    };
  }, [receivables, selectedDate]);

  // ==========================================
  // PILLAR 5: SERVICE COMPLAINTS ON SELECTED DATE
  // ==========================================
  const complaintsSummary = useMemo(() => {
    const complaintsToday = complaints.filter(c => {
      const ymd = normalizeToYMD(c.timestamp);
      return ymd === selectedDate;
    });

    const warrantyCount = complaintsToday.filter(c => {
      const w = c.underWarranty.toLowerCase();
      return w.includes('under') || w === 'yes' || w === 'valid';
    }).length;

    const techVisitCount = complaintsToday.filter(c => {
      const t = c.technicianVisitRequired.toLowerCase();
      return t.includes('yes') || t.includes('true');
    }).length;

    const resolvedCount = complaintsToday.filter(c => c.status.toLowerCase() === 'closed').length;

    return {
      totalToday: complaintsToday.length,
      warrantyCount,
      techVisitCount,
      resolvedCount,
      complaintsToday,
      totalGlobalOpen: complaints.filter(c => c.status.toLowerCase() !== 'closed').length,
    };
  }, [complaints, selectedDate]);

  // ==========================================
  // PILLAR 6: SALES REPORT ON SELECTED DATE
  // ==========================================
  const salesSummary = useMemo(() => {
    const salesToday = salesRecords.filter(s => {
      const ymd = normalizeToYMD(s.date);
      return ymd === selectedDate;
    });

    const totalUnitsSold = salesToday.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalNetSales = salesToday.reduce((sum, s) => sum + (s.netSales || 0), 0);
    const totalAdvance = salesToday.reduce((sum, s) => sum + (s.advanceAmount || 0), 0);

    // Top salesperson of the day
    const personMap: Record<string, { units: number; netSales: number }> = {};
    salesToday.forEach(s => {
      const sp = s.salespersonName || 'Unassigned';
      if (!personMap[sp]) personMap[sp] = { units: 0, netSales: 0 };
      personMap[sp].units += s.quantity || 0;
      personMap[sp].netSales += s.netSales || 0;
    });

    const topSalesperson = Object.entries(personMap).sort((a, b) => b[1].netSales - a[1].netSales)[0];

    return {
      totalOrdersToday: salesToday.length,
      totalUnitsSold,
      totalNetSales,
      totalAdvance,
      salesToday,
      topSalespersonName: topSalesperson ? topSalesperson[0] : null,
      topSalespersonValue: topSalesperson ? topSalesperson[1].netSales : 0,
    };
  }, [salesRecords, selectedDate]);

  // Export Daily Enterprise Summary to Excel
  const handleExportDailySummary = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive KPI Summary
    const summaryData = [
      { 'Operational Pillar': 'Production Output', 'Selected Date': selectedDate, 'Primary Metric': `${productionSummary.totalUnitsProduced} Units`, 'Secondary Metric': `${productionSummary.totalOpfsActive} OPFs Active`, 'Detail': `${productionSummary.totalStepsToday} production steps actualized` },
      { 'Operational Pillar': 'Workforce Overtime', 'Selected Date': selectedDate, 'Primary Metric': `${overtimeSummary.totalHours} Hours`, 'Secondary Metric': `₹${overtimeSummary.totalCost.toLocaleString('en-IN')}`, 'Detail': `${overtimeSummary.uniqueEmployees} employees logged overtime` },
      { 'Operational Pillar': 'Ready Goods Inflow', 'Selected Date': selectedDate, 'Primary Metric': `${readyGoodsSummary.newUnitsToday} Units Added`, 'Secondary Metric': `₹${readyGoodsSummary.newBalanceToday.toLocaleString('en-IN')} Balance Due`, 'Detail': `${readyGoodsSummary.newAddedCount} orders cleared Final QC today` },
      { 'Operational Pillar': 'Receivables & Invoicing', 'Selected Date': selectedDate, 'Primary Metric': `₹${receivablesSummary.totalInvoiceAmountToday.toLocaleString('en-IN')}`, 'Secondary Metric': `₹${receivablesSummary.totalBalanceAmountToday.toLocaleString('en-IN')} Due`, 'Detail': `${receivablesSummary.countToday} invoices tracked today` },
      { 'Operational Pillar': 'Customer Service Complaints', 'Selected Date': selectedDate, 'Primary Metric': `${complaintsSummary.totalToday} New Complaints`, 'Secondary Metric': `${complaintsSummary.warrantyCount} Under Warranty`, 'Detail': `${complaintsSummary.techVisitCount} technician visits required` },
      { 'Operational Pillar': 'Sales Report (New Bookings)', 'Selected Date': selectedDate, 'Primary Metric': `${salesSummary.totalUnitsSold} Units Sold`, 'Secondary Metric': `₹${salesSummary.totalNetSales.toLocaleString('en-IN')} Net Revenue`, 'Detail': `${salesSummary.totalOrdersToday} sales orders booked` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // Sheet 2: Production Ledger
    if (productionSummary.orders.length > 0) {
      const prodRows = productionSummary.orders.map(item => ({
        'OPF No': item.order.opfNo,
        'Model': item.order.modelName,
        'Quantity': item.order.quantity,
        'Upholstery': item.order.upholstery,
        'Current Stage': item.order.currentStage || 'Finished',
        'Steps Today': item.stepsToday.map(s => s.stage).join(', ') || 'Final inspection / Dispatch',
        'Final inspection Today': item.isFinalQcToday ? 'YES' : 'NO',
        'Dispatched Today': item.isDispatchToday ? 'YES' : 'NO',
      }));
      const wsProd = XLSX.utils.json_to_sheet(prodRows);
      XLSX.utils.book_append_sheet(wb, wsProd, 'Production Orders');
    }

    // Sheet 3: Overtime Records
    if (overtimeSummary.records.length > 0) {
      const otRows = overtimeSummary.records.map(r => ({
        'Emp Code': r.employeeCode,
        'Employee Name': r.employeeName,
        'Designation': r.designation,
        'Department': r.department,
        'PMS Stage': r.pmsStage,
        'Hours': r.overtimeHours,
        'Estimated Cost (INR)': r.estimatedOtCost,
        'Reason / Remarks': r.reasonForOvertime || r.remarks || 'None',
      }));
      const wsOt = XLSX.utils.json_to_sheet(otRows);
      XLSX.utils.book_append_sheet(wb, wsOt, 'Overtime Activity');
    }

    // Sheet 4: Ready Goods Added
    if (readyGoodsSummary.newItems.length > 0) {
      const rgRows = readyGoodsSummary.newItems.map(rg => ({
        'Customer Name': rg.customerName,
        'OPF No': rg.opfNo,
        'Model Name': rg.modelName,
        'Ready Qty': rg.readyGoodsQty,
        'Gross Amount': rg.grossAmount,
        'Received Amount': rg.receivedAmount,
        'Balance Due': rg.balancePayment,
        'Days in Factory': rg.daysInFactory,
        'Salesperson': rg.salesPerson,
      }));
      const wsRg = XLSX.utils.json_to_sheet(rgRows);
      XLSX.utils.book_append_sheet(wb, wsRg, 'Ready Goods Added');
    }

    // Sheet 5: Sales Booked
    if (salesSummary.salesToday.length > 0) {
      const salesRows = salesSummary.salesToday.map(s => ({
        'Salesperson': s.salespersonName,
        'Client / Dealer': s.clientName || s.dealerName,
        'OPF No': s.opfNumber,
        'Model': s.model,
        'Quantity': s.quantity,
        'Net Sales': s.netSales,
        'Advance Amount': s.advanceAmount,
        'Region': s.region,
      }));
      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Bookings');
    }

    XLSX.writeFile(wb, `LittleNap_Daily_Operations_Digest_${selectedDate}.xlsx`);
  };

  const pill = (active: boolean) =>
    `px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Daily summary</h1>
          <p className="mt-1 text-sm text-slate-500">{formattedSelectedDateDisplay}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setSelectedDate(todayYMD)} className={pill(selectedDate === todayYMD)}>Today</button>
          <button onClick={() => setSelectedDate(yesterdayYMD)} className={pill(selectedDate === yesterdayYMD)}>Yesterday</button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden"
          />
          <button
            onClick={refreshAllData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportDailySummary}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <SummaryBlock
        title="Production"
        headline={pl(productionSummary.totalUnitsProduced, 'chair')}
        detail={`${pl(productionSummary.totalOpfsActive, 'order')} worked on`}
        empty="No production recorded."
        rows={productionSummary.orders.map(o => ({
          key: o.order.opfNo,
          left: o.order.modelName || o.order.opfNo,
          sub: o.order.opfNo,
          right: o.isDispatchToday ? 'Dispatched' : o.isFinalQcToday ? 'Passed inspection' : pl(o.order.quantity, 'chair'),
        }))}
      />

      <SummaryBlock
        title="Overtime"
        headline={`${overtimeSummary.totalHours.toFixed(1)} hours`}
        detail={overtimeSummary.totalRecords ? `${pl(overtimeSummary.uniqueEmployees, 'person').replace('persons','people')} · ${formatInrCompact(overtimeSummary.totalCost)}` : undefined}
        empty="No overtime logged."
        rows={(Object.entries(overtimeSummary.deptBreakdown) as Array<[string, { hours: number; cost: number; count: number }]>)
          .sort((a, b) => b[1].hours - a[1].hours)
          .map(([dept, v]) => ({ key: dept, left: dept, sub: pl(v.count, 'entry').replace('entrys','entries'), right: `${v.hours.toFixed(1)} h` }))}
      />

      <SummaryBlock
        title="Ready goods"
        headline={`${pl(readyGoodsSummary.newUnitsToday, 'new chair')}`}
        detail={`${readyGoodsSummary.totalStockUnits} in stock · ${formatInrCompact(readyGoodsSummary.totalBalanceDue)} to collect`}
        empty="No new orders became ready."
        rows={readyGoodsSummary.newItems.map(i => ({
          key: i.id,
          left: i.customerName || i.opfNo,
          sub: i.opfNo,
          right: pl(i.readyGoodsQty, 'chair'),
        }))}
      />

      <SummaryBlock
        title="Receivables"
        headline={formatInrCompact(receivablesSummary.totalBalanceAmountToday)}
        detail={`${pl(receivablesSummary.countToday, 'invoice')} · ${formatInrCompact(receivablesSummary.globalTotalBalance)} outstanding overall`}
        empty="No invoices raised or due."
        rows={receivablesSummary.invoicesToday.map(r => ({
          key: r.id,
          left: r.customerName,
          sub: r.invoiceNo,
          right: formatInrCompact(r.balanceAmount),
        }))}
      />

      <SummaryBlock
        title="Service complaints"
        headline={`${complaintsSummary.totalToday} new`}
        detail={`${complaintsSummary.techVisitCount} need${complaintsSummary.techVisitCount === 1 ? 's' : ''} a visit · ${complaintsSummary.totalGlobalOpen} open overall`}
        empty="No new complaints."
        rows={complaintsSummary.complaintsToday.map(c => ({
          key: c.id,
          left: c.clientName || c.opfNo,
          sub: c.problems,
          right: c.status,
        }))}
      />

      <SummaryBlock
        title="Sales"
        headline={formatInrCompact(salesSummary.totalNetSales)}
        detail={
          salesSummary.totalOrdersToday
            ? `${pl(salesSummary.totalUnitsSold, 'chair')}${salesSummary.topSalespersonName ? ` · top: ${salesSummary.topSalespersonName}` : ''}`
            : undefined
        }
        empty="No sales booked."
        rows={salesSummary.salesToday.map(r => ({
          key: r.id,
          left: r.clientName || r.opfNumber,
          sub: r.salespersonName,
          right: formatInrCompact(r.netSales),
        }))}
      />
    </div>
  );
};
