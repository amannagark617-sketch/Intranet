import React, { useState, useMemo } from 'react';
import type { Order, FinalQcRecord, ProductionStepName } from '../types';
import { STAGE_CONFIGS, PRODUCTION_STAGES } from '../constants';
import { normalizeToYMD, formatDateDDMMMYYYY, parseYMD } from '../utils/dateUtils';
import type { DispatchRecord } from '../services/dispatchResponseService';
import { exportDailyProductionToExcel } from '../utils/excelExport';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  Sparkles,
  TrendingUp,
  X,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  SlidersHorizontal,
  Table,
  Grid,
  CalendarDays,
  Info,
  ChevronRight
} from 'lucide-react';

interface DailyProductionStepViewProps {
  selectedMonth: string; // e.g. "2026-09"
  selectedMonthDisplay: string; // e.g. "September-2026"
  productionTarget: number; // e.g. 1400
  orders: Order[];
  qcRecords: FinalQcRecord[];
  dispatchRecords: DispatchRecord[];
  onSelectOrder?: (order: Order) => void;
  onBackToOverview?: () => void;
}

export interface DayStepData {
  stage: ProductionStepName;
  stepCode: string;
  category: string;
  color: string;
  responsible: string;
  orderCount: number;
  unitCount: number;
  orders: Array<{
    opfNo: string;
    modelName: string;
    upholstery: string;
    quantity: number;
    status: string;
    responsible: string;
    actualDate: string;
    remarks?: string | null;
  }>;
}

export interface DayProductionSummary {
  dayNum: number;
  dateYMD: string; // "2026-09-04"
  dateDisplay: string; // "04-Sep-2026"
  dayName: string; // "Thu"
  isSunday: boolean;
  isToday: boolean;
  isPastOrToday: boolean;
  isFuture: boolean;
  dailyTarget: number;
  actualProducedFinalQc: number; // KPI ACTUAL: Strictly Final Passed Units
  dailyVariance: number; // actualProducedFinalQc - dailyTarget
  achievementPct: number; // (actualProducedFinalQc / dailyTarget) * 100
  cumulativeTarget: number;
  cumulativeActualProduced: number;
  cumulativeVariance: number;
  qcSubmissions: FinalQcRecord[];
  qcSubmissionsCount: number;
  qcPassUnits: number;
  qcRejectedUnits: number;
  qcPassRatePct: number;
  dispatchedUnits: number;
  dispatchSubmissions: DispatchRecord[];
  stageBreakdown: Record<ProductionStepName, DayStepData>;
  totalStepActivitiesCount: number;
  uniqueOrdersProcessedCount: number;
}

