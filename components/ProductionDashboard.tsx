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

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Branding & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100/80 shadow-xs shrink-0">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  Production Dashboard
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-none">
                Executive target vs. achievement analysis, on-time delivery intelligence, and in-queue backlog tracking.
              </p>
            </div>
          </div>

          {/* Right Controls: Sub-Tabs & Month Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* View Switcher Sub-Tabs */}
            <div className="flex items-center overflow-x-auto max-w-full p-1 bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-semibold scrollbar-none w-full sm:w-auto">
              <button
                onClick={() => setActiveDashboardSubTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeDashboardSubTab === 'overview'
                    ? 'bg-white text-indigo-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Executive Overview</span>
              </button>

              <button
                onClick={() => setActiveDashboardSubTab('daily')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeDashboardSubTab === 'daily'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                <span>Daily Production &amp; Steps</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  PMS
                </span>
              </button>

              <button
                onClick={() => setActiveDashboardSubTab('onTime')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeDashboardSubTab === 'onTime'
                    ? 'bg-white text-indigo-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>On-Time Delivery</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {onTimeMetrics.overallUnitOnTimePct}%
                </span>
              </button>
            </div>

            {/* Interactive Month Filter Dropdown */}
            <div className="relative flex items-center bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 transition-colors shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-4 w-full sm:w-auto"
                title="Select production month to filter Final QC and floor metrics"
              >
                {availableMonths.map((m) => {
                  const [y, mon] = m.split('-');
                  const label = `${monthNamesShort[parseInt(mon, 10) - 1]} ${y}`;
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
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
          {/* VISUAL CHARTS & PRODUCTION INTELLIGENCE */}
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

      {/* Main Grid: Left 7 Columns vs Right 5 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (7 COLS ON LG) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECTION A: PRODUCTION SUMMARY BANNER */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-700">
                  Production Performance Rate
                </span>
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                Month: <strong className="text-slate-800">{selectedMonthDisplay}</strong>
              </span>
            </div>
            
            <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-white">
              {/* Selected Month Display */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 text-center flex flex-col justify-center">
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block mb-0.5 sm:mb-1">Production Month</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {selectedMonthDisplay}
                </span>
              </div>

              {/* Target Production Per Day */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 text-center flex flex-col justify-center">
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight block mb-0.5 sm:mb-1">
                  Target / Day
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {targetPerDay}
                </span>
              </div>

              {/* Actual Produced Per Day */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col justify-center">
                <span className="text-[11px] sm:text-xs font-semibold text-indigo-700 leading-tight block mb-0.5 sm:mb-1">
                  Actual Produced / Day
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-indigo-700">
                  {actualPerDay}
                </span>
              </div>

              {/* % Target Achieved Till Date */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col justify-center">
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 leading-tight block mb-0.5 sm:mb-1">
                  % Target Achieved
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
                  {pctTargetAchieved}%
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B: TARGET VS ACHIEVEMENT + IN QUEUE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Desktop Synchronized Headers Row (Hidden on mobile) */}
            <div className="hidden sm:grid sm:grid-cols-12 bg-slate-50/80 border-b border-slate-200 font-bold text-xs tracking-wider uppercase text-slate-700">
              <div className="sm:col-span-8 px-5 py-3.5 border-r border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Target vs Achievement</span>
              </div>
              <div className="sm:col-span-4 px-4 py-3.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>In Queue Status</span>
              </div>
            </div>

            {/* Mobile Header: Target vs Achievement */}
            <div className="sm:hidden px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Target vs Achievement
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                {pctTargetAchieved}% Achieved
              </span>
            </div>

            {/* Inner Content Grid */}
            <div className="grid grid-cols-12 p-3 sm:p-4 gap-3 sm:gap-4 bg-white">
              
              {/* Target Vs Achievement (8 cols on Desktop, 12 on mobile) */}
              <div className="col-span-12 sm:col-span-8 space-y-3">
                <div className="grid grid-cols-12 gap-2.5">
                  {/* Production Target (Large Card) */}
                  <div className="col-span-12 sm:col-span-4 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 border border-indigo-100 rounded-xl p-3 text-center flex flex-col justify-center relative">
                    <span className="text-[11px] text-indigo-900 font-bold leading-tight uppercase tracking-wider block mb-1">
                      Monthly Target
                    </span>
                    {isEditingTarget ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          className="w-full bg-white border border-indigo-300 text-center text-sm font-bold font-mono p-1 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={handleSaveTarget}
                          className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-lg font-bold shadow-xs hover:bg-indigo-700 transition-colors"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setIsEditingTarget(true)}
                        className="cursor-pointer group flex flex-col items-center"
                        title="Click to customize monthly target"
                      >
                        <span className="text-2xl sm:text-3xl font-bold font-mono text-indigo-950">
                          {productionTarget.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-indigo-600 group-hover:text-indigo-800 font-semibold mt-0.5">Click to edit</span>
                      </div>
                    )}
                  </div>

                  {/* Produced Till Date & Shortfall */}
                  <div className="col-span-6 sm:col-span-4 space-y-2">
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-emerald-800 font-bold block leading-tight">
                        Produced Till Date
                      </span>
                      <span className="text-base sm:text-lg font-bold font-mono text-emerald-950 mt-0.5 block">
                        {liveProducedTillDate.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-rose-800 font-bold block leading-tight">
                        Shortfall
                      </span>
                      <span className="text-base sm:text-lg font-bold font-mono text-rose-950 mt-0.5 block">
                        {shortfall.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* % Columns */}
                  <div className="col-span-6 sm:col-span-4 space-y-2">
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-emerald-800 font-bold block leading-tight">
                        % Produced
                      </span>
                      <span className="text-base sm:text-lg font-bold font-mono text-emerald-950 mt-0.5 block">
                        {pctProducedTillDate}%
                      </span>
                    </div>

                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 text-center">
                      <span className="text-[10px] text-rose-800 font-bold block leading-tight">
                        % Shortfall
                      </span>
                      <span className="text-base sm:text-lg font-bold font-mono text-rose-950 mt-0.5 block">
                        {pctShortfall}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row of Target vs Achievement: 4 Small Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block leading-tight">
                      Days Remaining
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      {daysRemaining}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block leading-tight">
                      New Target / Day
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      {newTargetPerDay}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block leading-tight">
                      Increase Req. (Units)
                    </span>
                    <div className="flex items-center justify-center gap-0.5 text-emerald-600 mt-0.5">
                      <ArrowUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                      <span className="text-sm sm:text-base font-bold font-mono text-slate-900">
                        {increaseRequiredUnits}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block leading-tight">
                      % Increase Req.
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      {pctIncreaseRequired}
                    </span>
                  </div>
                </div>
              </div>

              {/* In Queue (4 cols on SM, full-width with distinct section header on mobile) */}
              <div className="col-span-12 sm:col-span-4 flex flex-col justify-between space-y-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/80">
                {/* Mobile In Queue Header */}
                <div className="sm:hidden flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      In Queue Status
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-900 font-mono bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {floorMetrics.totalChairsInQueue.toLocaleString()} Chairs Total
                  </span>
                </div>

                {/* 4. Total Chairs in Queue (Featured Prominently) */}
                <div 
                  onClick={() => {
                    setQueueFilterCategory('all');
                    setShowQueueDrawer(true);
                  }}
                  className="bg-slate-900 text-white rounded-xl p-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors group shadow-xs"
                  title="Click to audit Total Queue (Current + Backlog + Next month chairs)"
                >
                  <span className="text-[10px] text-slate-300 font-bold block leading-tight">
                    Total Chairs in Queue
                  </span>
                  <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                    {floorMetrics.totalChairsInQueue.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium block">
                    Current ({floorMetrics.inQueueCurrent}) + Backlog ({floorMetrics.backlogChairs}) + Next ({floorMetrics.nextMonthChairs})
                  </span>
                </div>

                {/* Grid for other 4 Queue Cards: 2-column on mobile, single-column on desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                  {/* 1. Current Month Chairs in Queue */}
                  <div 
                    onClick={() => {
                      setQueueFilterCategory('current');
                      setShowQueueDrawer(true);
                    }}
                    className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2 text-center cursor-pointer hover:bg-amber-100/70 transition-colors group flex flex-col justify-center"
                    title="Click to audit Selected Month queue orders"
                  >
                    <span className="text-[9px] sm:text-[10px] text-amber-900 font-bold block leading-tight">
                      Current Month Queue
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-amber-950 mt-0.5 block">
                      {floorMetrics.inQueueCurrent.toLocaleString()}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-amber-700/80 font-medium block truncate">
                      {monthNamesShort[selectedMonthNum - 1]} {selectedYear}
                    </span>
                  </div>

                  {/* 2. Backlog Chairs */}
                  <div 
                    onClick={() => {
                      setQueueFilterCategory('backlog');
                      setShowQueueDrawer(true);
                    }}
                    className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2 text-center cursor-pointer hover:bg-rose-100/70 transition-colors group flex flex-col justify-center"
                    title="Click to audit Overdue Backlog queue orders (Excludes Hold)"
                  >
                    <span className="text-[9px] sm:text-[10px] text-rose-800 font-bold block leading-tight">
                      Backlog Chairs
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-rose-950 mt-0.5 block">
                      {floorMetrics.backlogChairs.toLocaleString()}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-rose-600 font-medium block truncate">
                      Overdue Backlog
                    </span>
                  </div>

                  {/* 3. Next Month Chairs */}
                  <div 
                    onClick={() => {
                      setQueueFilterCategory('next');
                      setShowQueueDrawer(true);
                    }}
                    className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2 text-center cursor-pointer hover:bg-blue-100/70 transition-colors group flex flex-col justify-center"
                    title="Click to audit Next Month queue orders"
                  >
                    <span className="text-[9px] sm:text-[10px] text-blue-800 font-bold block leading-tight">
                      Next Month Chairs
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-blue-950 mt-0.5 block">
                      {floorMetrics.nextMonthChairs.toLocaleString()}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-blue-600 font-medium block truncate">
                      {nextMonthDisplay} Plan
                    </span>
                  </div>

                  {/* 5. On Hold Orders */}
                  <div 
                    onClick={() => {
                      setQueueFilterCategory('hold');
                      setShowQueueDrawer(true);
                    }}
                    className="bg-orange-50/80 border border-orange-200 rounded-xl p-2 text-center cursor-pointer hover:bg-orange-100/80 transition-colors group flex flex-col justify-center"
                    title="Click to view all On Hold orders (Excluded from Backlog and Queue)"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                      <span className="text-[9px] sm:text-[10px] text-orange-900 font-bold uppercase tracking-tight block">
                        On Hold Orders
                      </span>
                    </div>
                    <span className="text-base sm:text-lg font-bold font-mono text-orange-950 mt-0.5 block">
                      {floorMetrics.holdChairs.toLocaleString()} <span className="text-[10px] font-semibold text-orange-800">U</span>
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-orange-700 font-medium block truncate">
                      {floorMetrics.holdOrdersCount} Orders
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION C: AI PRODUCTION & TARGET IMPROVEMENT ADVISOR (SUGGESTIONS BY AI) */}
          <ProductionAIAdvisor
            plantContext={plantContext}
            analysis={aiAnalysis}
            isLoading={isAnalyzingAI}
            onRefreshAnalysis={handleRunDeepAIAnalysis}
          />

        </div>

        {/* RIGHT COLUMN (5 COLS ON LG) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SECTION D: DISPATCH BOX */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-700">
                  Dispatch Status ({selectedMonthDisplay})
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Monthly Flow
              </span>
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-2.5 bg-white">
              <div 
                onClick={() => setShowDispatchDrawer(prev => !prev)}
                className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-2.5 sm:p-3 text-center cursor-pointer hover:bg-emerald-100/60 transition-colors group"
                title="Click to view dispatch entries"
              >
                <span className="text-[9px] sm:text-[10px] text-emerald-800 font-bold block leading-tight">
                  Dispatched
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-emerald-950 mt-1 block">
                  {floorMetrics.dispatchedThisMonth.toLocaleString()}
                </span>
                <span className="text-[8px] sm:text-[9px] text-emerald-600 font-medium block mt-0.5">
                  View entries →
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 text-center flex flex-col justify-center">
                <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block leading-tight">
                  % Dispatched
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  {pctDispatched}
                </span>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium block mt-0.5">
                  vs Target
                </span>
              </div>

              <div 
                onClick={() => setShowQcPassedNotDispatchedModal(true)}
                className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-2.5 sm:p-3 text-center cursor-pointer hover:bg-amber-100/60 transition-colors group relative"
                title="Click to view order-by-order OPF QC Passed vs Dispatched reconciliation"
              >
                <span className="text-[9px] sm:text-[10px] text-amber-900 font-bold block leading-tight">
                  QC Passed, Not Disp.
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-amber-950 mt-1 block">
                  {floorMetrics.qcPassedNotDispatched.toLocaleString()}
                </span>
                <span className="text-[8px] sm:text-[9px] text-amber-700 font-semibold block mt-0.5">
                  {qcReconciliation.notDispatchedOpfs} OPFs Left
                </span>
              </div>
            </div>
          </div>

          {/* SECTION E: READY GOODS / STOCK BOX */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-700">
                  Ready Goods &amp; Factory Stock
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Finished Inventory
              </span>
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 bg-white">
              <div 
                onClick={() => onNavigateToReadyGoods ? onNavigateToReadyGoods() : null}
                className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-100/80 rounded-xl p-3 sm:p-3.5 text-center cursor-pointer hover:border-indigo-300 hover:shadow-xs transition-all group"
                title="Click to open Ready Goods Dashboard"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs text-indigo-950 font-bold block leading-tight">
                    Ready Goods Qty
                  </span>
                  <ExternalLink className="w-3 h-3 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-xl sm:text-3xl font-bold font-mono text-indigo-950 mt-1 block">
                  {(readyGoodsItems.length > 0 
                    ? readyGoodsItems.reduce((acc, i) => acc + i.readyGoodsQty, 0) 
                    : 461).toLocaleString()}
                </span>
                <span className="text-[10px] text-indigo-700 font-semibold block mt-1">
                  {readyGoodsItems.length || 41} Orders Finished
                </span>
                <span className="text-[9px] text-indigo-500 font-medium underline block mt-0.5">
                  Open Ready Goods Tab →
                </span>
              </div>

              <div 
                onClick={onNavigateToReadyStock}
                className="bg-gradient-to-br from-amber-50/60 to-yellow-50/40 border border-amber-100/80 rounded-xl p-3 sm:p-3.5 text-center cursor-pointer hover:border-amber-300 hover:shadow-xs transition-all group"
                title="Click to view Ready Stock Dashboard (Factory Sales Stock)"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs text-amber-950 font-bold block leading-tight">
                    Ready Stock
                  </span>
                  <ExternalLink className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-xl sm:text-3xl font-bold font-mono text-amber-950 mt-1 block">
                  {(readyStockItems.length > 0
                    ? readyStockItems.reduce((acc, i) => acc + i.qty, 0)
                    : 91).toLocaleString()}
                </span>
                <span className="text-[10px] text-amber-800 font-semibold block mt-1">
                  {readyStockItems.length || 40} Models Available
                </span>
                <span className="text-[9px] text-amber-600 font-medium underline block mt-0.5">
                  Open Ready Stock Tab →
                </span>
              </div>
            </div>
          </div>

          {/* SECTION F: MONTHLY PRODUCTION PERFORMANCE TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-700">
                Monthly Performance (From Apr-2025)
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                {monthlyAggregates.length} Months Tracked
              </span>
            </div>
            
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full min-w-[360px] text-xs text-left border-collapse bg-white">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 sm:p-2.5">Month</th>
                    <th className="p-2 sm:p-2.5 text-right">Target</th>
                    <th className="p-2 sm:p-2.5 text-right">Achieved</th>
                    <th className="p-2 sm:p-2.5 text-right">Ach.%</th>
                    <th className="p-2 sm:p-2.5 text-right">Dispatched</th>
                    <th className="p-2 sm:p-2.5 text-right">Disp.%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                  {monthlyAggregates.map((row) => (
                    <tr
                      key={row.monthKey}
                      onClick={() => setSelectedMonth(row.monthKey)}
                      className={`cursor-pointer transition-colors ${
                        selectedMonth === row.monthKey 
                          ? 'bg-indigo-50/80 font-bold text-indigo-950' 
                          : 'hover:bg-slate-50/80 text-slate-700'
                      }`}
                      title="Click row to switch production dashboard to this month"
                    >
                      <td className="p-2 sm:p-2.5 font-bold flex items-center justify-between">
                        <span>{row.monthDisplay}</span>
                        {selectedMonth === row.monthKey && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        )}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right font-mono">{row.target.toLocaleString()}</td>
                      <td className="p-2 sm:p-2.5 text-right font-mono font-semibold text-emerald-700">{row.achieved.toLocaleString()}</td>
                      <td className="p-2 sm:p-2.5 text-right font-mono">{row.achPct}%</td>
                      <td className="p-2 sm:p-2.5 text-right font-mono font-semibold text-slate-900">{row.dispatched.toLocaleString()}</td>
                      <td className="p-2 sm:p-2.5 text-right font-mono">{row.dispPct}%</td>
                    </tr>
                  ))}
                  
                  {/* Grand Total Row */}
                  <tr className="bg-slate-100/90 text-slate-900 font-bold border-t-2 border-slate-300 sticky bottom-0">
                    <td className="p-2.5 font-black">Grand Total</td>
                    <td className="p-2.5 text-right font-mono font-bold">{grandTotals.target.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-800">{grandTotals.achieved.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{grandTotals.achPct}%</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-950">{grandTotals.dispatched.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{grandTotals.dispPct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

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
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Live Final QC Response Batch Submissions {qcViewScope === 'all' ? '(All Responses)' : `(${selectedMonthDisplay})`}
            </span>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold">
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
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      qcViewScope === 'month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {selectedMonthDisplay} ({selectedMonthQcRecords.length})
                  </button>
                  <button
                    onClick={() => setQcViewScope('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
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
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      batchFilterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({(qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords).length})
                  </button>
                  <button
                    onClick={() => setBatchFilterStatus('pass')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                      batchFilterStatus === 'pass' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Passed ({(qcViewScope === 'all' ? qcRecords : selectedMonthQcRecords).filter(r => r.status === 'Pass').length})</span>
                  </button>
                  <button
                    onClick={() => setBatchFilterStatus('rejected')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
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
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider z-10">
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
                  <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                    {filteredBatchRecords.map((rec, idx) => (
                      <tr key={`${rec.opfNo}-${rec.timestamp}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-slate-500 text-[10px] font-mono whitespace-nowrap">{rec.timestamp}</td>
                        <td className="p-2.5 font-bold text-indigo-700 font-mono">{rec.opfNo}</td>
                        <td className="p-2.5 text-slate-600 font-mono">{rec.factoryNo || '-'}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-900">{rec.totalQuantity}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{rec.passQuantity}</td>
                        <td className="p-2.5 text-right font-mono text-rose-600">{rec.rejectedQuantity || 0}</td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'Pass' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">{rec.qcInspector}</td>
                        <td className="p-2.5 text-slate-600 text-[10px] max-w-xs truncate" title={rec.passRemarks}>
                          {rec.passRemarks || '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {rec.productImageUrls.length > 0 ? (
                            <a
                              href={rec.productImageUrls[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 text-[10px] font-medium"
                            >
                              <span>{rec.productImageUrls.length} pic(s)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
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
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Chairs in Queue Orders Audit
            </span>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold">
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
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    queueFilterCategory === 'current' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Current Month ({floorMetrics.inQueueCurrent.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('backlog')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    queueFilterCategory === 'backlog' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Backlog ({floorMetrics.backlogChairs.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('hold')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    queueFilterCategory === 'hold' ? 'bg-orange-600 text-white shadow-xs' : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  ⚡ On Hold ({floorMetrics.holdChairs.toLocaleString()} Units • {floorMetrics.holdOrdersCount} Orders)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('next')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    queueFilterCategory === 'next' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Next Month ({floorMetrics.nextMonthChairs.toLocaleString()} Units)
                </button>
                <button
                  onClick={() => setQueueFilterCategory('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
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
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="p-2.5">OPF No</th>
                      <th className="p-2.5">Model Name</th>
                      <th className="p-2.5">Dispatch Date</th>
                      <th className="p-2.5">Current Stage</th>
                      <th className="p-2.5 text-right">Total Qty</th>
                      <th className="p-2.5 text-right">QC Pass</th>
                      <th className="p-2.5 text-center">QC Status</th>
                      <th className="p-2.5 text-right bg-amber-50 text-amber-900 font-bold">Remaining in Queue</th>
                      <th className="p-2.5">Queue Bucket</th>
                      <th className="p-2.5">Overall Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                    {filteredQueueOrders.map((item, idx) => (
                      <tr 
                        key={`${item.opfNo}-${idx}`} 
                        onClick={() => onSelectOrder && onSelectOrder(item.order)}
                        className={`hover:bg-slate-50/80 transition-colors ${onSelectOrder ? 'cursor-pointer' : ''}`}
                        title={onSelectOrder ? 'Click to view order stage progress details' : undefined}
                      >
                        <td className="p-2.5 font-bold text-indigo-700 font-mono">{item.opfNo}</td>
                        <td className="p-2.5 text-slate-900 font-medium">{item.modelName}</td>
                        <td className="p-2.5 text-slate-600 font-mono text-[10px]">{item.dispatchDate || 'HOLD'}</td>
                        <td className="p-2.5 text-slate-700">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-800">
                            {item.currentStage}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-700">{item.totalQty}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{item.qtyPass}</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (item.qcStatus || '').toLowerCase() === 'pass'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : (item.qcStatus || '').toLowerCase().includes('wip')
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.qcStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-950 bg-amber-50/60 text-xs">
                          {item.remainingQueue}
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                            item.category === 'current'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : item.category === 'backlog'
                              ? 'bg-rose-50 text-rose-900 border border-rose-200'
                              : item.category === 'hold'
                              ? 'bg-orange-50 text-orange-900 border border-orange-200'
                              : item.category === 'next'
                              ? 'bg-blue-50 text-blue-900 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.category === 'current' ? 'Current Month' : item.category === 'backlog' ? 'Backlog (Past Due)' : item.category === 'hold' ? '⚡ On Hold' : item.category === 'next' ? 'Next Month' : 'Future'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            item.category === 'hold'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
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
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Dispatch Response Entries {dispatchViewScope === 'all' ? '(All Responses)' : `(${selectedMonthDisplay})`}
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold">
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
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      dispatchViewScope === 'month' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {selectedMonthDisplay} ({selectedMonthDispatchRecords.length})
                  </button>
                  <button
                    onClick={() => setDispatchViewScope('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
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
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center">#</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5 font-bold">OPF No.</th>
                      <th className="p-2.5 text-right">Number of Boxes / Qty</th>
                      <th className="p-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                    {filteredDispatchRecords.map((item, idx) => (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 text-slate-400 text-[10px] font-mono text-center">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 text-slate-600 font-mono text-[10px] whitespace-nowrap">
                          {item.timestamp}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-700 text-xs whitespace-nowrap">
                          {item.opfNo ? (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                              {item.opfNo}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-800 text-xs">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-slate-600 text-[11px]">
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
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
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
                  <span className="font-bold block text-amber-900">OPF-Level Factory Inventory Methodology:</span>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    Evaluates each OPF with Final QC completed in <strong>{selectedMonthDisplay}</strong>. Checks whether the OPF was dispatched in the same period to calculate exact units still held on the factory floor.
                  </p>
                </div>
                <div className="text-[11px] text-amber-900 font-bold bg-amber-100 px-3 py-1 rounded-lg border border-amber-200 whitespace-nowrap">
                  {qcReconciliation.notDispatchedOpfs} OPF(s) Pending Dispatch
                </div>
              </div>

              {/* 3 Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">1. Total QC Passed</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-950 block mt-0.5">
                    {qcReconciliation.totalQcPassedUnits.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    {qcReconciliation.totalQcPassedOpfs} OPFs inspected
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-center">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">2. Total Dispatched</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-indigo-950 block mt-0.5">
                    {qcReconciliation.dispatchedUnits.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-indigo-700 font-semibold block">
                    {qcReconciliation.dispatchedOpfs} OPFs shipped
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">3. Left In Factory</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-amber-950 block mt-0.5">
                    {floorMetrics.qcPassedNotDispatched.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold block">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reconciliationFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  Pending In Factory ({qcReconciliation.notDispatchedOpfs})
                </button>
                <button
                  onClick={() => setReconciliationFilter('dispatched')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reconciliationFilter === 'dispatched'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  Dispatched ({qcReconciliation.dispatchedOpfs})
                </button>
                <button
                  onClick={() => setReconciliationFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">OPF No</th>
                        <th className="p-2.5">Model / Customer</th>
                        <th className="p-2.5">QC Date & Inspector</th>
                        <th className="p-2.5 text-right">QC Pass</th>
                        <th className="p-2.5 text-right">Dispatched</th>
                        <th className="p-2.5 text-right font-bold text-amber-950">Left in Factory</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                      {filteredReconciliationItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5">
                            <div className="font-mono font-bold text-indigo-700">
                              {item.opfNo || '-'}
                            </div>
                            {item.factoryNo && (
                              <span className="inline-block text-[9px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200">
                                {item.factoryNo}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 leading-tight">
                              {item.modelName || '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                              {item.customerName || '-'}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            <div className="font-mono text-[10px] text-slate-700 font-medium">
                              {item.qcTimestamp || '-'}
                            </div>
                            {item.qcInspector && (
                              <div className="text-[10px] text-slate-400">
                                Inspected by: {item.qcInspector}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700 text-xs">
                            {item.qcPassedQty}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-indigo-700 text-xs">
                            {item.dispatchedQty}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-950 text-xs bg-amber-50/40">
                            {item.remainingInFactory}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {item.status === 'Dispatched' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Dispatched
                              </span>
                            ) : item.status === 'Partially Dispatched' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                Partial ({item.dispatchedQty}/{item.qcPassedQty})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
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
