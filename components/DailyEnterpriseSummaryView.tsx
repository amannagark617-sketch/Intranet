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
        'Steps Today': item.stepsToday.map(s => s.stage).join(', ') || 'Final QC / Dispatch',
        'Final QC Today': item.isFinalQcToday ? 'YES' : 'NO',
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

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* 1. TOP EXECUTIVE HEADER WITH INTERACTIVE DATE PICKER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                RG Operations Hub
              </span>
              <span className="text-xs font-semibold text-slate-400">•</span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Consolidated Enterprise Feed
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Daily Operations Digest</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
              Cross-functional enterprise summary tracking production output, workforce overtime, ready goods staging, receivables collections, customer service complaints &amp; sales bookings.
            </p>
          </div>

          {/* Action Tools & Date Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Native Date Input with Calendar Styling */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-indigo-600 mr-2 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Select Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>
            </div>

            {/* Live Refresh */}
            <button
              onClick={refreshAllData}
              disabled={isLoading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer shrink-0"
              title="Refresh all sheet streams"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Export Daily Digest */}
            <button
              onClick={handleExportDailySummary}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              title="Download consolidated Excel report for the selected date"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Daily Digest</span>
            </button>
          </div>
        </div>

        {/* Quick Date Selection Strip */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Select:</span>
            
            <button
              onClick={() => setSelectedDate(todayYMD)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === todayYMD
                  ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              Today ({todayYMD})
            </button>

            <button
              onClick={() => setSelectedDate(yesterdayYMD)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === yesterdayYMD
                  ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              Yesterday ({yesterdayYMD})
            </button>

            {availableActiveDates.slice(0, 5).map(dateKey => {
              if (dateKey === todayYMD || dateKey === yesterdayYMD) return null;
              const isSelected = selectedDate === dateKey;
              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {dateKey}
                </button>
              );
            })}
          </div>

          <div className="text-xs font-bold text-indigo-900 bg-indigo-50/70 border border-indigo-100 px-3 py-1 rounded-xl">
            📅 Active Snapshot: <span className="font-extrabold text-indigo-950">{formattedSelectedDateDisplay}</span>
          </div>
        </div>
      </div>

      {/* 2. TOP 6 CLEAN WHITE KPI CARDS FOR SELECTED DATE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: PRODUCTION OUTPUT */}
        <div 
          onClick={() => setActivePillar(activePillar === 'production' ? 'all' : 'production')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'production' ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Production Output</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Factory className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-slate-900">
              {productionSummary.totalUnitsProduced}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">units</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {productionSummary.totalOpfsActive} OPFs • {productionSummary.totalStepsToday} steps
            </div>
          </div>
        </div>

        {/* KPI 2: WORKFORCE OVERTIME */}
        <div 
          onClick={() => setActivePillar(activePillar === 'overtime' ? 'all' : 'overtime')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'overtime' ? 'border-orange-500 ring-2 ring-orange-400/30' : 'border-slate-200/90 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overtime Logged</span>
            <div className="p-1.5 bg-orange-50 text-orange-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-orange-700">
              {overtimeSummary.totalHours.toFixed(1)}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">hrs</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              ₹{Math.round(overtimeSummary.totalCost).toLocaleString('en-IN')} • {overtimeSummary.uniqueEmployees} workers
            </div>
          </div>
        </div>

        {/* KPI 3: READY GOODS ADDED */}
        <div 
          onClick={() => setActivePillar(activePillar === 'readyGoods' ? 'all' : 'readyGoods')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'readyGoods' ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-slate-200/90 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ready Goods Inflow</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-emerald-800">
              {readyGoodsSummary.newUnitsToday}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">units</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {readyGoodsSummary.newAddedCount} orders added today
            </div>
          </div>
        </div>

        {/* KPI 4: RECEIVABLES */}
        <div 
          onClick={() => setActivePillar(activePillar === 'receivables' ? 'all' : 'receivables')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'receivables' ? 'border-indigo-500 ring-2 ring-indigo-400/30' : 'border-slate-200/90 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Invoices &amp; Recv</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-indigo-700">
              ₹{(receivablesSummary.totalInvoiceAmountToday / 100000).toFixed(2)}L
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {receivablesSummary.countToday} invoices • ₹{(receivablesSummary.totalBalanceAmountToday / 100000).toFixed(2)}L due
            </div>
          </div>
        </div>

        {/* KPI 5: SERVICE COMPLAINTS */}
        <div 
          onClick={() => setActivePillar(activePillar === 'complaints' ? 'all' : 'complaints')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'complaints' ? 'border-rose-500 ring-2 ring-rose-400/30' : 'border-slate-200/90 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Complaints Logged</span>
            <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
              <Headphones className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-rose-700">
              {complaintsSummary.totalToday}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">tickets</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {complaintsSummary.warrantyCount} warranty • {complaintsSummary.techVisitCount} visits
            </div>
          </div>
        </div>

        {/* KPI 6: SALES REPORT */}
        <div 
          onClick={() => setActivePillar(activePillar === 'sales' ? 'all' : 'sales')}
          className={`bg-white rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            activePillar === 'sales' ? 'border-blue-500 ring-2 ring-blue-400/30' : 'border-slate-200/90 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">New Sales Booked</span>
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black font-mono text-blue-700">
              {salesSummary.totalUnitsSold}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">units</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              ₹{(salesSummary.totalNetSales / 100000).toFixed(2)}L net • {salesSummary.totalOrdersToday} orders
            </div>
          </div>
        </div>
      </div>

      {/* 3. SUB-NAV FILTER BUTTONS & SECTION SEARCH */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Pillar filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <button
            onClick={() => setActivePillar('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activePillar === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Pillars (Overview)
          </button>
          
          <button
            onClick={() => setActivePillar('production')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'production'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Production ({productionSummary.orders.length})</span>
          </button>

          <button
            onClick={() => setActivePillar('overtime')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'overtime'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Overtime ({overtimeSummary.records.length})</span>
          </button>

          <button
            onClick={() => setActivePillar('readyGoods')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'readyGoods'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Ready Goods ({readyGoodsSummary.newItems.length})</span>
          </button>

          <button
            onClick={() => setActivePillar('receivables')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'receivables'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Receivables ({receivablesSummary.invoicesToday.length})</span>
          </button>

          <button
            onClick={() => setActivePillar('complaints')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'complaints'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Complaints ({complaintsSummary.complaintsToday.length})</span>
          </button>

          <button
            onClick={() => setActivePillar('sales')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activePillar === 'sales'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Sales Report ({salesSummary.salesToday.length})</span>
          </button>
        </div>

        {/* Keyword Filter for items in this date */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={pillarSearch}
            onChange={(e) => setPillarSearch(e.target.value)}
            placeholder="Search OPF, model, client..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* 4. DETAIL MODULE SECTIONS */}
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* SECTION A: PRODUCTION OUTPUT ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'production') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>1. Production &amp; Plant Operations Output</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800">
                      {productionSummary.orders.length} Active Orders
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chairs, OPFs, and stages completed or passing Final QC on {selectedDate}
                  </p>
                </div>
              </div>

              {/* Stage counts pill strip */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {Object.entries(productionSummary.stageBreakdown).slice(0, 4).map(([stg, count]) => (
                  <span key={stg} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 text-[11px]">
                    {stg}: <strong className="text-amber-800">{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            {productionSummary.orders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No production steps recorded on {selectedDate}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">OPF &amp; Model</th>
                      <th className="py-2.5 px-4">Quantity</th>
                      <th className="py-2.5 px-4">Upholstery</th>
                      <th className="py-2.5 px-4">Stages Active Today</th>
                      <th className="py-2.5 px-4">Current Stage</th>
                      <th className="py-2.5 px-4">Final QC Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productionSummary.orders
                      .filter(item => {
                        if (!pillarSearch) return true;
                        const s = pillarSearch.toLowerCase();
                        return (
                          item.order.opfNo?.toLowerCase().includes(s) ||
                          item.order.modelName?.toLowerCase().includes(s) ||
                          item.order.upholstery?.toLowerCase().includes(s)
                        );
                      })
                      .slice(0, 50)
                      .map((item, idx) => (
                        <tr key={item.order.opfNo + idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            <div>{item.order.opfNo}</div>
                            <div className="text-[11px] font-normal text-slate-500">{item.order.modelName}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                            {item.order.quantity} units
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                            {item.order.upholstery || 'Standard'}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {item.stepsToday.map((st, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                                  {st.stage}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 font-medium">
                            {item.order.currentStage || 'Finished'}
                          </td>
                          <td className="py-2.5 px-4">
                            {item.isFinalQcToday ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Passed Today
                              </span>
                            ) : item.order.finalQcStatus === 'Pass' ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                                Passed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px]">
                                In Pipeline
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION B: OVERTIME ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'overtime') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-orange-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 text-orange-800 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>2. Workforce Overtime &amp; Plant Capacity</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-orange-100 text-orange-800">
                      {overtimeSummary.records.length} OT Logs ({overtimeSummary.totalHours.toFixed(1)} hrs)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Department overtime hours, costs &amp; workers logged on {selectedDate}
                  </p>
                </div>
              </div>

              {/* Department breakdown chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {Object.entries(overtimeSummary.deptBreakdown).map(([dept, data]: [string, { hours: number; cost: number; count: number }]) => (
                  <span key={dept} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 text-[11px]">
                    {dept}: <strong className="text-orange-800">{data.hours.toFixed(1)}h</strong>
                  </span>
                ))}
              </div>
            </div>

            {overtimeSummary.records.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No overtime logged on {selectedDate}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4">Department &amp; Designation</th>
                      <th className="py-2.5 px-4">PMS Stage</th>
                      <th className="py-2.5 px-4">OT Hours</th>
                      <th className="py-2.5 px-4">Estimated Payout</th>
                      <th className="py-2.5 px-4">Reason / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overtimeSummary.records
                      .filter(r => {
                        if (!pillarSearch) return true;
                        const s = pillarSearch.toLowerCase();
                        return (
                          r.employeeName?.toLowerCase().includes(s) ||
                          r.employeeCode?.toLowerCase().includes(s) ||
                          r.department?.toLowerCase().includes(s) ||
                          r.reasonForOvertime?.toLowerCase().includes(s)
                        );
                      })
                      .slice(0, 50)
                      .map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{r.employeeName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{r.employeeCode}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-800">{r.department}</div>
                            <div className="text-[10px] text-slate-500">{r.designation}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px]">
                              {r.pmsStage || 'General Plant'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-orange-800">
                            {r.overtimeHours} hrs
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                            ₹{Math.round(r.estimatedOtCost).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={r.reasonForOvertime || r.remarks}>
                            {r.reasonForOvertime || r.remarks || 'Standard overtime schedule'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION C: READY GOODS ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'readyGoods') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>3. Ready Goods Inflow &amp; Staging Pipeline</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                      {readyGoodsSummary.newUnitsToday} Units Added on {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Orders clearing Final QC and transitioning to Ready Goods staging
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">
                  Factory Warehouse Balance: <strong className="text-emerald-800">₹{(readyGoodsSummary.totalBalanceDue / 100000).toFixed(2)}L</strong> ({readyGoodsSummary.totalStockUnits} total units in stock)
                </span>
              </div>
            </div>

            {readyGoodsSummary.newItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No new orders entered Ready Goods specifically on {selectedDate}.
                <div className="mt-2 text-slate-500 font-medium">
                  Current Ready Goods inventory across all dates: {readyGoodsSummary.totalStockUnits} units awaiting customer delivery.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Customer &amp; OPF</th>
                      <th className="py-2.5 px-4">Model Name</th>
                      <th className="py-2.5 px-4">Ready Qty</th>
                      <th className="py-2.5 px-4">Gross Value</th>
                      <th className="py-2.5 px-4">Balance Due</th>
                      <th className="py-2.5 px-4">Salesperson</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {readyGoodsSummary.newItems
                      .filter(item => {
                        if (!pillarSearch) return true;
                        const s = pillarSearch.toLowerCase();
                        return (
                          item.customerName?.toLowerCase().includes(s) ||
                          item.opfNo?.toLowerCase().includes(s) ||
                          item.modelName?.toLowerCase().includes(s) ||
                          item.salesPerson?.toLowerCase().includes(s)
                        );
                      })
                      .map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{item.customerName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{item.opfNo}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">
                            {item.modelName}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-emerald-800">
                            {item.readyGoodsQty} units
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700">
                            ₹{item.grossAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-amber-700">
                            ₹{item.balancePayment.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {item.salesPerson || 'Unassigned'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION D: RECEIVABLES ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'receivables') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-indigo-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                  <ReceiptText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>4. Receivables &amp; FMS Payment Follow-Up</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800">
                      {receivablesSummary.countToday} Invoices on {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Invoices raised or falling due on {selectedDate}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-medium">
                Total Invoiced: <strong className="text-indigo-900">₹{(receivablesSummary.totalInvoiceAmountToday / 100000).toFixed(2)}L</strong>
                {' • '}
                Balance Due: <strong className="text-amber-800">₹{(receivablesSummary.totalBalanceAmountToday / 100000).toFixed(2)}L</strong>
              </div>
            </div>

            {receivablesSummary.invoicesToday.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No invoices specifically generated or due on {selectedDate}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Customer &amp; OPF</th>
                      <th className="py-2.5 px-4">Invoice No</th>
                      <th className="py-2.5 px-4">Invoice Amount</th>
                      <th className="py-2.5 px-4">Received Amount</th>
                      <th className="py-2.5 px-4">Balance Amount</th>
                      <th className="py-2.5 px-4">Salesperson</th>
                      <th className="py-2.5 px-4">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivablesSummary.invoicesToday
                      .filter(r => {
                        if (!pillarSearch) return true;
                        const s = pillarSearch.toLowerCase();
                        return (
                          r.customerName?.toLowerCase().includes(s) ||
                          r.opfNo?.toLowerCase().includes(s) ||
                          r.invoiceNo?.toLowerCase().includes(s) ||
                          r.salesPerson?.toLowerCase().includes(s)
                        );
                      })
                      .slice(0, 50)
                      .map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{r.customerName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{r.opfNo}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700">
                            {r.invoiceNo || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            ₹{r.invoiceAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-700">
                            ₹{r.receivedAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-amber-700">
                            ₹{r.balanceAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {r.salesPerson || 'Unassigned'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                            {r.dueDate || r.invoiceDate}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION E: SERVICE COMPLAINTS ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'complaints') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>5. Service Complaints &amp; Customer Care Response</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800">
                      {complaintsSummary.totalToday} New Cases on {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complaints registered, technician visits scheduled &amp; responses logged
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-medium">
                {complaintsSummary.warrantyCount} Under Warranty • {complaintsSummary.techVisitCount} Tech Visits Required
              </div>
            </div>

            {complaintsSummary.complaintsToday.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No new customer complaints registered on {selectedDate}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Client &amp; OPF</th>
                      <th className="py-2.5 px-4">Product Description</th>
                      <th className="py-2.5 px-4">Problem Reported</th>
                      <th className="py-2.5 px-4">Warranty</th>
                      <th className="py-2.5 px-4">Tech Visit</th>
                      <th className="py-2.5 px-4">Status &amp; Solution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complaintsSummary.complaintsToday
                      .filter(c => {
                        if (!pillarSearch) return true;
                        const s = pillarSearch.toLowerCase();
                        return (
                          c.clientName?.toLowerCase().includes(s) ||
                          c.opfNo?.toLowerCase().includes(s) ||
                          c.problems?.toLowerCase().includes(s) ||
                          c.productDescription?.toLowerCase().includes(s)
                        );
                      })
                      .slice(0, 50)
                      .map((c, idx) => (
                        <tr key={c.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{c.clientName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{c.opfNo || 'N/A'}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-800">
                            {c.productDescription || 'Recliner Unit'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 max-w-xs">
                            {c.problems || 'General Service Request'}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.underWarranty.toLowerCase().includes('under') || c.underWarranty.toLowerCase() === 'yes'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {c.underWarranty || 'Out of Warranty'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {c.technicianVisitRequired.toLowerCase().includes('yes') ? (
                              <span className="text-amber-700 font-bold text-[11px]">Yes</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-800">{c.status || 'Open'}</span>
                            {c.solution && <div className="text-[10px] text-slate-500 truncate max-w-xs">{c.solution}</div>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION F: SALES REPORT ON SELECTED DATE */}
        {/* ============================================================== */}
        {(activePillar === 'all' || activePillar === 'sales') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>6. Sales Performance &amp; New Bookings</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800">
                      {salesSummary.totalOrdersToday} Sales Orders ({salesSummary.totalUnitsSold} units)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    New commercial sales booked and revenue invoiced on {selectedDate}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-medium">
                Net Sales Value: <strong className="text-blue-900">₹{(salesSummary.totalNetSales / 100000).toFixed(2)}L</strong>
                {' • '}
                Advance Collected: <strong className="text-emerald-800">₹{(salesSummary.totalAdvance / 100000).toFixed(2)}L</strong>
              </div>
            </div>

            {salesSummary.salesToday.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No sales orders registered on {selectedDate}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Salesperson</th>
                      <th className="py-2.5 px-4">Client / Dealer</th>
                      <th className="py-2.5 px-4">OPF No</th>
                      <th className="py-2.5 px-4">Model Name</th>
                      <th className="py-2.5 px-4">Quantity</th>
                      <th className="py-2.5 px-4">Net Sales</th>
                      <th className="py-2.5 px-4">Advance Received</th>
                      <th className="py-2.5 px-4">Region</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesSummary.salesToday
                      .filter(s => {
                        if (!pillarSearch) return true;
                        const q = pillarSearch.toLowerCase();
                        return (
                          s.salespersonName?.toLowerCase().includes(q) ||
                          s.clientName?.toLowerCase().includes(q) ||
                          s.dealerName?.toLowerCase().includes(q) ||
                          s.opfNumber?.toLowerCase().includes(q) ||
                          s.model?.toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 50)
                      .map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {s.salespersonName || 'Unassigned'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">
                            {s.clientName || s.dealerName || 'Direct Client'}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700">
                            {s.opfNumber || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {s.model}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-800">
                            {s.quantity} units
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            ₹{s.netSales.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-700">
                            ₹{s.advanceAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {s.region || 'North'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