export const DailyProductionStepView: React.FC<DailyProductionStepViewProps> = ({
  selectedMonth,
  selectedMonthDisplay,
  productionTarget,
  orders,
  qcRecords,
  dispatchRecords,
  onSelectOrder,
  onBackToOverview,
}) => {
  // View mode switcher: 'ledger' | 'matrix' | 'calendar'
  const [viewMode, setViewMode] = useState<'ledger' | 'matrix' | 'calendar'>('ledger');
  
  // Expanded days in ledger view
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  // Selected day for modal inspection
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayProductionSummary | null>(null);

  // Filters
  const [dayTypeFilter, setDayTypeFilter] = useState<'all' | 'working' | 'achieved' | 'shortfall' | 'activeWip'>('all');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedModalTab, setSelectedModalTab] = useState<'stages' | 'orders' | 'qcBatches' | 'dispatchBatches'>('stages');

  // Parse Year and Month
  const [yearNum, monthNum] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0], 10) || 2026, parseInt(parts[1], 10) || 9];
  }, [selectedMonth]);

  const totalDaysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum, 0).getDate();
  }, [yearNum, monthNum]);

  // Today reference
  const { todayYMD, todayMonthKey, todayDateNum } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return {
      todayYMD: `${y}-${m}-${d}`,
      todayMonthKey: `${y}-${m}`,
      todayDateNum: now.getDate()
    };
  }, []);

  // Filter QC records and Dispatch records for selected month
  const monthQcRecords = useMemo(() => {
    return qcRecords.filter(r => r.monthKey === selectedMonth || (r.dateYMD && r.dateYMD.startsWith(selectedMonth)));
  }, [qcRecords, selectedMonth]);

  const monthDispatchRecords = useMemo(() => {
    return dispatchRecords.filter(d => d.monthKey === selectedMonth || (d.dateYMD && d.dateYMD.startsWith(selectedMonth)));
  }, [dispatchRecords, selectedMonth]);

  // Daily target per day
  const targetPerDay = Math.round(productionTarget / Math.max(1, totalDaysInMonth));

  // Build Day-by-Day Aggregates
  const dailySummaries: DayProductionSummary[] = useMemo(() => {
    const list: DayProductionSummary[] = [];
    let runningCumulativeTarget = 0;
    let runningCumulativeActual = 0;

    const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // For current month: only generate days up to today (d <= todayDateNum).
    // When the day changes tomorrow, todayDateNum increases and automatically appends the new date.
    // For past months: generate all days of the month (totalDaysInMonth).
    // For future months: maxDays is 0.
    const isCurrentMonth = selectedMonth === todayMonthKey;
    const isPastMonth = selectedMonth < todayMonthKey;
    const maxDays = isCurrentMonth 
      ? Math.min(todayDateNum, totalDaysInMonth)
      : isPastMonth 
        ? totalDaysInMonth 
        : 0;

    for (let d = 1; d <= maxDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(monthNum).padStart(2, '0');
      const dateYMD = `${yearNum}-${monthStr}-${dayStr}`;
      
      const dateObj = new Date(yearNum, monthNum - 1, d);
      const dayOfWeek = dateObj.getDay();
      const dayName = dayShortNames[dayOfWeek] || 'Day';
      const isSunday = dayOfWeek === 0;
      const isToday = dateYMD === todayYMD;
      const isPastOrToday = dateYMD <= todayYMD;
      const isFuture = dateYMD > todayYMD;

      // 1. FINAL QC SUBMISSIONS ON THIS DATE (STRICT MAIN SOURCE OF TRUTH FOR ACTUAL PRODUCTION)
      const dayQcSubmissions = monthQcRecords.filter(r => r.dateYMD === dateYMD);
      const qcPassUnits = dayQcSubmissions
        .filter(r => r.status === 'Pass' || r.passQuantity > 0)
        .reduce((sum, r) => sum + (r.passQuantity || 0), 0);
      const qcRejectedUnits = dayQcSubmissions.reduce((sum, r) => sum + (r.rejectedQuantity || 0), 0);
      const qcTotalBatchInspected = dayQcSubmissions.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
      const qcPassRatePct = qcTotalBatchInspected > 0 
        ? Math.round((qcPassUnits / qcTotalBatchInspected) * 100) 
        : (dayQcSubmissions.length > 0 ? 100 : 0);

      // Final QC pass units (Authoritative Actual Daily Production strictly from Final QC Response Sheet)
      const actualProducedFinalQc = qcPassUnits;

      // 2. DISPATCH SUBMISSIONS ON THIS DATE
      const dayDispatches = monthDispatchRecords.filter(d => d.dateYMD === dateYMD);
      const dispatchedUnits = dayDispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);

      // 3. STEP-WISE STAGE BREAKDOWN ACROSS ALL 14 PMS STEPS
      const stageBreakdown = {} as Record<ProductionStepName, DayStepData>;
      const uniqueOrderSet = new Set<string>();
      let totalStepActs = 0;

      PRODUCTION_STAGES.forEach((stageName) => {
        const cfg = STAGE_CONFIGS[stageName];
        const matchingOrders: DayStepData['orders'] = [];
        let totalUnitsAtStage = 0;

        if (stageName === 'QUALITY CONTROL') {
          // QUALITY CONTROL (Step 9) is strictly sourced from Final QC Response Form entries
          dayQcSubmissions.forEach((qcRec) => {
            const matchedOrder = orders.find(o => o.opfNo.trim().toUpperCase() === qcRec.opfNo.trim().toUpperCase());
            const unitQty = qcRec.passQuantity > 0 ? qcRec.passQuantity : (qcRec.totalQuantity || 1);
            
            matchingOrders.push({
              opfNo: qcRec.opfNo,
              modelName: matchedOrder?.modelName || 'Recliner Order',
              upholstery: matchedOrder?.upholstery || 'Factory Specified',
              quantity: unitQty,
              status: qcRec.status === 'Pass' ? 'Completed' : qcRec.status || 'Inspected',
              responsible: qcRec.qcInspector || cfg.responsible,
              actualDate: qcRec.dateYMD,
              remarks: qcRec.passRemarks || (qcRec.rejectedQuantity > 0 ? `${qcRec.rejectedQuantity} rejected` : 'Final QC Form Inspection'),
            });

            if (qcRec.status === 'Pass' || qcRec.passQuantity > 0) {
              totalUnitsAtStage += qcRec.passQuantity;
            }
            uniqueOrderSet.add(qcRec.opfNo);
            totalStepActs++;
          });
        } else if (stageName === 'DISPATCH') {
          // DISPATCH (Step 12) is strictly sourced from Google Form Dispatch Response Sheet (Box / Carton Count)
          dayDispatches.forEach((dispRec) => {
            const matchedOrder = dispRec.opfNo 
              ? orders.find(o => o.opfNo.trim().toUpperCase() === dispRec.opfNo?.trim().toUpperCase())
              : undefined;
            const boxQty = dispRec.quantity > 0 ? dispRec.quantity : 1;

            matchingOrders.push({
              opfNo: dispRec.opfNo || 'Dispatch Form',
              modelName: matchedOrder?.modelName || dispRec.modelName || 'Dispatched Cartons / Boxes',
              upholstery: matchedOrder?.upholstery || 'Factory Packed',
              quantity: boxQty,
              status: 'Dispatched',
              responsible: cfg.responsible,
              actualDate: dispRec.dateYMD,
              remarks: dispRec.remarks || `${boxQty} boxes recorded in Dispatch Response Form`,
            });

            totalUnitsAtStage += boxQty;
            if (dispRec.opfNo) uniqueOrderSet.add(dispRec.opfNo);
            totalStepActs++;
          });
        } else {
          // Other stages (Carpentry, Cutting, Stitching, Foaming, Upholstery, Fitting, Packing) from PMS floor tracking
          orders.forEach((ord) => {
            const step = ord.steps?.find(s => s.name === stageName);
            if (!step) return;

            const stepActualYMD = step.actualDate ? normalizeToYMD(step.actualDate) : null;
            if (stepActualYMD === dateYMD) {
              if (step.status === 'Completed' || (step.qtyPass && step.qtyPass > 0) || (step.status as string) === 'Pass') {
                const unitQty = (step.qtyPass !== null && step.qtyPass !== undefined && step.qtyPass > 0)
                  ? step.qtyPass 
                  : ord.quantity;

                matchingOrders.push({
                  opfNo: ord.opfNo,
                  modelName: ord.modelName,
                  upholstery: ord.upholstery,
                  quantity: unitQty,
                  status: step.status,
                  responsible: step.responsible || cfg.responsible,
                  actualDate: step.actualDate || dateYMD,
                  remarks: step.remarks || step.reasonOfFail || null,
                });

                totalUnitsAtStage += unitQty;
                uniqueOrderSet.add(ord.opfNo);
                totalStepActs++;
              }
            }
          });
        }

        stageBreakdown[stageName] = {
          stage: stageName,
          stepCode: cfg.stepCode,
          category: cfg.category,
          color: cfg.color,
          responsible: cfg.responsible,
          orderCount: matchingOrders.length,
          unitCount: totalUnitsAtStage,
          orders: matchingOrders,
        };
      });

      // Cumulative calculations
      runningCumulativeTarget += targetPerDay;
      runningCumulativeActual += actualProducedFinalQc;

      const dailyVariance = actualProducedFinalQc - targetPerDay;
      const cumulativeVariance = runningCumulativeActual - runningCumulativeTarget;
      const achievementPct = targetPerDay > 0 ? Math.round((actualProducedFinalQc / targetPerDay) * 100) : 0;

      list.push({
        dayNum: d,
        dateYMD,
        dateDisplay: formatDateDDMMMYYYY(dateYMD),
        dayName,
        isSunday,
        isToday,
        isPastOrToday,
        isFuture,
        dailyTarget: targetPerDay,
        actualProducedFinalQc,
        dailyVariance,
        achievementPct,
        cumulativeTarget: runningCumulativeTarget,
        cumulativeActualProduced: runningCumulativeActual,
        cumulativeVariance,
        qcSubmissions: dayQcSubmissions,
        qcSubmissionsCount: dayQcSubmissions.length,
        qcPassUnits,
        qcRejectedUnits,
        qcPassRatePct,
        dispatchedUnits,
        dispatchSubmissions: dayDispatches,
        stageBreakdown,
        totalStepActivitiesCount: totalStepActs,
        uniqueOrdersProcessedCount: uniqueOrderSet.size,
      });
    }

    return list;
  }, [totalDaysInMonth, monthNum, yearNum, todayYMD, todayMonthKey, todayDateNum, selectedMonth, monthQcRecords, monthDispatchRecords, orders, targetPerDay]);

  // Overall Month Performance Totals from Daily Breakdown
  const monthTotals = useMemo(() => {
    const totalActualProduced = dailySummaries.reduce((sum, d) => sum + d.actualProducedFinalQc, 0);
    const totalDispatched = dailySummaries.reduce((sum, d) => sum + d.dispatchedUnits, 0);
    const activeDaysCount = dailySummaries.filter(d => d.actualProducedFinalQc > 0 || d.totalStepActivitiesCount > 0).length;
    const workingDaysCount = dailySummaries.filter(d => !d.isSunday && d.isPastOrToday).length;
    const daysMetTarget = dailySummaries.filter(d => d.actualProducedFinalQc >= d.dailyTarget && d.dailyTarget > 0).length;
    const avgDailyOutput = workingDaysCount > 0 ? Math.round(totalActualProduced / workingDaysCount) : 0;
    const peakDay = [...dailySummaries].sort((a, b) => b.actualProducedFinalQc - a.actualProducedFinalQc)[0];
    const totalQcSubmissions = dailySummaries.reduce((sum, d) => sum + d.qcSubmissionsCount, 0);
    const totalQcRejectedUnits = dailySummaries.reduce((sum, d) => sum + d.qcRejectedUnits, 0);
    const targetAchievedPct = productionTarget > 0 ? Math.round((totalActualProduced / productionTarget) * 100) : 0;

    return {
      totalActualProduced,
      totalDispatched,
      activeDaysCount,
      workingDaysCount,
      daysMetTarget,
      avgDailyOutput,
      peakDay,
      totalQcSubmissions,
      totalQcRejectedUnits,
      targetAchievedPct,
    };
  }, [dailySummaries, productionTarget]);

  // Filtered Daily Summaries for display
  const filteredDailySummaries = useMemo(() => {
    return dailySummaries.filter(day => {
      // Day Type Filter
      if (dayTypeFilter === 'working' && day.isSunday) return false;
      if (dayTypeFilter === 'achieved' && (day.actualProducedFinalQc < day.dailyTarget || day.actualProducedFinalQc === 0)) return false;
      if (dayTypeFilter === 'shortfall' && (day.actualProducedFinalQc >= day.dailyTarget || day.isSunday)) return false;
      if (dayTypeFilter === 'activeWip' && day.totalStepActivitiesCount === 0 && day.actualProducedFinalQc === 0) return false;

      // Stage filter
      if (stageFilter !== 'ALL') {
        const stageData = day.stageBreakdown[stageFilter as ProductionStepName];
        if (!stageData || stageData.unitCount === 0) return false;
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesDate = day.dateDisplay.toLowerCase().includes(term) || day.dayName.toLowerCase().includes(term);
        const matchesQc = day.qcSubmissions.some(q => 
          q.opfNo.toLowerCase().includes(term) || 
          q.qcInspector.toLowerCase().includes(term) || 
          q.passRemarks.toLowerCase().includes(term)
        );
        const matchesOrders = Object.values(day.stageBreakdown).some(stg => 
          stg.orders.some(o => 
            o.opfNo.toLowerCase().includes(term) || 
            o.modelName.toLowerCase().includes(term) || 
            o.upholstery.toLowerCase().includes(term) ||
            o.responsible.toLowerCase().includes(term)
          )
        );
        if (!matchesDate && !matchesQc && !matchesOrders) return false;
      }

      return true;
    });
  }, [dailySummaries, dayTypeFilter, stageFilter, searchTerm]);

  // Toggle Accordion Day in Ledger
  const toggleDayExpansion = (dateYMD: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dateYMD]: !prev[dateYMD]
    }));
  };

  const expandAllDays = () => {
    const next: Record<string, boolean> = {};
    dailySummaries.forEach(d => { next[d.dateYMD] = true; });
    setExpandedDays(next);
  };

  const collapseAllDays = () => {
    setExpandedDays({});
  };

  // Export Daily Breakdown to Excel
  const handleExportExcel = () => {
    const summaryRows = dailySummaries.map(d => ({
      date: d.dateDisplay,
      dayName: d.dayName,
      dailyTarget: d.dailyTarget,
      actualProducedFinalQc: d.actualProducedFinalQc,
      dailyVariance: d.dailyVariance,
      cumulativeTarget: d.cumulativeTarget,
      cumulativeActual: d.cumulativeActualProduced,
      cumulativeVariance: d.cumulativeVariance,
      targetAchievementPct: `${d.achievementPct}%`,
      qcSubmissionsCount: d.qcSubmissionsCount,
      qcPassRatePct: `${d.qcPassRatePct}%`,
      dispatchedUnits: d.dispatchedUnits,
      activeStagesCount: Object.values(d.stageBreakdown).filter(s => s.unitCount > 0).length
    }));

    const stepMatrixRows = dailySummaries.map(d => {
      const row: Record<string, any> = {
        'Date': d.dateDisplay,
        'Day': d.dayName,
        'Daily Target': d.dailyTarget,
        'Actual Output (Final Passed)': d.actualProducedFinalQc,
      };
      PRODUCTION_STAGES.forEach(stg => {
        row[stg] = d.stageBreakdown[stg]?.unitCount || 0;
      });
      row['Dispatched'] = d.dispatchedUnits;
      return row;
    });

    const workOrderLogs: Array<{
      date: string;
      opfNo: string;
      modelName: string;
      upholstery: string;
      quantity: number;
      stageName: string;
      stepCode: string;
      responsible: string;
      status: string;
      remarks?: string;
    }> = [];

    dailySummaries.forEach(d => {
      PRODUCTION_STAGES.forEach(stg => {
        const stepData = d.stageBreakdown[stg];
        stepData.orders.forEach(o => {
          workOrderLogs.push({
            date: d.dateDisplay,
            opfNo: o.opfNo,
            modelName: o.modelName,
            upholstery: o.upholstery,
            quantity: o.quantity,
            stageName: stg,
            stepCode: stepData.stepCode,
            responsible: o.responsible,
            status: o.status,
            remarks: o.remarks || undefined
          });
        });
      });
    });

    exportDailyProductionToExcel(
      summaryRows,
      stepMatrixRows,
      workOrderLogs,
      `Daily_Production_PMS_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* 1. TOP STATS BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{selectedMonthDisplay} · chairs passed final QC each day</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {onBackToOverview && (
              <button
                onClick={onBackToOverview}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
              >
                ← Back
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-semibold shadow-xs transition-all cursor-pointer"
              title="Export complete daily production & step-wise matrix to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Top Metric Cards */}
        <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 bg-white">
          {/* 1. Monthly Target vs Actual Output */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-50/40 border border-indigo-100 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[13px] text-indigo-900 font-semibold mb-1">
              <span>Actual output</span>
              <Target className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-indigo-950">
              {monthTotals.totalActualProduced.toLocaleString()}{' '}
              <span className="text-[13px] font-normal text-slate-500 font-sans">
                / {productionTarget.toLocaleString()} units
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, monthTotals.targetAchievedPct)}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold tabular-nums text-indigo-700">
                {monthTotals.targetAchievedPct}%
              </span>
            </div>
          </div>

          {/* 2. Target / Day vs Actual Daily Average */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[13px] text-slate-500 font-semibold mb-1">
              <span>Daily Run-Rate Pace</span>
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {monthTotals.avgDailyOutput}{' '}
              <span className="text-[13px] font-normal text-slate-500 font-sans">
                chairs / day
              </span>
            </div>
            <div className="text-[13px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Target: <strong>{targetPerDay}/day</strong></span>
              <span className={monthTotals.avgDailyOutput >= targetPerDay ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                {monthTotals.avgDailyOutput >= targetPerDay ? '+' : ''}{monthTotals.avgDailyOutput - targetPerDay} gap
              </span>
            </div>
          </div>

          {/* 3. Peak Production Output Day */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[13px] text-emerald-900 font-semibold mb-1">
              <span>Peak Output Day</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-emerald-950">
              {monthTotals.peakDay?.actualProducedFinalQc || 0}{' '}
              <span className="text-[13px] font-normal text-emerald-800 font-sans">units</span>
            </div>
            <div className="text-[13px] text-emerald-700 font-medium mt-1">
              Recorded on {monthTotals.peakDay?.dateDisplay || 'N/A'}
            </div>
          </div>

          {/* 4. Active Floor Output Days & Dispatch Total */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[13px] text-slate-500 font-semibold mb-1">
              <span>Production Days</span>
              <Truck className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {monthTotals.daysMetTarget}{' '}
              <span className="text-[13px] font-normal text-slate-500 font-sans">
                / {monthTotals.workingDaysCount} days on target
              </span>
            </div>
            <div className="text-[13px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Dispatched: <strong className="text-slate-800">{monthTotals.totalDispatched.toLocaleString()}</strong></span>
              <span>Submissions: <strong className="text-slate-800">{monthTotals.totalQcSubmissions}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS TOOLBAR & VIEW MODE SWITCHER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl text-[13px] font-semibold overflow-x-auto max-w-full scrollbar-none w-full sm:w-auto">
          <button
            onClick={() => setViewMode('ledger')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              viewMode === 'ledger'
                ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>By day</span>
          </button>

          <button
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              viewMode === 'matrix'
                ? 'bg-white text-emerald-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-emerald-600" />
            <span>By step</span>
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              viewMode === 'calendar'
                ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
            <span>Month grid</span>
          </button>
        </div>

        {/* Middle/Right: Filters & Search */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          {/* Day Status Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[13px] flex-1 sm:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
            <select
              value={dayTypeFilter}
              onChange={(e) => setDayTypeFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer w-full"
            >
              <option value="all">All Days ({dailySummaries.length})</option>
              <option value="working">Working Days Only</option>
              <option value="achieved">Target Achieved Days (≥100%)</option>
              <option value="shortfall">Shortfall Days (&lt;Target)</option>
              <option value="activeWip">Active Production Days</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[13px] flex-1 sm:flex-initial">
            <Layers className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="ALL">All Steps</option>
              {PRODUCTION_STAGES.map(stg => (
                <option key={stg} value={stg}>{stg}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
            <input
              type="text"
              placeholder="Search order, model or inspector"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 outline-none w-full sm:w-56 focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          {viewMode === 'ledger' && (
            <div className="flex items-center gap-1 text-[13px] font-semibold text-slate-600">
              <button
                onClick={expandAllDays}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Open all
              </button>
              <button
                onClick={collapseAllDays}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Close all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. VIEW MODE RENDER */}

      {/* MODE 1: DAILY PRODUCTION LEDGER WITH EXPANDABLE STEP PIPELINE */}
      {viewMode === 'ledger' && (
        <div className="space-y-3">
          {filteredDailySummaries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-[13px]">
              No daily production records match the selected filter criteria for {selectedMonthDisplay}.
            </div>
          ) : (
            filteredDailySummaries.map((day) => {
              const isExpanded = !!expandedDays[day.dateYMD];
              const isTargetMet = day.actualProducedFinalQc >= day.dailyTarget && day.dailyTarget > 0;
              const hasActivity = day.actualProducedFinalQc > 0 || day.totalStepActivitiesCount > 0;

              return (
                <div
                  key={day.dateYMD}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    day.isToday 
                      ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' 
                      : day.isSunday 
                        ? 'border-slate-200/60 bg-slate-50/40 opacity-90' 
                        : 'border-slate-200 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Day Header Bar */}
                  <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
                    {/* Day */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 text-center shrink-0">
                        <div className="text-[13px] text-slate-500">{day.dayName}</div>
                        <div className={`text-xl font-semibold tabular-nums ${day.isToday ? 'text-indigo-600' : 'text-slate-900'}`}>{day.dayNum}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-medium text-slate-800">{day.dateDisplay}</span>
                          {day.isToday && <span className="text-[13px] font-medium text-indigo-600">Today</span>}
                          {day.isSunday ? (
                            <span className="text-[13px] text-slate-500">Weekly off</span>
                          ) : (
                            day.isPastOrToday && (
                              <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${
                                isTargetMet ? 'text-emerald-700' : day.actualProducedFinalQc > 0 ? 'text-amber-700' : 'text-slate-500'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isTargetMet ? 'bg-emerald-500' : day.actualProducedFinalQc > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                }`} />
                                {isTargetMet ? 'Target met' : day.actualProducedFinalQc > 0 ? `${day.achievementPct}% of target` : 'No output'}
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[13px] text-slate-500 mt-0.5 tabular-nums">
                          Target {day.dailyTarget} · Month so far {day.cumulativeActualProduced.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Produced + actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full lg:w-auto mt-2 lg:mt-0">
                      <div className="text-right">
                        <div className="text-2xl font-semibold tabular-nums text-slate-900">
                          {day.actualProducedFinalQc.toLocaleString()} <span className="text-[13px] font-normal text-slate-500">chairs</span>
                        </div>
                        <div className="text-[13px] text-slate-500 tabular-nums">{day.dispatchedUnits} dispatched</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setSelectedDayDetail(day)}
                          className="px-2.5 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => toggleDayExpansion(day.dateYMD)}
                          className="px-2.5 py-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide steps' : 'Steps'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Step-Wise Stage Progression Bar & Cards */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          PMS 14-Stage Floor Completion on {day.dateDisplay}
                        </span>
                        <span className="text-[13px] text-slate-500 font-normal">
                          Click any step to view individual work orders
                        </span>
                      </div>

                      {/* 14-Stage Pipeline Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                        {PRODUCTION_STAGES.map((stageName) => {
                          const stepData = day.stageBreakdown[stageName];
                          const hasUnits = stepData.unitCount > 0;
                          const isFinalQc = stageName === 'QUALITY CONTROL';

                          return (
                            <div
                              key={stageName}
                              onClick={() => {
                                if (hasUnits) {
                                  setSelectedDayDetail(day);
                                  setSelectedModalTab('orders');
                                }
                              }}
                              className={`p-2.5 rounded-xl border transition-all ${
                                isFinalQc
                                  ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                                  : hasUnits
                                    ? 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300 cursor-pointer'
                                    : 'bg-slate-100/50 border-slate-200/50 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[13px] font-semibold text-slate-500 mb-1">
                                <span className="tabular-nums">{stepData.stepCode}</span>
                                {isFinalQc && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[13px] font-semibold bg-emerald-600 text-white">
                                    KPI
                                  </span>
                                )}
                              </div>

                              <div className="text-[13px] font-semibold text-slate-900 truncate" title={stageName}>
                                {stageName}
                              </div>

                              <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-slate-100">
                                <span className="text-base font-semibold tabular-nums text-slate-900">
                                  {stepData.unitCount}{' '}
                                  <span className="text-[13px] font-normal text-slate-500">units</span>
                                </span>
                                <span className="text-[13px] font-semibold text-slate-500 tabular-nums">
                                  {stepData.orderCount} orders
                                </span>
                              </div>

                              <div className="text-[13px] text-slate-500 truncate mt-0.5" title={stepData.responsible}>
                                {stepData.responsible.split('/')[0]}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick Sample of Work Orders Completed on this date */}
                      {day.totalStepActivitiesCount > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <div className="text-[13px] font-semibold text-slate-700 mb-2 flex items-center justify-between">
                            <span>Sample Completed Work Orders on {day.dateDisplay} ({day.uniqueOrdersProcessedCount} Orders)</span>
                            <button
                              onClick={() => {
                                setSelectedDayDetail(day);
                                setSelectedModalTab('orders');
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-[13px] font-semibold cursor-pointer"
                            >
                              View All Details →
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {(Object.values(day.stageBreakdown) as DayStepData[])
                              .flatMap(s => s.orders.map(o => ({ ...o, stageName: s.stage, stepCode: s.stepCode })))
                              .slice(0, 6)
                              .map((ord, idx) => (
                                <div key={`${ord.opfNo}-${ord.stageName}-${idx}`} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[13px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-indigo-700 tabular-nums">{ord.opfNo}</span>
                                    <span className="font-semibold tabular-nums text-slate-900">{ord.quantity} units</span>
                                  </div>
                                  <div className="text-[13px] text-slate-700 font-medium truncate mt-0.5">{ord.modelName}</div>
                                  <div className="text-[13px] text-slate-500 flex items-center justify-between mt-1">
                                    <span>{ord.stepCode}: {ord.stageName}</span>
                                    <span className="text-emerald-700 font-semibold">{ord.status}</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODE 2: STEP-WISE CROSS-STEP COMPLETION MATRIX (HEATMAP) */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Cross-Step Unit Completion Matrix ({selectedMonthDisplay})
              </h3>
              <p className="text-[13px] text-slate-500">
                Daily throughput across all 14 sequential PMS production steps. <strong>Final QC</strong> is the official count of chairs produced.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300"></span> Output &gt; 0</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-50 border border-indigo-200"></span> Final QC</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[13px] text-left border-collapse bg-white">
              <thead className="bg-slate-100 text-slate-700 font-semibold text-[13px]  sticky top-0 z-20 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 sticky left-0 bg-slate-100 z-30 min-w-[110px] border-r border-slate-200">
                    Date / Day
                  </th>
                  <th className="p-2.5 text-right bg-slate-100 min-w-[80px] border-r border-slate-200">
                    Target
                  </th>
                  {/* 14 PMS Stages */}
                  {PRODUCTION_STAGES.map((stg) => {
                    const isFinalQc = stg === 'QUALITY CONTROL';
                    return (
                      <th
                        key={stg}
                        className={`p-2.5 text-center min-w-[95px] border-r border-slate-200/80 ${
                          isFinalQc ? 'bg-emerald-100/80 text-emerald-950 font-semibold' : ''
                        }`}
                        title={stg}
                      >
                        <div className="text-[13px] text-slate-500 tabular-nums">{STAGE_CONFIGS[stg].stepCode}</div>
                        <div className="truncate max-w-[85px]">{stg}</div>
                        {isFinalQc && <span className="text-[13px] bg-emerald-600 text-white px-1 rounded-sm">KPI ACTUAL</span>}
                      </th>
                    );
                  })}
                  <th className="p-2.5 text-right bg-slate-100 min-w-[90px]">
                    Dispatched
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-[13px]">
                {dailySummaries.map((day) => {
                  const isTargetMet = day.actualProducedFinalQc >= day.dailyTarget && day.dailyTarget > 0;
                  return (
                    <tr
                      key={day.dateYMD}
                      onClick={() => setSelectedDayDetail(day)}
                      className={`cursor-pointer transition-colors ${
                        day.isToday 
                          ? 'bg-indigo-50/60 font-semibold' 
                          : day.isSunday 
                            ? 'bg-slate-50/40 text-slate-500' 
                            : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Sticky Date Column */}
                      <td className={`p-2.5 sticky left-0 font-semibold border-r border-slate-200 flex items-center justify-between z-10 ${
                        day.isToday ? 'bg-indigo-50 text-indigo-950' : 'bg-white text-slate-900'
                      }`}>
                        <span>{day.dayNum} {day.dayName}</span>
                        {day.isToday && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                      </td>

                      {/* Target */}
                      <td className="p-2.5 text-right tabular-nums text-slate-500 border-r border-slate-200">
                        {day.dailyTarget}
                      </td>

                      {/* 14 PMS Stages Values */}
                      {PRODUCTION_STAGES.map((stg) => {
                        const stepData = day.stageBreakdown[stg];
                        const val = stepData?.unitCount || 0;
                        const isFinalQc = stg === 'QUALITY CONTROL';

                        return (
                          <td
                            key={stg}
                            className={`p-2.5 text-center tabular-nums border-r border-slate-100 ${
                              isFinalQc 
                                ? val > 0 
                                  ? 'bg-emerald-50 font-semibold text-emerald-950 border-emerald-200' 
                                  : 'bg-emerald-50/30 text-slate-500'
                                : val > 0 
                                  ? 'bg-indigo-50/40 font-semibold text-slate-900' 
                                  : 'text-slate-300'
                            }`}
                          >
                            {val > 0 ? val : '-'}
                          </td>
                        );
                      })}

                      {/* Dispatched */}
                      <td className="p-2.5 text-right tabular-nums font-semibold text-slate-800">
                        {day.dispatchedUnits > 0 ? day.dispatchedUnits : '-'}
                      </td>
                    </tr>
                  );
                })}

                {/* Monthly Totals Row */}
                <tr className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 sticky bottom-0 z-20">
                  <td className="p-2.5 sticky left-0 bg-slate-100 font-semibold border-r border-slate-200 z-30">
                    Month Total
                  </td>
                  <td className="p-2.5 text-right tabular-nums font-semibold border-r border-slate-200">
                    {productionTarget.toLocaleString()}
                  </td>
                  {PRODUCTION_STAGES.map((stg) => {
                    const stageSum = dailySummaries.reduce((sum, d) => sum + (d.stageBreakdown[stg]?.unitCount || 0), 0);
                    const isFinalQc = stg === 'QUALITY CONTROL';
                    return (
                      <td
                        key={stg}
                        className={`p-2.5 text-center tabular-nums font-semibold border-r border-slate-200 ${
                          isFinalQc ? 'bg-emerald-200/70 text-emerald-950' : 'text-slate-900'
                        }`}
                      >
                        {stageSum.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="p-2.5 text-right tabular-nums font-semibold text-slate-950">
                    {monthTotals.totalDispatched.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 3: MONTHLY CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[620px] grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center font-semibold text-[13px] text-slate-500 py-2 border-b border-slate-200">
                  {d}
                </div>
              ))}

              {/* Empty offset days for start of month */}
              {Array.from({ length: new Date(yearNum, monthNum - 1, 1).getDay() }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-28 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/60"></div>
              ))}

              {/* Days of the month */}
              {dailySummaries.map((day) => {
              const isTargetMet = day.actualProducedFinalQc >= day.dailyTarget && day.dailyTarget > 0;
              return (
                <div
                  key={day.dateYMD}
                  onClick={() => setSelectedDayDetail(day)}
                  className={`h-28 p-2.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    day.isToday
                      ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30'
                      : day.isSunday
                        ? 'bg-slate-50/60 border-slate-200/80 text-slate-500'
                        : isTargetMet
                          ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`tabular-nums text-[13px] font-semibold ${day.isToday ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {day.dayNum}
                    </span>
                    {day.actualProducedFinalQc > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[13px] font-semibold ${
                        isTargetMet ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {day.achievementPct}%
                      </span>
                    )}
                  </div>

                  <div className="my-auto text-center">
                    <div className="text-[13px] text-slate-500 font-semibold">Final QC Output</div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-950">
                      {day.actualProducedFinalQc}{' '}
                      <span className="text-[13px] font-normal text-slate-500">units</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[13px] text-slate-500 border-t border-slate-100 pt-1">
                    <span>Tgt: {day.dailyTarget}</span>
                    <span>Disp: {day.dispatchedUnits}</span>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* 4. DAY INSPECTION MODAL / DRAWER */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <span>Daily Production Breakdown: {selectedDayDetail.dateDisplay}</span>
                    <span className="text-[13px] tabular-nums font-normal text-slate-500">({selectedDayDetail.dayName})</span>
                  </h3>
                  <p className="text-[13px] text-slate-500">
                    Verified Final Passed units, stage-wise PMS throughput, and inspector submissions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDayDetail(null)}
                className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Quick KPI Bar */}
            <div className="px-5 py-3 bg-indigo-50/40 border-b border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
              <div>
                <span className="text-slate-500 text-[13px] block">Actual produced</span>
                <span className="text-base font-semibold tabular-nums text-emerald-700">
                  {selectedDayDetail.actualProducedFinalQc} units
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[13px] block">Daily Target</span>
                <span className="text-base font-semibold tabular-nums text-slate-800">
                  {selectedDayDetail.dailyTarget} units
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[13px] block">Dispatched</span>
                <span className="text-base font-semibold tabular-nums text-slate-800">
                  {selectedDayDetail.dispatchedUnits} units
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[13px] block">Active Floor Steps</span>
                <span className="text-base font-semibold tabular-nums text-indigo-700">
                  {(Object.values(selectedDayDetail.stageBreakdown) as DayStepData[]).filter(s => s.unitCount > 0).length} of 14 steps
                </span>
              </div>
            </div>

            {/* Tab Controls inside Modal */}
            <div className="px-5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-4 text-[13px] font-semibold text-slate-600">
              <button
                onClick={() => setSelectedModalTab('stages')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  selectedModalTab === 'stages' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent hover:text-slate-900'
                }`}
              >
                14-Stage Floor Summary
              </button>
              <button
                onClick={() => setSelectedModalTab('orders')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  selectedModalTab === 'orders' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Work Orders Completed ({selectedDayDetail.uniqueOrdersProcessedCount})
              </button>
              <button
                onClick={() => setSelectedModalTab('qcBatches')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  selectedModalTab === 'qcBatches' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Final QC Inspections ({selectedDayDetail.qcSubmissionsCount})
              </button>
              <button
                onClick={() => setSelectedModalTab('dispatchBatches')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  selectedModalTab === 'dispatchBatches' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Dispatch Form Responses ({selectedDayDetail.dispatchSubmissions.length})
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: 14-STAGE FLOOR SUMMARY */}
              {selectedModalTab === 'stages' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRODUCTION_STAGES.map((stg) => {
                    const stepData = selectedDayDetail.stageBreakdown[stg];
                    const isFinalQc = stg === 'QUALITY CONTROL';
                    const isDispatch = stg === 'DISPATCH';

                    return (
                      <div
                        key={stg}
                        className={`p-3.5 rounded-xl border flex items-center justify-between ${
                          isFinalQc
                            ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-200'
                            : isDispatch && stepData.unitCount > 0
                              ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200'
                              : stepData.unitCount > 0
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-white border-slate-200/60 opacity-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold tabular-nums text-slate-500">{stepData.stepCode}</span>
                            <span className="text-[13px] font-semibold text-slate-900">{stg}</span>
                            {isFinalQc && (
                              <span className="px-1.5 py-0.2 rounded-full text-[13px] font-semibold bg-emerald-600 text-white">
                                KPI ACTUAL
                              </span>
                            )}
                            {isDispatch && (
                              <span className="px-1.5 py-0.2 rounded-full text-[13px] font-semibold bg-indigo-600 text-white">
                                FORM DISPATCH
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-slate-500 mt-0.5">
                            Lead: {stepData.responsible}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-base font-semibold tabular-nums text-slate-900">
                            {stepData.unitCount} <span className="text-[13px] font-normal text-slate-500">{isDispatch ? 'boxes' : 'units'}</span>
                          </div>
                          <div className="text-[13px] font-semibold text-slate-500 tabular-nums">
                            {isDispatch ? `${stepData.orderCount} entries` : `${stepData.orderCount} orders`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: WORK ORDERS COMPLETED TABLE */}
              {selectedModalTab === 'orders' && (
                <div className="space-y-3">
                  {selectedDayDetail.totalStepActivitiesCount === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-[13px]">
                      No orders were completed on this date.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-[13px] text-left border-collapse bg-white">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-[13px]  border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Order no.</th>
                            <th className="p-2.5">Model / Upholstery</th>
                            <th className="p-2.5 text-right">Units</th>
                            <th className="p-2.5">Step</th>
                            <th className="p-2.5">Responsible</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans text-[13px]">
                          {(Object.values(selectedDayDetail.stageBreakdown) as DayStepData[])
                            .flatMap(s => s.orders.map(o => ({ ...o, stageName: s.stage, stepCode: s.stepCode })))
                            .map((ord, idx) => (
                              <tr key={`${ord.opfNo}-${ord.stageName}-${idx}`} className="hover:bg-slate-50">
                                <td className="p-2.5 font-semibold text-indigo-700 tabular-nums">{ord.opfNo}</td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-800">{ord.modelName}</div>
                                  <div className="text-[13px] text-slate-500">{ord.upholstery}</div>
                                </td>
                                <td className="p-2.5 text-right tabular-nums font-semibold text-slate-900">{ord.quantity}</td>
                                <td className="p-2.5">
                                  <span className="tabular-nums text-[13px] text-slate-500 mr-1">{ord.stepCode}</span>
                                  <span className="font-medium text-slate-800">{ord.stageName}</span>
                                </td>
                                <td className="p-2.5 text-slate-600">{ord.responsible}</td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {ord.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-500 text-[13px] max-w-xs truncate">{ord.remarks || '-'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FINAL QC INSPECTIONS TABLE */}
              {selectedModalTab === 'qcBatches' && (
                <div className="space-y-3">
                  {selectedDayDetail.qcSubmissions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-[13px]">
                      No Google Form Final QC submissions recorded on {selectedDayDetail.dateDisplay}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-[13px] text-left border-collapse bg-white">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-[13px]  border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Timestamp</th>
                            <th className="p-2.5">Order no.</th>
                            <th className="p-2.5 text-right">Pass Qty</th>
                            <th className="p-2.5 text-right">Rej Qty</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">QC Inspector</th>
                            <th className="p-2.5">Remarks</th>
                            <th className="p-2.5 text-center">Photos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans text-[13px]">
                          {selectedDayDetail.qcSubmissions.map((rec, idx) => (
                            <tr key={`${rec.opfNo}-${idx}`} className="hover:bg-slate-50">
                              <td className="p-2.5 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{rec.timestamp}</td>
                              <td className="p-2.5 font-semibold tabular-nums text-indigo-700">{rec.opfNo}</td>
                              <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">{rec.passQuantity}</td>
                              <td className="p-2.5 text-right tabular-nums text-rose-600">{rec.rejectedQuantity || 0}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[13px] font-semibold ${
                                  rec.status === 'Pass' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700 font-medium">{rec.qcInspector}</td>
                              <td className="p-2.5 text-slate-600 text-[13px] max-w-xs truncate">{rec.passRemarks || '-'}</td>
                              <td className="p-2.5 text-center">
                                {rec.productImageUrls.length > 0 ? (
                                  <a
                                    href={rec.productImageUrls[0]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline text-[13px] font-semibold inline-flex items-center gap-0.5"
                                  >
                                    <span>{rec.productImageUrls.length} pic(s)</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-slate-500">-</span>
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

              {/* TAB 4: DISPATCH FORM RESPONSES TABLE */}
              {selectedModalTab === 'dispatchBatches' && (
                <div className="space-y-3">
                  {selectedDayDetail.dispatchSubmissions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-[13px]">
                      No Google Form Dispatch submissions recorded on {selectedDayDetail.dateDisplay}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-[13px] text-left border-collapse bg-white">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-[13px]  border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Timestamp</th>
                            <th className="p-2.5">Order no.</th>
                            <th className="p-2.5">Model Name</th>
                            <th className="p-2.5 text-right">Boxes / Cartons</th>
                            <th className="p-2.5">Responsible</th>
                            <th className="p-2.5">Remarks / Details</th>
                            <th className="p-2.5 text-center">Photo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans text-[13px]">
                          {selectedDayDetail.dispatchSubmissions.map((rec, idx) => (
                            <tr key={`${rec.id || rec.opfNo}-${idx}`} className="hover:bg-slate-50">
                              <td className="p-2.5 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{rec.timestamp || '-'}</td>
                              <td className="p-2.5 font-semibold tabular-nums text-indigo-700">{rec.opfNo || 'Direct Dispatch'}</td>
                              <td className="p-2.5 font-semibold text-slate-800">{rec.modelName || 'Dispatched Consignment'}</td>
                              <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">{rec.quantity} boxes</td>
                              <td className="p-2.5 text-slate-700 font-medium">Mr. Umesh</td>
                              <td className="p-2.5 text-slate-600 text-[13px] max-w-xs truncate">{rec.remarks || '-'}</td>
                              <td className="p-2.5 text-center">
                                {rec.pictureUrl ? (
                                  <a
                                    href={rec.pictureUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline text-[13px] font-semibold inline-flex items-center gap-0.5"
                                  >
                                    <span>View</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-slate-500">-</span>
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

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
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

export default DailyProductionStepView;
