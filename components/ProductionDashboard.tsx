import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Order, FinalQcRecord, QcMonthlyAggregate, AIPlantContext, ProductionAIAnalysis } from '../types';
import { 
  fetchFinalQcRecords, 
  buildMonthlyAggregates, 
  getMonthlyTarget,
  calculateQcPassedDispatchedReconciliation,
  MANUAL_MONTHLY_DATA_BEFORE_AUG_2025,
  HISTORICAL_MONTHLY_DISPATCHED,
  type QcMonthReconciliation,
  type QcOpfReconciliationItem
} from '../services/qcResponsesService';
import { fetchDispatchRecords, DispatchRecord } from '../services/dispatchResponseService';
import { fetchReadyGoodsData, type ReadyGoodItem } from '../services/readyGoodsService';
import { fetchReadyStockData, getCachedReadyStock, type ReadyStockItem } from '../services/readyStockService';
import { generateProductionAIAnalysis, computeBaselineHeuristicAnalysis } from '../services/geminiService';
import ProductionAIAdvisor from './ProductionAIAdvisor';
import ProductionChartsSection from './ProductionChartsSection';
import OnTimePerformanceView from './OnTimePerformanceView';
import DailyProductionStepView from './DailyProductionStepView';
import { calculateOnTimePerformance } from '../services/onTimeDeliveryService';
import { formatDateDDMMMYYYY, normalizeToYMD, parseYMD } from '../utils/dateUtils';
import {
  ArrowUp,
  Sparkles,
  RefreshCw,
  Calendar,
  CalendarDays,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  Armchair,
  X,
  Clock
} from 'lucide-react';

interface ProductionDashboardProps {
  orders: Order[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectOrder?: (order: Order) => void;
  onNavigateToReadyGoods?: () => void;
  onNavigateToReadyStock?: () => void;
}

const StatTile: React.FC<{
  label: string;
  value: string;
  sub: string;
  accent?: 'amber';
  onClick?: () => void;
}> = ({ label, value, sub, accent, onClick }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className="group relative text-left bg-white rounded-2xl border border-slate-200/80 px-4 sm:px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.18)] transition-all cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
  >
    <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
      {accent === 'amber' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      {label}
    </div>
    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
    <div className="mt-1 text-xs text-slate-400">{sub}</div>
  </button>
);

const Disclosure: React.FC<{
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, open, onToggle, children }) => (
  <section>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/80 px-5 py-4 text-left cursor-pointer transition-colors"
      aria-expanded={open}
    >
      <span>
        <span className="block text-base font-semibold text-slate-900">{title}</span>
        <span className="block text-[13px] text-slate-500 mt-0.5">{subtitle}</span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500 shrink-0">
        {open ? 'Hide' : 'Show'}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </span>
    </button>
    {open && <div className="mt-4">{children}</div>}
  </section>
);

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({
  orders,
  onRefresh,
  isRefreshing = false,
  onSelectOrder,
  onNavigateToReadyGoods,
  onNavigateToReadyStock
}) => {
  // Final QC sheet records state
  const [qcRecords, setQcRecords] = useState<FinalQcRecord[]>([]);
  const [loadingQc, setLoadingQc] = useState<boolean>(true);
  const [qcError, setQcError] = useState<string | null>(null);

  // Dispatch response sheet records state
  const [dispatchRecords, setDispatchRecords] = useState<DispatchRecord[]>([]);
  const [loadingDispatch, setLoadingDispatch] = useState<boolean>(true);
  const [showDispatchDrawer, setShowDispatchDrawer] = useState<boolean>(false);
  const [dispatchSearchTerm, setDispatchSearchTerm] = useState<string>('');

  // Month selector (format: YYYY-MM, e.g. "2026-09")
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  
  // Customizable production target (defaults to 1400)
  const [customTarget, setCustomTarget] = useState<number | null>(null);
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>('1400');

  // Submissions drill-down drawer state
  const [showBatchDrawer, setShowBatchDrawer] = useState<boolean>(false);
  const [batchFilterStatus, setBatchFilterStatus] = useState<'all' | 'pass' | 'rejected'>('all');
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');

  // Chairs in Queue drill-down drawer state
  const [showQueueDrawer, setShowQueueDrawer] = useState<boolean>(false);
  const [queueFilterCategory, setQueueFilterCategory] = useState<'all' | 'current' | 'backlog' | 'next' | 'hold'>('current');
  const [queueSearchTerm, setQueueSearchTerm] = useState<string>('');

  // Response archive scopes: 'month' (selected month) or 'all' (all recorded responses)
  const [qcViewScope, setQcViewScope] = useState<'month' | 'all'>('month');
  const [dispatchViewScope, setDispatchViewScope] = useState<'month' | 'all'>('month');

  // Ready goods items from Google Sheet (Col X to BB)
  const [readyGoodsItems, setReadyGoodsItems] = useState<ReadyGoodItem[]>([]);
  // Ready stock items from dedicated Ready Stock Sheet (for sales purpose)
  const [readyStockItems, setReadyStockItems] = useState<ReadyStockItem[]>(getCachedReadyStock());
  // Modal for QC Passed, Not Dispatched OPF reconciliation drilldown
  const [showQcPassedNotDispatchedModal, setShowQcPassedNotDispatchedModal] = useState<boolean>(false);
  const [reconciliationFilter, setReconciliationFilter] = useState<'pending' | 'dispatched' | 'all'>('pending');
  const [reconciliationSearch, setReconciliationSearch] = useState<string>('');

  // Dashboard Sub-Tab: 'overview' | 'daily' | 'onTime'
  const [activeDashboardSubTab, setActiveDashboardSubTab] = useState<'overview' | 'daily' | 'onTime'>('overview');

  // Collapsible sections (kept closed by default for a calmer page)
  const [showAI, setShowAI] = useState<boolean>(false);
  const [showTrends, setShowTrends] = useState<boolean>(false);
  const [showAudit, setShowAudit] = useState<boolean>(false);

  // Fetch Final QC records and Dispatch records on mount or refresh
  const loadQcData = async (force = false) => {
    setLoadingQc(true);
    setLoadingDispatch(true);
    setQcError(null);
    try {
      const [records, dispatches, readyGoods, readyStock] = await Promise.all([
        fetchFinalQcRecords(force),
        fetchDispatchRecords(force),
        fetchReadyGoodsData(force),
        fetchReadyStockData(force),
      ]);
      setQcRecords(records);
      setDispatchRecords(dispatches);
      setReadyGoodsItems(readyGoods);
      setReadyStockItems(readyStock);
      if (records.length > 0) {
        const available = Array.from(new Set(records.map(r => r.monthKey).filter(Boolean)))
          .filter(m => m >= '2025-04')
          .sort();
        if (available.length > 0) {
          const latest = available[available.length - 1];
          setSelectedMonth(prev => (prev < '2025-04' || (prev === '2026-09' && !records.some(r => r.monthKey === '2026-09'))) ? latest : prev);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Final QC responses or Dispatch records:', err);
      setQcError(err?.message || 'Could not load Final QC data');
    } finally {
      setLoadingQc(false);
      setLoadingDispatch(false);
    }
  };

  useEffect(() => {
    loadQcData();
  }, []);

  const handleFullRefresh = () => {
    loadQcData(true);
    if (onRefresh) onRefresh();
  };

  // Month parsing
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0], 10) || 2026, parseInt(parts[1], 10) || 8];
  }, [selectedMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const selectedMonthDisplay = `${monthNames[selectedMonthNum - 1] || ''}-${selectedYear}`;
  const totalDaysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();

  // Next month info
  const nextMonthNum = selectedMonthNum === 12 ? 1 : selectedMonthNum + 1;
  const nextYearNum = selectedMonthNum === 12 ? selectedYear + 1 : selectedYear;
  const nextMonthDisplay = `${monthNamesShort[nextMonthNum - 1]}-${nextYearNum}`;
  const nextPrefix = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}`;

  // Current system date reference (dynamically determined from current system date)
  const todayYMD = useMemo(() => {
    try {
      const now = new Date();
      if (!isNaN(now.getTime())) {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
    return '2026-09-05';
  }, []);
  const todayParsed = parseYMD(todayYMD) || { year: 2026, month: 9, day: 5 };
  
  const isCurrentMonth = selectedYear === todayParsed.year && selectedMonthNum === todayParsed.month;
  const isPastMonth = selectedYear < todayParsed.year || (selectedYear === todayParsed.year && selectedMonthNum < todayParsed.month);

  const currentDay = isCurrentMonth ? Math.min(todayParsed.day, totalDaysInMonth) : totalDaysInMonth;
  const daysRemaining = isCurrentMonth ? Math.max(0, totalDaysInMonth - currentDay + 1) : (isPastMonth ? 0 : totalDaysInMonth);
  // Formula requested by user: =Actual production per day / (TODAY()-1-EOMONTH(TODAY(),-1)), 0
  // Calculates completed full days through yesterday for higher operational accuracy
  const completedDaysYesterday = isCurrentMonth 
    ? Math.max(0, currentDay - 1) 
    : (isPastMonth ? totalDaysInMonth : 0);
  const daysElapsed = isCurrentMonth ? Math.max(1, currentDay) : totalDaysInMonth;

  // Monthly Target
  const productionTarget = customTarget !== null ? customTarget : getMonthlyTarget(selectedMonth);

  // Clamp selectedMonth if it is ever set to before Apr-2025
  useEffect(() => {
    if (selectedMonth < '2025-04') {
      setSelectedMonth('2026-09');
    }
  }, [selectedMonth]);

  // Filter QC records for the selected month
  const selectedMonthQcRecords = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`;
    return qcRecords.filter((r) => r.monthKey === prefix);
  }, [qcRecords, selectedYear, selectedMonthNum]);

  // Available months list strictly from live QC records, dispatch records, and orders
  // Strictly filtered from 'Apr-2025' (2025-04) onwards for Production Dashboard
  const availableMonths = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(MANUAL_MONTHLY_DATA_BEFORE_AUG_2025),
      ...Object.keys(HISTORICAL_MONTHLY_DISPATCHED),
    ]);
    qcRecords.forEach(r => { if (r.monthKey && r.monthKey >= '2025-04') set.add(r.monthKey); });
    dispatchRecords.forEach(d => { if (d.monthKey && d.monthKey >= '2025-04') set.add(d.monthKey); });
    orders.forEach(o => {
      if (o.dispatchDate) {
        const ymd = normalizeToYMD(o.dispatchDate);
        if (ymd && ymd.slice(0, 7) >= '2025-04') set.add(ymd.slice(0, 7));
      }
    });
    const filtered = Array.from(set).filter(m => m >= '2025-04').sort().reverse();
    if (filtered.length === 0) filtered.push('2026-09');
    return filtered;
  }, [qcRecords, dispatchRecords, orders]);

  // Core Production Calculations from Final QC Response Sheet
  const liveProducedTillDate = useMemo(() => {
    // If selected month is before Aug 2025 and has manual baseline, use it
    if (MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[selectedMonth]) {
      return MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[selectedMonth].achieved;
    }
    let sum = 0;
    selectedMonthQcRecords.forEach((r) => {
      if (r.status === 'Pass' || r.passQuantity > 0) {
        sum += r.passQuantity;
      }
    });
    return sum;
  }, [selectedMonth, selectedMonthQcRecords]);

  // OPF-by-OPF QC Passed vs Dispatched Reconciliation for selected month
  const qcReconciliation: QcMonthReconciliation = useMemo(() => {
    return calculateQcPassedDispatchedReconciliation(
      selectedMonth,
      selectedMonthQcRecords,
      dispatchRecords,
      orders
    );
  }, [selectedMonth, selectedMonthQcRecords, dispatchRecords, orders]);

  // On-Time Delivery Performance Metrics (Column G scheduled dispatch date vs Final QC pass timestamp)
  const onTimeMetrics = useMemo(() => {
    return calculateOnTimePerformance(orders, qcRecords, todayYMD);
  }, [orders, qcRecords, todayYMD]);

  // Dispatched, In-Queue, and Ready Goods Calculations strictly computed from PMS live sheet and Final QC responses
  // SPECIFICATION:
  // - Total Qty: Column C (order.quantity)
  // - Final QC Qty Pass: Column AZ (finalQcQtyPass or Step 9 Quality Control qtyPass)
  // - QC Status: Col BA / Step 9 Status (MUST BE <> "Pass" to remain in queue)
  // - If QC Status == "Pass", or Qty Pass >= Total Qty, or status is Dispatched: remaining in queue = 0 (considered done)
  // - Remaining In Queue per order (when <> Pass): Math.max(0, Total Qty - Qty Pass)
  // - Current Month In Queue: Orders whose dispatch date falls in the selected month (YYYY-MM)
  // - Next Month Chairs: Orders whose dispatch date falls in the next month
  // - Backlog: Orders whose dispatch date is before selected month, or on HOLD / unassigned date with queue > 0
  // - Total Chairs in Queue: Current Month + Backlog + Next Month
  const queueOrdersData = useMemo(() => {
    const currentPrefix = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`;
    const nextPrefix = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}`;

    // Map of OPF -> Dispatched quantity from Dispatch Response sheet
    const dispatchByOpf = new Map<string, number>();
    dispatchRecords.forEach((d) => {
      dispatchByOpf.set(d.opfNo, (dispatchByOpf.get(d.opfNo) || 0) + d.quantity);
    });

    const detailedOrders: Array<{
      order: Order;
      opfNo: string;
      modelName: string;
      dispatchDate: string | null;
      dispatchYMD: string | null;
      totalQty: number; // Col C
      qtyPass: number; // Col AZ
      qcStatus: string; // Col AV / BA / Step 9 Status
      remainingQueue: number; // Col C - Col AZ (when <> Pass)
      category: 'current' | 'next' | 'backlog' | 'hold' | 'future' | 'completed';
      currentStage: string;
      overallStatus: string;
    }> = [];

    let inQueueCurrentMonth = 0;
    let nextMonthChairs = 0;
    let backlogChairs = 0;
    let holdChairs = 0;
    let holdOrdersCount = 0;
    let otherFutureChairs = 0;
    let dispatchedThisMonth = 0;
    let readyGoodsUnits = 0;
    let readyStockUnits = 0;

    orders.forEach((order) => {
      const orderDispYMD = order.dispatchDate ? normalizeToYMD(order.dispatchDate) : null;
      const dispatchedQtyFromSheet = dispatchByOpf.get(order.opfNo) || 0;
      const isDispatched = order.overallStatus === 'Dispatched' || 
        !!order.isArchived || 
        (dispatchedQtyFromSheet >= (order.quantity || 0) && (order.quantity || 0) > 0);
      const totalQty = Math.max(0, order.quantity || 0);

      // Check if order is on Hold
      const isHold = order.overallStatus === 'On Hold' || 
        (order.dispatchDate ? order.dispatchDate.toUpperCase().includes('HOLD') : false) ||
        (!order.dispatchDate && order.steps.some(s => s.remarks && s.remarks.toUpperCase().includes('HOLD')));

      // Dispatched in this month (from PMS order dates)
      if (isDispatched && orderDispYMD && orderDispYMD.startsWith(currentPrefix)) {
        dispatchedThisMonth += totalQty;
      }

      // Ready Goods / Stock
      if (order.overallStatus === 'Ready' || order.currentStage === 'PACKING' || order.currentStage === 'DISPATCH') {
        readyGoodsUnits += totalQty;
      }
      if (order.overallStatus === 'Dispatched' || (order.steps.find((s) => s.name === 'PICTURE SHARING')?.status === 'Completed')) {
        readyStockUnits += totalQty;
      }

      // Live PMS Step 9 QC Qty Pass (Col AZ) & QC Status (Col BA / Step 9 Status)
      const qcStep = order.steps.find((s) => s.name === 'QUALITY CONTROL');
      const qtyPass = qcStep?.qtyPass ?? order.finalQcQtyPass ?? 0;
      const qcStatus = (order.finalQcStatus || qcStep?.status || 'Pending').trim();
      const isQcPassed = qcStatus.toLowerCase() === 'pass' || (qtyPass >= totalQty && totalQty > 0);

      let remainingQueue = 0;
      let category: 'current' | 'next' | 'backlog' | 'hold' | 'future' | 'completed' = 'completed';

      if (!isDispatched) {
        if (totalQty <= 0 || isQcPassed) {
          remainingQueue = 0;
          category = 'completed';
        } else if (isHold) {
          // Status is <> "Pass" but order is on HOLD: isolated from standard in-queue backlog/current metrics
          remainingQueue = Math.max(0, totalQty - qtyPass);
          category = 'hold';
          holdChairs += remainingQueue;
          holdOrdersCount += 1;
        } else {
          // Status is <> "Pass": calculate remaining in queue = Total (Col C) - Pass (Col AZ)
          remainingQueue = Math.max(0, totalQty - qtyPass);

          if (remainingQueue === 0) {
            category = 'completed';
          } else if (!orderDispYMD || orderDispYMD < `${currentPrefix}-01`) {
            // Overdue past date and NOT on hold -> Backlog!
            category = 'backlog';
            backlogChairs += remainingQueue;
          } else if (orderDispYMD.startsWith(currentPrefix)) {
            category = 'current';
            inQueueCurrentMonth += remainingQueue;
          } else if (orderDispYMD.startsWith(nextPrefix)) {
            category = 'next';
            nextMonthChairs += remainingQueue;
          } else {
            category = 'future';
            otherFutureChairs += remainingQueue;
          }
        }
      }

      if (remainingQueue > 0 || !isDispatched || isHold) {
        detailedOrders.push({
          order,
          opfNo: order.opfNo,
          modelName: order.modelName || 'Model Standard',
          dispatchDate: order.dispatchDate,
          dispatchYMD: orderDispYMD,
          totalQty,
          qtyPass,
          qcStatus,
          remainingQueue,
          category,
          currentStage: order.currentStage || 'Pending',
          overallStatus: isHold ? 'On Hold' : order.overallStatus,
        });
      }
    });

    // From July 2026 onwards, calculate Dispatched This Month directly from Dispatch Response Google Sheet
    const dispatchUnitsFromSheetForMonth = dispatchRecords
      .filter((r) => r.monthKey === currentPrefix)
      .reduce((acc, r) => acc + r.quantity, 0);

    let effectiveDispatchedThisMonth = 0;
    if (MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[currentPrefix]) {
      effectiveDispatchedThisMonth = MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[currentPrefix].dispatched;
    } else if (HISTORICAL_MONTHLY_DISPATCHED[currentPrefix] !== undefined) {
      effectiveDispatchedThisMonth = HISTORICAL_MONTHLY_DISPATCHED[currentPrefix];
    } else if (currentPrefix >= '2026-07' && dispatchRecords.length > 0) {
      effectiveDispatchedThisMonth = dispatchUnitsFromSheetForMonth;
    } else {
      effectiveDispatchedThisMonth = dispatchedThisMonth;
    }

    const currentMonthPlusBacklog = inQueueCurrentMonth + backlogChairs;
    // Total Chairs in Queue = Current Month + Backlog + Next Month
    const totalChairsInQueue = inQueueCurrentMonth + backlogChairs + nextMonthChairs;
    
    // OPF-level reconciliation calculation:
    // If QC passed records exist for this month, use OPF-level reconciliation count
    // Otherwise fallback to Math.max(0, liveProducedTillDate - effectiveDispatchedThisMonth)
    const qcPassedNotDispatched = qcReconciliation.totalQcPassedOpfs > 0
      ? qcReconciliation.notDispatchedUnits
      : Math.max(0, liveProducedTillDate - effectiveDispatchedThisMonth);

    return {
      detailedOrders,
      dispatchedThisMonth: effectiveDispatchedThisMonth,
      inQueueCurrent: inQueueCurrentMonth,
      nextMonthChairs,
      backlogChairs,
      holdChairs,
      holdOrdersCount,
      currentMonthPlusBacklog,
      totalChairsInQueue,
      readyGoodsUnits,
      readyStockUnits,
      qcPassedNotDispatched,
    };
  }, [orders, selectedYear, selectedMonthNum, nextYearNum, nextMonthNum, liveProducedTillDate, dispatchRecords, qcReconciliation]);

  const floorMetrics = queueOrdersData;

  // Derived Target vs Achievement Metrics
  const targetPerDay = Math.round(productionTarget / totalDaysInMonth);
  // Actual Produced Per Day using user's formula:
  // =Actual production till date / (TODAY()-1-EOMONTH(TODAY(),-1)), 0
  const actualPerDay = completedDaysYesterday > 0 ? Math.round(liveProducedTillDate / completedDaysYesterday) : 0;
  
  const pctTargetAchieved = productionTarget > 0 
    ? ((liveProducedTillDate / productionTarget) * 100).toFixed(0) 
    : '0';
    
  const pctProducedTillDate = productionTarget > 0 
    ? ((liveProducedTillDate / productionTarget) * 100).toFixed(1) 
    : '0.0';

  const shortfall = Math.max(0, productionTarget - liveProducedTillDate);
  const pctShortfall = productionTarget > 0 
    ? ((shortfall / productionTarget) * 100).toFixed(1) 
    : '100.0';

  const newTargetPerDay = daysRemaining > 0 ? Math.ceil(shortfall / daysRemaining) : 0;
  const increaseRequiredUnits = Math.max(0, newTargetPerDay - actualPerDay);
  const pctIncreaseRequired = actualPerDay > 0 
    ? `${Math.round(((newTargetPerDay - actualPerDay) / actualPerDay) * 100)}%` 
    : 'No data';

  const pctDispatched = liveProducedTillDate > 0 
    ? `${Math.round((floorMetrics.dispatchedThisMonth / liveProducedTillDate) * 100)}%` 
    : 'No data';

  // Build Monthly Performance Table strictly from real sheet data starting from Apr-2025
  const monthlyAggregates = useMemo(() => {
    return buildMonthlyAggregates(qcRecords, orders, dispatchRecords, '2025-04');
  }, [qcRecords, orders, dispatchRecords]);

  // Grand Totals Calculation for Historical Table strictly computed from table aggregates
  const grandTotals = useMemo(() => {
    const totTarget = monthlyAggregates.reduce((acc, row) => acc + row.target, 0);
    const totAchieved = monthlyAggregates.reduce((acc, row) => acc + row.achieved, 0);
    const totDispatched = monthlyAggregates.reduce((acc, row) => acc + row.dispatched, 0);

    const achPct = totTarget > 0 ? Math.round((totAchieved / totTarget) * 100) : 0;
    const dispPct = totAchieved > 0 ? Math.round((totDispatched / totAchieved) * 100) : 0;

    return {
      target: totTarget,
      achieved: totAchieved,
      achPct,
      dispatched: totDispatched,
      dispPct
    };
  }, [monthlyAggregates]);

  const handleSaveTarget = () => {
    const val = parseInt(targetInput, 10);
    if (!isNaN(val) && val > 0) {
      setCustomTarget(val);
      setIsEditingTarget(false);
    }
  };

  // Filtered batch records for drilldown drawer (supports selected month or all responses)
  const filteredBatchRecords = useMemo(() => {
    const sourceRecords = qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords;
    return sourceRecords.filter((rec) => {
      if (batchFilterStatus === 'pass' && rec.status !== 'Pass') return false;
      if (batchFilterStatus === 'rejected' && rec.status !== 'Rejected') return false;
      if (batchSearchTerm) {
        const query = batchSearchTerm.toLowerCase();
        const matchOpf = (rec.opfNo || '').toLowerCase().includes(query);
        const matchInsp = (rec.qcInspector || '').toLowerCase().includes(query);
        const matchRem = (rec.passRemarks || '').toLowerCase().includes(query);
        const matchFactory = (rec.factoryNo || '').toLowerCase().includes(query);
        if (!matchOpf && !matchInsp && !matchRem && !matchFactory) return false;
      }
      return true;
    });
  }, [qcViewScope, qcRecords, selectedMonthQcRecords, batchFilterStatus, batchSearchTerm]);

  // Filtered queue orders for In-Queue drilldown drawer
  const filteredQueueOrders = useMemo(() => {
    return floorMetrics.detailedOrders.filter((item) => {
      if (queueFilterCategory === 'current' && item.category !== 'current') return false;
      if (queueFilterCategory === 'backlog' && item.category !== 'backlog') return false;
      if (queueFilterCategory === 'next' && item.category !== 'next') return false;
      if (queueFilterCategory === 'hold' && item.category !== 'hold') return false;
      if (queueFilterCategory === 'all' && (item.category === 'completed' || item.category === 'hold')) return false;

      if (queueSearchTerm) {
        const q = queueSearchTerm.toLowerCase();
        const matchOpf = (item.opfNo || '').toLowerCase().includes(q);
        const matchModel = (item.modelName || '').toLowerCase().includes(q);
        const matchStage = (item.currentStage || '').toLowerCase().includes(q);
        if (!matchOpf && !matchModel && !matchStage) return false;
      }
      return true;
    });
  }, [floorMetrics.detailedOrders, queueFilterCategory, queueSearchTerm]);

  // Filtered dispatch records for Dispatch Response drilldown drawer
  const selectedMonthDispatchRecords = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`;
    return dispatchRecords.filter((r) => r.monthKey === prefix);
  }, [dispatchRecords, selectedYear, selectedMonthNum]);

  const filteredDispatchRecords = useMemo(() => {
    const sourceRecords = dispatchViewScope === 'all' ? dispatchRecords : selectedMonthDispatchRecords;
    return sourceRecords.filter((item) => {
      if (dispatchSearchTerm) {
        const q = dispatchSearchTerm.toLowerCase();
        const matchTs = (item.timestamp || '').toLowerCase().includes(q);
        const matchQty = String(item.quantity || '').includes(q);
        const matchOpf = item.opfNo ? item.opfNo.toLowerCase().includes(q) : false;
        const matchModel = item.modelName ? item.modelName.toLowerCase().includes(q) : false;
        if (!matchTs && !matchQty && !matchOpf && !matchModel) return false;
      }
      return true;
    });
  }, [dispatchViewScope, dispatchRecords, selectedMonthDispatchRecords, dispatchSearchTerm]);

  // Filtered OPF reconciliation items for the QC Passed, Not Dispatched drilldown modal
  const filteredReconciliationItems = useMemo(() => {
    return qcReconciliation.items.filter((item) => {
      if (reconciliationFilter === 'pending' && item.status === 'Dispatched') return false;
      if (reconciliationFilter === 'dispatched' && item.status !== 'Dispatched') return false;

      if (reconciliationSearch.trim()) {
        const q = reconciliationSearch.toLowerCase();
        const matchOpf = (item.opfNo || '').toLowerCase().includes(q);
        const matchModel = (item.modelName || '').toLowerCase().includes(q);
        const matchCust = (item.customerName || '').toLowerCase().includes(q);
        const matchInspector = (item.qcInspector || '').toLowerCase().includes(q);
        const matchRemarks = (item.qcRemarks || '').toLowerCase().includes(q);
        const matchFactory = (item.factoryNo || '').toLowerCase().includes(q);
        if (!matchOpf && !matchModel && !matchCust && !matchInspector && !matchRemarks && !matchFactory) return false;
      }
      return true;
    });
  }, [qcReconciliation.items, reconciliationFilter, reconciliationSearch]);

  // Stage Bottlenecks calculated from live PMS orders
  const plantBottlenecks = useMemo(() => {
    const stageMap: Record<string, { orders: number; units: number; responsible: string }> = {};
    orders.forEach(o => {
      if (o.overallStatus === 'WIP' && o.currentStage) {
        if (!stageMap[o.currentStage]) {
          stageMap[o.currentStage] = {
            orders: 0,
            units: 0,
            responsible: o.currentResponsible || 'Stage Lead',
          };
        }
        stageMap[o.currentStage].orders += 1;
        stageMap[o.currentStage].units += (o.quantity || 1);
      }
    });
    return Object.keys(stageMap)
      .map(stage => ({
        stage,
        orders: stageMap[stage].orders,
        units: stageMap[stage].units,
        responsible: stageMap[stage].responsible,
      }))
      .sort((a, b) => b.orders - a.orders);
  }, [orders]);

  // Projected month-end output at current pace
  const projectedOutput = Math.round(liveProducedTillDate + (actualPerDay * daysRemaining));

  // Comprehensive AI Plant Context
  const plantContext: AIPlantContext = useMemo(() => {
    return {
      selectedMonth,
      target: productionTarget,
      achievedQcPassed: liveProducedTillDate,
      achievementPct: parseFloat(pctTargetAchieved) || 0,
      workingDaysTotal: totalDaysInMonth,
      workingDaysElapsed: daysElapsed,
      workingDaysRemaining: daysRemaining,
      dailyAvgPace: actualPerDay,
      dailyRequiredPace: newTargetPerDay,
      dailyPaceDelta: actualPerDay - newTargetPerDay,
      projectedUnits: projectedOutput,
      totalFloorQueueOrders: floorMetrics.detailedOrders.length,
      totalFloorQueueUnits: floorMetrics.totalChairsInQueue,
      currentMonthQueueUnits: floorMetrics.inQueueCurrent,
      backlogOrdersUnits: floorMetrics.backlogChairs,
      nextMonthAdvanceUnits: floorMetrics.nextMonthChairs,
      holdOrdersCount: floorMetrics.holdOrdersCount,
      holdOrdersUnits: floorMetrics.holdChairs,
      dispatchedMonthlyTotal: floorMetrics.dispatchedThisMonth,
      readyGoodsUnits: floorMetrics.readyGoodsUnits,
      readyStockUnits: readyStockItems.reduce((acc, i) => acc + (i.qty || 0), 0),
      qcPassedNotDispatchedUnits: floorMetrics.qcPassedNotDispatched,
      bottleneckStages: plantBottlenecks,
    };
  }, [
    selectedMonth,
    productionTarget,
    liveProducedTillDate,
    pctTargetAchieved,
    totalDaysInMonth,
    daysElapsed,
    daysRemaining,
    actualPerDay,
    newTargetPerDay,
    projectedOutput,
    floorMetrics,
    readyStockItems,
    plantBottlenecks,
  ]);

  // AI Suggestions Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<ProductionAIAnalysis>(() => computeBaselineHeuristicAnalysis(plantContext));
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);

  // Synchronize baseline analysis with updated plant context
  useEffect(() => {
    setAiAnalysis(computeBaselineHeuristicAnalysis(plantContext));
  }, [plantContext]);

  const handleRunDeepAIAnalysis = useCallback(async () => {
    setIsAnalyzingAI(true);
    try {
      const result = await generateProductionAIAnalysis(plantContext);
      setAiAnalysis(result);
    } catch (err) {
      console.error('Error generating AI analysis:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  }, [plantContext]);

  // Plain-language pace status for the target card
  const pace = (() => {
    const met = productionTarget > 0 && liveProducedTillDate >= productionTarget;
    if (met) return { label: 'Target reached', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    if (daysRemaining === 0) return { label: 'Month closed short', pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', bar: 'bg-rose-500' };
    if (actualPerDay >= newTargetPerDay) return { label: 'On pace', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    if (actualPerDay >= newTargetPerDay * 0.85) return { label: 'Slightly behind', pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', bar: 'bg-amber-400' };
    return { label: 'Behind pace', pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', bar: 'bg-rose-500' };
  })();

  const queueSegments = [
    { key: 'current' as const, label: 'This month', hint: `${monthNamesShort[selectedMonthNum - 1]}`, value: floorMetrics.inQueueCurrent, color: 'bg-indigo-500' },
    { key: 'backlog' as const, label: 'Overdue backlog', hint: '', value: floorMetrics.backlogChairs, color: 'bg-rose-400' },
    { key: 'next' as const, label: 'Next month', hint: nextMonthDisplay, value: floorMetrics.nextMonthChairs, color: 'bg-slate-300' },
  ];
  const queueTotalForBar = Math.max(1, queueSegments.reduce((a, x) => a + x.value, 0));

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Toolbar: sub-views + month */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
          {([
            { id: 'overview', label: 'This month' },
            { id: 'daily', label: 'Daily steps' },
            { id: 'onTime', label: `On-time delivery · ${onTimeMetrics.overallUnitOnTimePct}%` },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveDashboardSubTab(t.id)}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeDashboardSubTab === t.id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2 transition-colors self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer"
            title="Select production month"
          >
            {availableMonths.map((m) => {
              const [y, mon] = m.split('-');
              return (
                <option key={m} value={m}>
                  {monthNamesShort[parseInt(mon, 10) - 1]} {y}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* RENDER ACTIVE SUB-TAB VIEW */}
      {activeDashboardSubTab === 'daily' ? (
        <DailyProductionStepView
          selectedMonth={selectedMonth}
          selectedMonthDisplay={selectedMonthDisplay}
          productionTarget={productionTarget}
          orders={orders}
          qcRecords={qcRecords}
          dispatchRecords={dispatchRecords}
          onSelectOrder={onSelectOrder}
          onBackToOverview={() => setActiveDashboardSubTab('overview')}
        />
      ) : activeDashboardSubTab === 'onTime' ? (
        <OnTimePerformanceView
          onTimeMetrics={onTimeMetrics}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
        />
      ) : (
        <>
      <div className="space-y-6">
          {/* TARGET HERO */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-medium text-slate-500">{selectedMonthDisplay} · Chairs passed final QC</h2>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${pace.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pace.dot}`} />
                    {pace.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <span className="text-5xl sm:text-6xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {liveProducedTillDate.toLocaleString()}
                  </span>
                  <span className="text-lg text-slate-400">of</span>
                  {isEditingTarget ? (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        autoFocus
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTarget(); }}
                        className="w-28 bg-white border border-slate-300 text-lg font-semibold px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleSaveTarget}
                        className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
                      >
                        Save
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setIsEditingTarget(true)}
                      className="text-2xl font-medium text-slate-500 tabular-nums hover:text-slate-900 underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-pointer"
                      title="Click to change the monthly target"
                    >
                      {productionTarget.toLocaleString()}
                    </button>
                  )}
                </div>

                <div className="mt-5 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pace.bar}`}
                    style={{ width: `${Math.min(100, parseFloat(pctProducedTillDate) || 0)}%` }}
                  />
                </div>
                <p className="mt-2.5 text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">{pctTargetAchieved}%</span> of target
                  {shortfall > 0 ? <> · {shortfall.toLocaleString()} still to go</> : <> · target reached</>}
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-6 lg:gap-8 lg:pl-8 lg:border-l border-slate-100 shrink-0">
                <div>
                  <dt className="text-xs font-medium text-slate-400">Daily pace</dt>
                  <dd className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{actualPerDay}</dd>
                  <dd className="text-xs text-slate-400">
                    {daysRemaining > 0 && shortfall > 0 ? `need ${newTargetPerDay}/day` : `target ${targetPerDay}/day`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">Days left</dt>
                  <dd className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{daysRemaining}</dd>
                  <dd className="text-xs text-slate-400">of {totalDaysInMonth}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">Projected</dt>
                  <dd className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{projectedOutput.toLocaleString()}</dd>
                  <dd className="text-xs text-slate-400">by month end</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* KEY NUMBERS */}
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <StatTile
              label="In queue"
              value={floorMetrics.totalChairsInQueue.toLocaleString()}
              sub="chairs waiting"
              onClick={() => { setQueueFilterCategory('all'); setShowQueueDrawer(true); }}
            />
            <StatTile
              label="Dispatched"
              value={floorMetrics.dispatchedThisMonth.toLocaleString()}
              sub={pctDispatched === 'No data' ? 'this month' : `${pctDispatched} of produced`}
              onClick={() => setShowDispatchDrawer(true)}
            />
            <StatTile
              label="Passed QC, not sent"
              value={floorMetrics.qcPassedNotDispatched.toLocaleString()}
              sub={`${qcReconciliation.notDispatchedOpfs} orders`}
              accent={floorMetrics.qcPassedNotDispatched > 0 ? 'amber' : undefined}
              onClick={() => setShowQcPassedNotDispatchedModal(true)}
            />
            <StatTile
              label="Ready goods"
              value={(readyGoodsItems.length > 0 ? readyGoodsItems.reduce((a, i) => a + i.readyGoodsQty, 0) : 461).toLocaleString()}
              sub="open list"
              onClick={onNavigateToReadyGoods}
            />
            <StatTile
              label="Ready stock"
              value={(readyStockItems.length > 0 ? readyStockItems.reduce((a, i) => a + i.qty, 0) : 91).toLocaleString()}
              sub="open list"
              onClick={onNavigateToReadyStock}
            />
          </section>

          {/* QUEUE BREAKDOWN */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Chairs in queue</h2>
              <span className="text-sm text-slate-500 tabular-nums">{floorMetrics.totalChairsInQueue.toLocaleString()} total</span>
            </div>
            <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-slate-100">
              {queueSegments.map(s => s.value > 0 && (
                <div key={s.key} className={s.color} style={{ width: `${(s.value / queueTotalForBar) * 100}%` }} title={`${s.label}: ${s.value}`} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {queueSegments.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setQueueFilterCategory(s.key); setShowQueueDrawer(true); }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    {s.label}
                    <span className="text-xs text-slate-400">{s.hint}</span>
                  </span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">{s.value.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </section>

          {/* AI RECOMMENDATIONS (collapsed) */}
          <Disclosure
            title="AI recommendations"
            subtitle="Suggested actions to hit the target"
            open={showAI}
            onToggle={() => setShowAI(v => !v)}
          >
            <ProductionAIAdvisor
              plantContext={plantContext}
              analysis={aiAnalysis}
              isLoading={isAnalyzingAI}
              onRefreshAnalysis={handleRunDeepAIAnalysis}
            />
          </Disclosure>

          {/* TRENDS & HISTORY (collapsed) */}
          <Disclosure
            title="Trends & monthly history"
            subtitle="Charts and month-by-month table"
            open={showTrends}
            onToggle={() => setShowTrends(v => !v)}
          >
            <div className="space-y-6">
              <ProductionChartsSection
                selectedMonth={selectedMonth}
                selectedMonthDisplay={selectedMonthDisplay}
                productionTarget={productionTarget}
                liveProducedTillDate={liveProducedTillDate}
                actualPerDay={actualPerDay}
                newTargetPerDay={newTargetPerDay}
                targetPerDay={targetPerDay}
                pctTargetAchieved={pctTargetAchieved}
                shortfall={shortfall}
                projectedOutput={projectedOutput}
                daysRemaining={daysRemaining}
                daysElapsed={daysElapsed}
                totalDaysInMonth={totalDaysInMonth}
                monthlyAggregates={monthlyAggregates}
                onTimeSummaries={onTimeMetrics.monthlySummaries}
                queueMetrics={{
                  inQueueCurrent: floorMetrics.inQueueCurrent,
                  backlogChairs: floorMetrics.backlogChairs,
                  nextMonthChairs: floorMetrics.nextMonthChairs,
                  holdChairs: floorMetrics.holdChairs,
                  readyGoodsUnits: floorMetrics.readyGoodsUnits,
                  readyStockUnits: readyStockItems.reduce((acc, i) => acc + (i.qty || 0), 0),
                  dispatchedThisMonth: floorMetrics.dispatchedThisMonth
                }}
                bottleneckStages={plantBottlenecks}
                onViewOnTimeTab={() => setActiveDashboardSubTab('onTime')}
                onViewDailyTab={() => setActiveDashboardSubTab('daily')}
              />

              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full min-w-[420px] text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Month</th>
                        <th className="px-4 py-2.5 font-medium text-right">Target</th>
                        <th className="px-4 py-2.5 font-medium text-right">Achieved</th>
                        <th className="px-4 py-2.5 font-medium text-right">%</th>
                        <th className="px-4 py-2.5 font-medium text-right">Dispatched</th>
                        <th className="px-4 py-2.5 font-medium text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {monthlyAggregates.map((row) => (
                        <tr
                          key={row.monthKey}
                          onClick={() => setSelectedMonth(row.monthKey)}
                          className={`cursor-pointer transition-colors ${
                            selectedMonth === row.monthKey ? 'bg-indigo-50/70 text-slate-900' : 'hover:bg-slate-50 text-slate-600'
                          }`}
                          title="Show this month"
                        >
                          <td className="px-4 py-2.5 font-medium">{row.monthDisplay}</td>
                          <td className="px-4 py-2.5 text-right">{row.target.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-slate-900">{row.achieved.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right">{row.achPct}%</td>
                          <td className="px-4 py-2.5 text-right text-slate-900">{row.dispatched.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right">{row.dispPct}%</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 text-slate-900 font-semibold sticky bottom-0">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right">{grandTotals.target.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{grandTotals.achieved.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{grandTotals.achPct}%</td>
                        <td className="px-4 py-2.5 text-right">{grandTotals.dispatched.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{grandTotals.dispPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Disclosure>

          {/* DETAILED RECORDS (collapsed; opens automatically from the tiles above) */}
          <Disclosure
            title="Detailed records"
            subtitle="QC submissions, queue orders and dispatch entries"
            open={showAudit || showBatchDrawer || showQueueDrawer || showDispatchDrawer}
            onToggle={() => {
              const next = !(showAudit || showBatchDrawer || showQueueDrawer || showDispatchDrawer);
              setShowAudit(next);
              if (!next) { setShowBatchDrawer(false); setShowQueueDrawer(false); setShowDispatchDrawer(false); }
            }}
          >
            <div className="space-y-4">
      {/* SECTION G: LIVE FINAL QC BATCH SUBMISSIONS AUDIT DRAWER (TRANSPARENCY & CALCULATION VERIFICATION) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          onClick={() => setShowBatchDrawer(!showBatchDrawer)}
          className="bg-slate-50/80 hover:bg-slate-100/80 p-4 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-200/60"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/60">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-slate-800">
              Live Final QC Response Batch Submissions {qcViewScope === 'all' ? '(All Responses)' : `(${selectedMonthDisplay})`}
            </span>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full tabular-nums font-semibold">
              {filteredBatchRecords.length} Submissions • {filteredBatchRecords.filter(r => r.status === 'Pass' || r.passQuantity > 0).reduce((acc, r) => acc + r.passQuantity, 0).toLocaleString()} Passed (Units)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>{showBatchDrawer ? 'Hide Details' : 'View All Batches'}</span>
            {showBatchDrawer ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {showBatchDrawer && (
          <div className="p-4 bg-white space-y-3.5">
            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Scope selector: Current month vs All recorded responses */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setQcViewScope('month')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      qcViewScope === 'month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {selectedMonthDisplay} ({selectedMonthQcRecords.length})
                  </button>
                  <button
                    onClick={() => setQcViewScope('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      qcViewScope === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title="View all recorded responses in the sheet archive"
                  >
                    All Responses ({qcRecords.length})
                  </button>
                </div>

                {/* Filter by Status */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setBatchFilterStatus('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      batchFilterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({(qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords).length})
                  </button>
                  <button
                    onClick={() => setBatchFilterStatus('pass')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      batchFilterStatus === 'pass' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Passed ({(qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords).filter(r => r.status === 'Pass').length})</span>
                  </button>
                  <button
                    onClick={() => setBatchFilterStatus('rejected')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      batchFilterStatus === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rejected ({(qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords).filter(r => r.status === 'Rejected').length})</span>
                  </button>
                </div>
              </div>

              {/* Search box */}
              <div className="relative flex items-center w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Search OPF, inspector, remarks..."
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none w-full sm:w-64 focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Submissions Table */}
            {filteredBatchRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                No Final QC responses found matching the selected filters for {selectedMonthDisplay}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-xs text-left border-collapse bg-white">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600 text-xs  z-10">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">OPF No</th>
                      <th className="p-2.5">Factory</th>
                      <th className="p-2.5 text-right">Batch Qty</th>
                      <th className="p-2.5 text-right">Pass Qty</th>
                      <th className="p-2.5 text-right">Rej Qty</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Inspector</th>
                      <th className="p-2.5">Remarks / Notes</th>
                      <th className="p-2.5 text-center">Photos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    {filteredBatchRecords.map((rec, idx) => (
                      <tr key={`${rec.opfNo}-${rec.timestamp}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-slate-500 text-xs tabular-nums whitespace-nowrap">{rec.timestamp}</td>
                        <td className="p-2.5 font-semibold text-indigo-700 tabular-nums">{rec.opfNo}</td>
                        <td className="p-2.5 text-slate-600 tabular-nums">{rec.factoryNo || '-'}</td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-slate-900">{rec.totalQuantity}</td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">{rec.passQuantity}</td>
                        <td className="p-2.5 text-right tabular-nums text-rose-600">{rec.rejectedQuantity || 0}</td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            rec.status === 'Pass' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">{rec.qcInspector}</td>
                        <td className="p-2.5 text-slate-600 text-xs max-w-xs truncate" title={rec.passRemarks}>
                          {rec.passRemarks || '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {rec.productImageUrls.length > 0 ? (
                            <a
                              href={rec.productImageUrls[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 text-xs font-medium"
                            >
                              <span>{rec.productImageUrls.length} pic(s)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
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
      </div>

      {/* SECTION H: LIVE PMS CHAIRS IN QUEUE AUDIT DRAWER (EXACT FORMULA: COL C - COL AZ & STATUS <> PASS) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          onClick={() => setShowQueueDrawer(!showQueueDrawer)}
          className="bg-slate-50/80 hover:bg-slate-100/80 p-4 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-200/60"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/60">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-slate-800">
              Chairs in Queue Orders Audit
            </span>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full tabular-nums font-semibold">
              {floorMetrics.inQueueCurrent.toLocaleString()} Cur. Month • {floorMetrics.backlogChairs.toLocaleString()} Backlog • {floorMetrics.holdChairs.toLocaleString()} On Hold • {floorMetrics.nextMonthChairs.toLocaleString()} Next Month
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>{showQueueDrawer ? 'Hide Details' : 'View Queue Orders'}</span>
            {showQueueDrawer ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {showQueueDrawer && (
          <div className="p-4 bg-white space-y-3.5">
            {/* Queue Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setQueueFilterCategory('current')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    queueFilterCategory === 'current' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Current Month ({floorMetrics.inQueueCurrent.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('backlog')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    queueFilterCategory === 'backlog' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Backlog ({floorMetrics.backlogChairs.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('hold')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    queueFilterCategory === 'hold' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  ⚡ On Hold ({floorMetrics.holdChairs.toLocaleString()} Units • {floorMetrics.holdOrdersCount} Orders)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('next')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    queueFilterCategory === 'next' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Next Month ({floorMetrics.nextMonthChairs.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    queueFilterCategory === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  All In-Queue ({floorMetrics.totalChairsInQueue.toLocaleString()} Units)
                </button>
              </div>

              {/* Search box */}
              <div className="relative flex items-center w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Search OPF, model, stage..."
                  value={queueSearchTerm}
                  onChange={(e) => setQueueSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none w-full sm:w-56 focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* In-Queue Table */}
            {filteredQueueOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                No active in-queue orders found for the selected filter ({queueFilterCategory}).
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-xs text-left border-collapse bg-white">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600 text-xs  z-10">
                    <tr>
                      <th className="p-2.5">OPF No</th>
                      <th className="p-2.5">Model Name</th>
                      <th className="p-2.5">Dispatch Date</th>
                      <th className="p-2.5">Current Stage</th>
                      <th className="p-2.5 text-right">Total Qty</th>
                      <th className="p-2.5 text-right">QC Pass</th>
                      <th className="p-2.5 text-center">QC Status</th>
                      <th className="p-2.5 text-right bg-amber-50 text-amber-900 font-semibold">Remaining in Queue</th>
                      <th className="p-2.5">Queue Bucket</th>
                      <th className="p-2.5">Overall Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    {filteredQueueOrders.map((item, idx) => (
                      <tr 
                        key={`${item.opfNo}-${idx}`} 
                        onClick={() => onSelectOrder && onSelectOrder(item.order)}
                        className={`hover:bg-slate-50/80 transition-colors ${onSelectOrder ? 'cursor-pointer' : ''}`}
                        title={onSelectOrder ? 'Click to view order stage progress details' : undefined}
                      >
                        <td className="p-2.5 font-semibold text-indigo-700 tabular-nums">{item.opfNo}</td>
                        <td className="p-2.5 text-slate-900 font-medium">{item.modelName}</td>
                        <td className="p-2.5 text-slate-600 tabular-nums text-xs">{item.dispatchDate || 'HOLD'}</td>
                        <td className="p-2.5 text-slate-700">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-xs font-semibold text-slate-800">
                            {item.currentStage}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-slate-700">{item.totalQty}</td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">{item.qtyPass}</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            (item.qcStatus || '').toLowerCase() === 'pass'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : (item.qcStatus || '').toLowerCase().includes('wip')
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.qcStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-amber-950 bg-amber-50/60 text-xs">
                          {item.remainingQueue}
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-semibold  ${
                            item.category === 'current'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : item.category === 'backlog'
                              ? 'bg-rose-50 text-rose-900 border border-rose-200'
                              : item.category === 'hold'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : item.category === 'next'
                              ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.category === 'current' ? 'Current Month' : item.category === 'backlog' ? 'Backlog (Past Due)' : item.category === 'hold' ? '⚡ On Hold' : item.category === 'next' ? 'Next Month' : 'Future'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.category === 'hold'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {item.overallStatus}
                          </span>
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

      {/* 3. DISPATCH RESPONSE ENTRIES DRAWER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div
          onClick={() => setShowDispatchDrawer(!showDispatchDrawer)}
          className="bg-slate-50/80 hover:bg-slate-100/80 p-4 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-200/60"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/60">
              <Truck className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-slate-800">
              Dispatch Response Entries {dispatchViewScope === 'all' ? '(All Responses)' : `(${selectedMonthDisplay})`}
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full tabular-nums font-semibold">
              {filteredDispatchRecords.reduce((acc, r) => acc + r.quantity, 0).toLocaleString()} Boxes Dispatched • {filteredDispatchRecords.length} Entries
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>{showDispatchDrawer ? 'Hide Entries' : 'View Dispatch Entries'}</span>
            {showDispatchDrawer ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {showDispatchDrawer && (
          <div className="p-4 bg-white space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {/* Scope selector: Current month vs All recorded responses */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setDispatchViewScope('month')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      dispatchViewScope === 'month' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {selectedMonthDisplay} ({selectedMonthDispatchRecords.length})
                  </button>
                  <button
                    onClick={() => setDispatchViewScope('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      dispatchViewScope === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title="View all recorded responses in the dispatch sheet archive"
                  >
                    All Responses ({dispatchRecords.length})
                  </button>
                </div>
              </div>

              {/* Search box */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Search timestamp or boxes..."
                  value={dispatchSearchTerm}
                  onChange={(e) => setDispatchSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none w-56 focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {filteredDispatchRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                No dispatch responses found {dispatchViewScope === 'all' ? 'in sheet archive' : `for ${selectedMonthDisplay}`}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-xs text-left border-collapse bg-white">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600 text-xs  z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center">#</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5 font-semibold">OPF No.</th>
                      <th className="p-2.5 text-right">Number of Boxes / Qty</th>
                      <th className="p-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    {filteredDispatchRecords.map((item, idx) => (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-slate-400 text-xs tabular-nums text-center">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 text-slate-600 tabular-nums text-xs whitespace-nowrap">
                          {item.timestamp}
                        </td>
                        <td className="p-2.5 tabular-nums font-semibold text-indigo-700 text-xs whitespace-nowrap">
                          {item.opfNo ? (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
                              {item.opfNo}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-800 text-xs">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-slate-600 text-xs">
                          {item.modelName || `Dispatched on ${item.dateYMD}`}
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
          </Disclosure>
      </div>
      </>
      )}

      {/* QC PASSED, NOT DISPATCHED OPF RECONCILIATION MODAL */}
      {showQcPassedNotDispatchedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                    QC Passed, Not Dispatched — Order Reconciliation
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Month: {selectedMonthDisplay} • OPF-by-OPF match (Final QC Passed vs Dispatches)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQcPassedNotDispatchedModal(false)}
                className="p-1.5 rounded-xl bg-slate-200/60 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Methodology & Metric Summary Cards */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
              {/* Formula explanation */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-semibold block text-amber-900">OPF-Level Factory Inventory Methodology:</span>
                  <p className="text-xs text-slate-700 leading-snug">
                    Evaluates each OPF with Final QC completed in <strong>{selectedMonthDisplay}</strong>. Checks whether the OPF was dispatched in the same period to calculate exact units still held on the factory floor.
                  </p>
                </div>
                <div className="text-xs text-amber-900 font-semibold bg-amber-100 px-3 py-1 rounded-lg border border-amber-200 whitespace-nowrap">
                  {qcReconciliation.notDispatchedOpfs} OPF(s) Pending Dispatch
                </div>
              </div>

              {/* 3 Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-center">
                  <span className="text-xs font-semibold text-emerald-800 block">1. Total QC Passed</span>
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums text-emerald-950 block mt-0.5">
                    {qcReconciliation.totalQcPassedUnits.toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold block">
                    {qcReconciliation.totalQcPassedOpfs} OPFs inspected
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-center">
                  <span className="text-xs font-semibold text-indigo-800 block">2. Total Dispatched</span>
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums text-indigo-950 block mt-0.5">
                    {qcReconciliation.dispatchedUnits.toLocaleString()}
                  </span>
                  <span className="text-xs text-indigo-700 font-semibold block">
                    {qcReconciliation.dispatchedOpfs} OPFs shipped
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 text-center shadow-xs">
                  <span className="text-xs font-semibold text-amber-900 block">3. Left In Factory</span>
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums text-amber-950 block mt-0.5">
                    {floorMetrics.qcPassedNotDispatched.toLocaleString()}
                  </span>
                  <span className="text-xs text-amber-800 font-semibold block">
                    {qcReconciliation.notDispatchedOpfs} OPFs awaiting dispatch
                  </span>
                </div>
              </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setReconciliationFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    reconciliationFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  Pending In Factory ({qcReconciliation.notDispatchedOpfs})
                </button>
                <button
                  onClick={() => setReconciliationFilter('dispatched')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    reconciliationFilter === 'dispatched'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  Dispatched ({qcReconciliation.dispatchedOpfs})
                </button>
                <button
                  onClick={() => setReconciliationFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    reconciliationFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  All ({qcReconciliation.totalQcPassedOpfs})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search OPF, model, customer..."
                  value={reconciliationSearch}
                  onChange={(e) => setReconciliationSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 font-medium text-slate-800 transition-colors"
                />
              </div>
            </div>

            {/* Reconciliation OPF Table */}
            <div className="p-4 overflow-y-auto flex-1">
              {filteredReconciliationItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <PackageCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No orders match the selected filter or search.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {qcReconciliation.items.length === 0
                      ? 'No Final QC Passed orders logged for this month.'
                      : 'Try adjusting your search keywords or switching tabs above.'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold text-xs  border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">OPF No</th>
                        <th className="p-2.5">Model / Customer</th>
                        <th className="p-2.5">QC Date & Inspector</th>
                        <th className="p-2.5 text-right">QC Pass</th>
                        <th className="p-2.5 text-right">Dispatched</th>
                        <th className="p-2.5 text-right font-semibold text-amber-950">Left in Factory</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-xs">
                      {filteredReconciliationItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5">
                            <div className="tabular-nums font-semibold text-indigo-700">
                              {item.opfNo || '-'}
                            </div>
                            {item.factoryNo && (
                              <span className="inline-block text-xs font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200">
                                {item.factoryNo}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 leading-tight">
                              {item.modelName || '-'}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                              {item.customerName || '-'}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            <div className="tabular-nums text-xs text-slate-700 font-medium">
                              {item.qcTimestamp || '-'}
                            </div>
                            {item.qcInspector && (
                              <div className="text-xs text-slate-400">
                                Inspected by: {item.qcInspector}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700 text-xs">
                            {item.qcPassedQty}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-semibold text-indigo-700 text-xs">
                            {item.dispatchedQty}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-semibold text-amber-950 text-xs bg-amber-50/40">
                            {item.remainingInFactory}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {item.status === 'Dispatched' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Dispatched
                              </span>
                            ) : item.status === 'Partially Dispatched' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                Partial ({item.dispatchedQty}/{item.qcPassedQty})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                <PackageCheck className="w-3 h-3 text-rose-600" />
                                In Factory
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

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredReconciliationItems.length} of {qcReconciliation.items.length} orders in {selectedMonthDisplay}
              </span>
              <button
                onClick={() => setShowQcPassedNotDispatchedModal(false)}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductionDashboard;
