import React, { useState, useMemo } from 'react';
import type { Order, ProductionStep, ProductionStepName } from '../types';
import { STAGE_CONFIGS, PRODUCTION_STAGES, STAGE_OFFSETS, RESPONSIBLE_PERSONS } from '../constants';
import { 
  normalizeToYMD, 
  formatYMD, 
  parseYMD, 
  addDaysToYMD, 
  diffDaysYMD, 
  formatDisplayDate,
  formatDateDDMMMYYYY,
  getDayOfWeekYMD,
  MONTH_NAMES_FULL,
  MONTH_NAMES_SHORT
} from '../utils/dateUtils';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Box, 
  Layers, 
  User, 
  Sparkles, 
  ArrowRight,
  Filter,
  BarChart2,
  CalendarDays,
  ListTodo,
  CheckCircle,
  AlertCircle,
  Eye,
  Info,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  Check,
  Zap,
  Target,
  Search,
  CheckSquare
} from 'lucide-react';

interface ProductionPlannerCalendarProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export interface CalendarStepMilestone {
  order: Order;
  step: ProductionStep;
  stageName: ProductionStepName;
  stepCode: string;
  timeline: string;
  owner: string;
  status: ProductionStep['status'];
  plannedDate: string;
  actualDate: string | null;
  delay: number | null;
  remarks?: string | null;
  qtyPass?: number | null;
  reasonOfFail?: string | null;
  attachment?: string | null;
}

const STAGE_ORDER_INDEX: { [key: string]: number } = {};
PRODUCTION_STAGES.forEach((stage, idx) => {
  STAGE_ORDER_INDEX[stage] = idx;
});

export const ProductionPlannerCalendar: React.FC<ProductionPlannerCalendarProps> = ({ 
  orders, 
  onSelectOrder 
}) => {
  // Reference Operational Date: '2026-09-01' (1st September 2026)
  const todayYMD = '2026-09-01';

  // Navigation State: Year & Month (1-12)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9); // 9 = September

  // Selected Date on Calendar: defaults to today
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-09-01');

  // Sub-tab inside planner: 'month' | 'backlog' | '7day' | 'stage-matrix'
  const [plannerTab, setPlannerTab] = useState<'month' | 'backlog' | '7day' | 'stage-matrix'>('month');

  // Filters within planner
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [ownerFilter, setOwnerFilter] = useState<string>('All');
  const [stepStatusFilter, setStepStatusFilter] = useState<string>('All');
  const [dayViewTab, setDayViewTab] = useState<'all' | 'steps' | 'dispatches'>('all');
  const [daySearchQuery, setDaySearchQuery] = useState<string>('');
  const [backlogAgeingFilter, setBacklogAgeingFilter] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');

  // Helper to calculate planned milestone date for a specific stage
  const calculateStepPlannedDate = (dispatchDateStr: string | null, stageName: ProductionStepName): string | null => {
    if (!dispatchDateStr) return null;
    const norm = normalizeToYMD(dispatchDateStr);
    if (!norm) return null;
    const offset = STAGE_OFFSETS[stageName] ?? 0;
    return addDaysToYMD(norm, -offset);
  };

  // Enriched orders with schedule intelligence & backlog classification
  const enrichedOrders = useMemo(() => {
    return orders.map(order => {
      const normDispatch = normalizeToYMD(order.dispatchDate);
      const isDispatched = order.overallStatus === 'Dispatched';
      const isReady = order.overallStatus === 'Ready';

      let isOverdue = false;
      let daysOverdue = 0;
      let daysUntilDispatch: number | null = null;
      let isAtRisk = false;
      let isBacklog = false;
      let backlogSeverity: 'critical' | 'high' | 'moderate' | 'none' = 'none';

      if (normDispatch) {
        // daysUntilDispatch = normDispatch - today (positive if in future, negative if past)
        daysUntilDispatch = diffDaysYMD(normDispatch, todayYMD);

        if (!isDispatched) {
          if (daysUntilDispatch < 0) {
            isOverdue = true;
            isBacklog = true;
            daysOverdue = Math.abs(daysUntilDispatch);

            if (daysOverdue >= 8) backlogSeverity = 'critical';
            else if (daysOverdue >= 4) backlogSeverity = 'high';
            else backlogSeverity = 'moderate';
          } else if (order.overallStatus === 'On Hold') {
            isBacklog = true;
            isAtRisk = true;
            backlogSeverity = 'high';
          } else if (order.currentStage) {
            const currentIdx = STAGE_ORDER_INDEX[order.currentStage] ?? 0;
            let idealStageIdx = 0;
            for (let i = PRODUCTION_STAGES.length - 1; i >= 0; i--) {
              const stg = PRODUCTION_STAGES[i];
              const offset = STAGE_OFFSETS[stg] ?? 0;
              if (daysUntilDispatch <= offset) {
                idealStageIdx = i;
                break;
              }
            }

            if (currentIdx < idealStageIdx - 1) {
              isAtRisk = true;
              isBacklog = true;
              backlogSeverity = 'moderate';
            }
          }
        }
      }

      // Next expected milestone
      let nextExpectedMilestone: { stage: ProductionStepName; dateStr: string | null; owner: string } | null = null;
      if (order.currentStage && !isDispatched && !isReady) {
        const planned = calculateStepPlannedDate(normDispatch, order.currentStage);
        const cfg = STAGE_CONFIGS[order.currentStage];
        nextExpectedMilestone = {
          stage: order.currentStage,
          dateStr: planned,
          owner: cfg ? cfg.responsible : order.currentResponsible || 'Unassigned',
        };
      }

      return {
        ...order,
        normalizedDispatchDate: normDispatch,
        daysUntilDispatch,
        isOverdue,
        daysOverdue,
        isAtRisk,
        isBacklog,
        backlogSeverity,
        nextExpectedMilestone,
      };
    });
  }, [orders, todayYMD]);

  // Backlog-specific dataset
  const backlogOrders = useMemo(() => {
    return enrichedOrders.filter(o => o.isBacklog && o.overallStatus !== 'Dispatched');
  }, [enrichedOrders]);

  // Backlog metrics and clearing intelligence
  const backlogStats = useMemo(() => {
    const totalBacklogOrders = backlogOrders.length;
    const totalBacklogUnits = backlogOrders.reduce((sum, o) => sum + o.quantity, 0);

    const criticalOrders = backlogOrders.filter(o => o.backlogSeverity === 'critical');
    const highRiskOrders = backlogOrders.filter(o => o.backlogSeverity === 'high');
    const moderateOrders = backlogOrders.filter(o => o.backlogSeverity === 'moderate');

    // Group backlog by current stage
    const stageBreakdown: { [key: string]: { count: number; units: number; responsible: string } } = {};
    backlogOrders.forEach(o => {
      const stg = o.currentStage || 'Unknown';
      if (!stageBreakdown[stg]) {
        const cfg = STAGE_CONFIGS[stg as ProductionStepName];
        stageBreakdown[stg] = { count: 0, units: 0, responsible: cfg?.responsible || o.currentResponsible || 'Unassigned' };
      }
      stageBreakdown[stg].count++;
      stageBreakdown[stg].units += o.quantity;
    });

    // Group backlog by responsible person
    const ownerBreakdown: { [key: string]: { count: number; units: number } } = {};
    backlogOrders.forEach(o => {
      const owner = o.currentResponsible || 'Unassigned';
      if (!ownerBreakdown[owner]) {
        ownerBreakdown[owner] = { count: 0, units: 0 };
      }
      ownerBreakdown[owner].count++;
      ownerBreakdown[owner].units += o.quantity;
    });

    return {
      totalBacklogOrders,
      totalBacklogUnits,
      criticalCount: criticalOrders.length,
      criticalUnits: criticalOrders.reduce((s, o) => s + o.quantity, 0),
      highCount: highRiskOrders.length,
      highUnits: highRiskOrders.reduce((s, o) => s + o.quantity, 0),
      moderateCount: moderateOrders.length,
      moderateUnits: moderateOrders.reduce((s, o) => s + o.quantity, 0),
      stageBreakdown,
      ownerBreakdown,
    };
  }, [backlogOrders]);

  // Filtered orders for calendar view
  const filteredCalendarOrders = useMemo(() => {
    return enrichedOrders.filter(order => {
      if (stageFilter !== 'All') {
        const hasStage = order.currentStage === stageFilter || order.steps.some(s => s.name === stageFilter);
        if (!hasStage) return false;
      }
      if (ownerFilter !== 'All') {
        const hasOwner = order.currentResponsible === ownerFilter || order.steps.some(s => s.responsible === ownerFilter);
        if (!hasOwner) return false;
      }
      return true;
    });
  }, [enrichedOrders, stageFilter, ownerFilter]);

  // Date Maps: Exact YYYY-MM-DD -> Orders Scheduled for Final Dispatch
  const dispatchDateMap = useMemo(() => {
    const map = new Map<string, { orders: typeof enrichedOrders; totalUnits: number }>();
    filteredCalendarOrders.forEach(order => {
      if (order.normalizedDispatchDate) {
        const key = order.normalizedDispatchDate;
        if (!map.has(key)) {
          map.set(key, { orders: [], totalUnits: 0 });
        }
        const entry = map.get(key)!;
        entry.orders.push(order);
        entry.totalUnits += order.quantity;
      }
    });
    return map;
  }, [filteredCalendarOrders]);

  // Step Milestones Map: Exact YYYY-MM-DD -> All individual steps planned across orders for that date
  const stepMilestoneMap = useMemo(() => {
    const map = new Map<string, CalendarStepMilestone[]>();

    filteredCalendarOrders.forEach(order => {
      order.steps.forEach(step => {
        // Step planned date: from sheet or calculated from dispatch date offset
        let stepPlannedDate = normalizeToYMD(step.plannedDate);
        if (!stepPlannedDate && order.normalizedDispatchDate) {
          stepPlannedDate = calculateStepPlannedDate(order.normalizedDispatchDate, step.name);
        }

        if (stepPlannedDate) {
          // Check stage filter
          if (stageFilter !== 'All' && step.name !== stageFilter) return;
          // Check owner filter
          if (ownerFilter !== 'All' && step.responsible !== ownerFilter) return;
          // Check step status filter
          if (stepStatusFilter !== 'All') {
            if (stepStatusFilter === 'Completed' && step.status !== 'Completed') return;
            if (stepStatusFilter === 'WIP' && step.status !== 'In Progress') return;
            if (stepStatusFilter === 'Delayed' && step.status !== 'Delayed' && (!step.delay || step.delay <= 0)) return;
            if (stepStatusFilter === 'Pending' && step.status !== 'Pending') return;
          }

          if (!map.has(stepPlannedDate)) {
            map.set(stepPlannedDate, []);
          }

          map.get(stepPlannedDate)!.push({
            order,
            step,
            stageName: step.name,
            stepCode: step.stepCode,
            timeline: step.timeline,
            owner: step.responsible,
            status: step.status,
            plannedDate: stepPlannedDate,
            actualDate: step.actualDate,
            delay: step.delay,
            remarks: step.remarks,
            qtyPass: step.qtyPass,
            reasonOfFail: step.reasonOfFail,
            attachment: step.attachment,
          });
        }
      });
    });

    return map;
  }, [filteredCalendarOrders, stageFilter, ownerFilter, stepStatusFilter]);

  // Detect all active months with scheduled steps or dispatches for quick jump navigation
  const activePeriodsList = useMemo(() => {
    const periodMap = new Map<string, { year: number; month: number; label: string; count: number }>();

    stepMilestoneMap.forEach((tasks, dateKey) => {
      const parsed = parseYMD(dateKey);
      if (parsed) {
        const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            year: parsed.year,
            month: parsed.month,
            label: `${MONTH_NAMES_SHORT[parsed.month - 1]} ${parsed.year}`,
            count: 0,
          });
        }
        periodMap.get(key)!.count += tasks.length;
      }
    });

    dispatchDateMap.forEach((data, dateKey) => {
      const parsed = parseYMD(dateKey);
      if (parsed) {
        const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            year: parsed.year,
            month: parsed.month,
            label: `${MONTH_NAMES_SHORT[parsed.month - 1]} ${parsed.year}`,
            count: 0,
          });
        }
        periodMap.get(key)!.count += data.orders.length;
      }
    });

    return Array.from(periodMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [stepMilestoneMap, dispatchDateMap]);

  // Generate Calendar Days with Pure YMD Math
  const calendarDays = useMemo(() => {
    const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
    const startingDayOfWeek = getDayOfWeekYMD(currentYear, currentMonth, 1); // 0 = Sun, 1 = Mon ...

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isPast: boolean;
      dispatches: typeof enrichedOrders;
      dispatchUnits: number;
      milestones: CalendarStepMilestone[];
      hasOverdue: boolean;
      hasDelayedSteps: boolean;
    }> = [];

    // Previous month padding
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthTotalDays = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const dateStr = formatYMD(prevYear, prevMonth, dayNum);
      const disp = dispatchDateMap.get(dateStr);
      const ms = stepMilestoneMap.get(dateStr) || [];
      const isPast = diffDaysYMD(dateStr, todayYMD) < 0;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedDateStr,
        isPast,
        dispatches: disp?.orders || [],
        dispatchUnits: disp?.totalUnits || 0,
        milestones: ms,
        hasOverdue: (disp?.orders || []).some(o => o.isOverdue),
        hasDelayedSteps: ms.some(m => m.status === 'Delayed' || (m.delay !== null && m.delay > 0)),
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = formatYMD(currentYear, currentMonth, dayNum);
      const disp = dispatchDateMap.get(dateStr);
      const ms = stepMilestoneMap.get(dateStr) || [];
      const isPast = diffDaysYMD(dateStr, todayYMD) < 0;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedDateStr,
        isPast,
        dispatches: disp?.orders || [],
        dispatchUnits: disp?.totalUnits || 0,
        milestones: ms,
        hasOverdue: (disp?.orders || []).some(o => o.isOverdue),
        hasDelayedSteps: ms.some(m => m.status === 'Delayed' || (m.delay !== null && m.delay > 0)),
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = 35 - days.length >= 0 ? 35 - days.length : 42 - days.length;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const dateStr = formatYMD(nextYear, nextMonth, dayNum);
      const disp = dispatchDateMap.get(dateStr);
      const ms = stepMilestoneMap.get(dateStr) || [];
      const isPast = diffDaysYMD(dateStr, todayYMD) < 0;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedDateStr,
        isPast,
        dispatches: disp?.orders || [],
        dispatchUnits: disp?.totalUnits || 0,
        milestones: ms,
        hasOverdue: (disp?.orders || []).some(o => o.isOverdue),
        hasDelayedSteps: ms.some(m => m.status === 'Delayed' || (m.delay !== null && m.delay > 0)),
      });
    }

    return days;
  }, [currentYear, currentMonth, dispatchDateMap, stepMilestoneMap, selectedDateStr, todayYMD]);

  // Selected Day Details
  const selectedDayInfo = useMemo(() => {
    const disp = dispatchDateMap.get(selectedDateStr);
    const ms = stepMilestoneMap.get(selectedDateStr) || [];
    const formattedTitle = formatDisplayDate(selectedDateStr, true);
    const isPast = diffDaysYMD(selectedDateStr, todayYMD) < 0;

    const completedSteps = ms.filter(m => m.status === 'Completed').length;
    const wipSteps = ms.filter(m => m.status === 'In Progress').length;
    const pendingSteps = ms.filter(m => m.status === 'Pending').length;
    const delayedSteps = ms.filter(m => m.status === 'Delayed' || (m.delay !== null && m.delay > 0)).length;

    // Filter milestones by in-day search query
    let filteredMs = ms;
    if (daySearchQuery.trim()) {
      const q = daySearchQuery.toLowerCase().trim();
      filteredMs = filteredMs.filter(m => 
        m.order.opfNo.toLowerCase().includes(q) ||
        m.order.modelName.toLowerCase().includes(q) ||
        m.stageName.toLowerCase().includes(q) ||
        m.owner.toLowerCase().includes(q) ||
        m.stepCode.toLowerCase().includes(q)
      );
    }

    // Filter dispatches by in-day search query
    let filteredDispatches = disp?.orders || [];
    if (daySearchQuery.trim()) {
      const q = daySearchQuery.toLowerCase().trim();
      filteredDispatches = filteredDispatches.filter(o => 
        o.opfNo.toLowerCase().includes(q) ||
        o.modelName.toLowerCase().includes(q) ||
        (o.currentResponsible && o.currentResponsible.toLowerCase().includes(q))
      );
    }

    return {
      dateStr: selectedDateStr,
      formattedTitle,
      isToday: selectedDateStr === todayYMD,
      isPast,
      dispatches: filteredDispatches,
      rawDispatchesCount: disp?.orders.length || 0,
      totalUnits: disp?.totalUnits || 0,
      milestones: filteredMs,
      rawMilestonesCount: ms.length,
      completedSteps,
      wipSteps,
      pendingSteps,
      delayedSteps,
    };
  }, [selectedDateStr, dispatchDateMap, stepMilestoneMap, todayYMD, daySearchQuery]);

  // 7-Day Rolling Horizon Days
  const weekHorizonDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToYMD(todayYMD, i) || todayYMD;
      const disp = dispatchDateMap.get(dateStr);
      const ms = stepMilestoneMap.get(dateStr) || [];
      const isToday = dateStr === todayYMD;

      list.push({
        dateStr,
        isToday,
        dayName: isToday ? 'Today (01 Sep)' : formatDisplayDate(dateStr, false),
        dispatches: disp?.orders || [],
        totalUnits: disp?.totalUnits || 0,
        milestones: ms,
      });
    }
    return list;
  }, [dispatchDateMap, stepMilestoneMap, todayYMD]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentMonth(9);
    setCurrentYear(2026);
    setSelectedDateStr(todayYMD);
  };

  const handleSelectPeriod = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    // Find first date in that month that has scheduled events
    const firstDate = formatYMD(year, month, 1);
    setSelectedDateStr(firstDate);
  };

  // Filtered Backlog List
  const filteredBacklogList = useMemo(() => {
    return backlogOrders.filter(order => {
      if (backlogAgeingFilter === 'critical' && order.backlogSeverity !== 'critical') return false;
      if (backlogAgeingFilter === 'high' && order.backlogSeverity !== 'high') return false;
      if (backlogAgeingFilter === 'moderate' && order.backlogSeverity !== 'moderate') return false;
      return true;
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [backlogOrders, backlogAgeingFilter]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner: Standalone Production Planning & Backlog Management */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Tap a day to see what is planned and who owns it</p>
          </div>
                    {/* Quick Backlog & Planning Summary Pill Cards */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Backlog Alert Trigger */}
            <button
              onClick={() => setPlannerTab('backlog')}
              className={`p-2.5 px-3.5 rounded-xl border transition-all text-left flex items-center gap-3 ${
                backlogStats.totalBacklogOrders > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 hover:border-rose-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${backlogStats.totalBacklogOrders > 0 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold block opacity-80">
                  Backlog Orders
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {backlogStats.totalBacklogOrders} Orders ({backlogStats.totalBacklogUnits} units)
                </span>
              </div>
            </button>

            {/* Today's Step Tasks */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 px-3.5 text-center">
              <span className="text-xs text-slate-500 block font-semibold">Due today</span>
              <span className="text-sm font-semibold text-indigo-700 tabular-nums">
                {stepMilestoneMap.get(todayYMD)?.length || 0} Steps
              </span>
            </div>

            {/* Next 7 Days Quota */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 px-3.5 text-center">
              <span className="text-xs text-slate-500 block font-semibold">Next 7 days</span>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">
                {weekHorizonDays.reduce((s, d) => s + d.dispatches.length, 0)} Orders
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Nav Controls & Stage/Owner Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setPlannerTab('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
              plannerTab === 'month'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => setPlannerTab('backlog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
              plannerTab === 'backlog'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Backlog ({backlogStats.totalBacklogOrders})</span>
          </button>

          <button
            onClick={() => setPlannerTab('7day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
              plannerTab === '7day'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Next 7 days</span>
          </button>

          <button
            onClick={() => setPlannerTab('stage-matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
              plannerTab === 'stage-matrix'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lead times</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Stage Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs font-medium">Stage:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="All">All stages</option>
              {PRODUCTION_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs font-medium">Owner:</span>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              {RESPONSIBLE_PERSONS.map(owner => (
                <option key={owner} value={owner}>
                  {owner === 'All' ? 'All owners' : owner}
                </option>
              ))}
            </select>
          </div>

          {/* Step Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs font-medium">Step Status:</span>
            <select
              value={stepStatusFilter}
              onChange={(e) => setStepStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="All">Any status</option>
              <option value="WIP">WIP (In Progress)</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY CALENDAR GRID + INTERACTIVE DAY AGENDA */}
      {plannerTab === 'month' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Main Month Calendar Grid (7 cols on XL) */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs space-y-4">
            {/* Month & Year Header with Quick Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                  className="font-semibold text-base md:text-lg text-slate-900 bg-transparent border-b border-slate-300 focus:border-indigo-600 focus:outline-none py-0.5 cursor-pointer"
                >
                  {MONTH_NAMES_FULL.map((name, idx) => (
                    <option key={name} value={idx + 1}>{name}</option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                  className="font-semibold text-base md:text-lg text-slate-900 bg-transparent border-b border-slate-300 focus:border-indigo-600 focus:outline-none py-0.5 cursor-pointer tabular-nums"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                <button
                  onClick={handleJumpToToday}
                  className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  Today (01 Sep)
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day of week headers */}
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 py-1 border-b border-slate-100">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDateStr;
                const hasDispatches = cell.dispatches.length > 0;
                const hasMilestones = cell.milestones.length > 0;

                return (
                  <div
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => {
                      setSelectedDateStr(cell.dateStr);
                      setDaySearchQuery('');
                    }}
                    className={`min-h-[88px] md:min-h-[96px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-600/40 shadow-sm'
                        : cell.isToday
                        ? 'border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60'
                        : cell.isCurrentMonth
                        ? 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80'
                        : 'border-slate-100 bg-slate-50/40 text-slate-400'
                    }`}
                  >
                    {/* Top Row: Day Number & Badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                          cell.isToday
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : isSelected
                            ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                            : cell.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {cell.isToday && (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Middle / Bottom: Step Tasks and Dispatch Badges */}
                    <div className="space-y-1 mt-1">
                      {hasMilestones && (
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border truncate flex items-center justify-between ${
                            cell.hasDelayedSteps
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                          title={`${cell.milestones.length} stage tasks scheduled on this day`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 shrink-0 text-indigo-600" />
                            <span>{cell.milestones.length} Steps</span>
                          </span>
                        </div>
                      )}

                      {hasDispatches && (
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold truncate flex items-center justify-between ${
                            cell.hasOverdue
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                          title={`${cell.dispatches.length} orders planned for dispatch (${cell.dispatchUnits} units)`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Truck className="w-2.5 h-2.5 shrink-0" />
                            <span>{cell.dispatches.length} Disp</span>
                          </span>
                          <span className="tabular-nums text-xs">{cell.dispatchUnits}u</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Planned Step Tasks
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Planned Dispatches
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Delayed Tasks
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Selected Date
                </span>
              </div>
              <span className="text-xs text-slate-400 tabular-nums"></span>
            </div>
          </div>

          {/* Right Side: Selected Day Interactive Task Agenda (5 cols on XL) */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Selected Day Header */}
              <div className="border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm md:text-base">
                        {selectedDayInfo.formattedTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {selectedDayInfo.isToday && (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                            Busy day
                          </span>
                        )}
                        {selectedDayInfo.isPast && !selectedDayInfo.isToday && (
                          <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            🚨 Past Date
                          </span>
                        )}
                        <span className="text-xs text-slate-500 tabular-nums">
                          {selectedDayInfo.dateStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary counts badge */}
                  <div className="flex items-center gap-1.5 text-xs tabular-nums">
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                      {selectedDayInfo.rawMilestonesCount} Steps
                    </span>
                    <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {selectedDayInfo.rawDispatchesCount} Disp ({selectedDayInfo.totalUnits}u)
                    </span>
                  </div>
                </div>

                {/* KPI Breakdown for the selected date */}
                <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-400 font-semibold block">Total Tasks</span>
                    <span className="font-semibold text-slate-800 tabular-nums text-sm">
                      {selectedDayInfo.rawMilestonesCount + selectedDayInfo.rawDispatchesCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="text-xs font-semibold block opacity-80">Completed</span>
                    <span className="font-semibold tabular-nums text-sm">{selectedDayInfo.completedSteps}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800">
                    <span className="text-xs font-semibold block opacity-80">WIP / Active</span>
                    <span className="font-semibold tabular-nums text-sm">{selectedDayInfo.wipSteps}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="text-xs font-semibold block opacity-80">Delayed</span>
                    <span className="font-semibold tabular-nums text-sm">{selectedDayInfo.delayedSteps}</span>
                  </div>
                </div>
              </div>

              {/* View Switcher & Search inside the Day View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      onClick={() => setDayViewTab('all')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        dayViewTab === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({selectedDayInfo.rawMilestonesCount + selectedDayInfo.rawDispatchesCount})
                    </button>
                    <button
                      onClick={() => setDayViewTab('steps')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        dayViewTab === 'steps' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Steps ({selectedDayInfo.rawMilestonesCount})
                    </button>
                    <button
                      onClick={() => setDayViewTab('dispatches')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        dayViewTab === 'dispatches' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dispatches ({selectedDayInfo.rawDispatchesCount})
                    </button>
                  </div>

                  {/* Day Search Input */}
                  <div className="relative flex-1 max-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={daySearchQuery}
                      onChange={(e) => setDaySearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Scrollable list of orders & tasks for the selected date */}
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                {/* 1. Planned Steps for this day */}
                {(dayViewTab === 'all' || dayViewTab === 'steps') && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <Clock className="w-3.5 h-3.5" /> Planned Stage Steps ({selectedDayInfo.milestones.length})
                      </span>
                    </h4>

                    {selectedDayInfo.milestones.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedDayInfo.milestones.map((item, idx) => (
                          <div
                            key={`${item.order.opfNo}-${item.stageName}-${idx}`}
                            onClick={() => onSelectOrder(item.order)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 transition-all cursor-pointer shadow-xs space-y-2 text-xs group"
                          >
                            {/* Step Header: Step Code & Stage & Status Pill */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 tabular-nums">
                                  {item.stepCode}
                                </span>
                                <span className="font-semibold text-slate-900 text-xs">
                                  {item.stageName}
                                </span>
                              </div>

                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                item.status === 'In Progress' ? 'bg-indigo-100 text-indigo-800 animate-pulse' :
                                item.status === 'Delayed' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {item.status === 'Completed' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                {item.status === 'Delayed' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                <span>{item.status}</span>
                              </span>
                            </div>

                            {/* Order Details & Model */}
                            <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div className="space-y-0.5 truncate pr-2">
                                <span className="tabular-nums font-semibold text-indigo-700 block">
                                  {item.order.opfNo}
                                </span>
                                <span className="text-slate-700 font-medium truncate block" title={item.order.modelName}>
                                  {item.order.modelName}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-slate-900 font-semibold tabular-nums text-xs">
                                  {item.order.quantity} units
                                </span>
                                <span className="text-xs text-slate-500 block">
                                  Disp: {formatDateDDMMMYYYY(item.order.dispatchDate)}
                                </span>
                              </div>
                            </div>

                            {/* Timeline & Responsible Owner */}
                            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 gap-2">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span>Owner: <strong className="text-indigo-700">{item.owner}</strong></span>
                              </span>

                              <span className="flex items-center gap-1 text-slate-600">
                                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{item.timeline}</span>
                              </span>
                            </div>

                            {/* Remarks / Actual date / Delay if present */}
                            {(item.actualDate || item.remarks || (item.delay && item.delay > 0)) && (
                              <div className="text-[10.5px] bg-slate-50/80 p-1.5 rounded text-slate-600 space-y-0.5">
                                {item.actualDate && (
                                  <div>Done on: <strong className="text-emerald-700">{formatDateDDMMMYYYY(item.actualDate)}</strong></div>
                                )}
                                {item.delay && item.delay > 0 ? (
                                  <div className="text-rose-600 font-semibold">Delay: {item.delay} days</div>
                                ) : null}
                                {item.remarks && (
                                  <div className="italic text-slate-500 truncate">Remarks: {item.remarks}</div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-end text-xs text-indigo-600 font-semibold group-hover:underline pt-0.5">
                              <span>See all steps &rarr;</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                        No planned stage steps scheduled for {selectedDayInfo.formattedTitle}.
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Target Dispatches for this day */}
                {(dayViewTab === 'all' || dayViewTab === 'dispatches') && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <Truck className="w-3.5 h-3.5" /> Target Dispatches ({selectedDayInfo.dispatches.length})
                      </span>
                    </h4>

                    {selectedDayInfo.dispatches.length > 0 ? (
                      <div className="space-y-2.5">
                        {selectedDayInfo.dispatches.map(order => (
                          <div
                            key={order.opfNo}
                            onClick={() => onSelectOrder(order)}
                            className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-xs space-y-2 text-xs group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="tabular-nums text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {order.opfNo}
                              </span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                order.overallStatus === 'Dispatched' ? 'bg-emerald-100 text-emerald-700' :
                                order.overallStatus === 'Ready' ? 'bg-indigo-100 text-indigo-700' :
                                order.overallStatus === 'On Hold' ? 'bg-amber-100 text-amber-700' :
                                'bg-indigo-100 text-indigo-700'
                              }`}>
                                {order.overallStatus}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {order.modelName}
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-100">
                              <span>Qty: <strong className="text-slate-800">{order.quantity} units</strong></span>
                              <span className="truncate text-indigo-600 font-medium">
                                Current Stage: {order.currentStage ? order.currentStage.replace('OF UPHOLSTERY', '') : 'Ready for Dispatch'}
                              </span>
                            </div>

                            <div className="flex items-center justify-end text-xs text-indigo-600 font-semibold group-hover:underline pt-0.5">
                              <span>View Full Order Details &rarr;</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                        No final order dispatches planned for {selectedDayInfo.formattedTitle}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DEDICATED BACKLOG ANALYSIS & CLEARING ENGINE */}
      {plannerTab === 'backlog' && (
        <div className="space-y-6">
          {/* Backlog Overview Header & Clearing Strategy */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6 text-rose-600" />
                  <h3 className="text-lg md:text-xl font-semibold text-slate-900">
                    Active Production Backlog Analysis & Clearing Strategy
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  Deep dive into orders past their target dispatch date or delayed at interim stages. Follow the step-by-step clearance plan to restore 100% on-time delivery.
                </p>
              </div>

              {/* Ageing Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs text-xs">
                <button
                  onClick={() => setBacklogAgeingFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    backlogAgeingFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Backlog ({backlogStats.totalBacklogOrders})
                </button>
                <button
                  onClick={() => setBacklogAgeingFilter('critical')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    backlogAgeingFilter === 'critical'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Critical 8d+ ({backlogStats.criticalCount})
                </button>
                <button
                  onClick={() => setBacklogAgeingFilter('high')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    backlogAgeingFilter === 'high'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  High 4-7d ({backlogStats.highCount})
                </button>
                <button
                  onClick={() => setBacklogAgeingFilter('moderate')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    backlogAgeingFilter === 'moderate'
                      ? 'bg-indigo-600 text-white'
                      : 'text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  Moderate 1-3d ({backlogStats.moderateCount})
                </button>
              </div>
            </div>

            {/* Backlog Metrics Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">Total Backlog Load</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">{backlogStats.totalBacklogOrders}</span>
                  <span className="text-xs text-slate-500 font-semibold">orders ({backlogStats.totalBacklogUnits} units)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
                <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Critical Delay (8+ Days)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-rose-700 tabular-nums">{backlogStats.criticalCount}</span>
                  <span className="text-xs text-rose-500 font-semibold">orders ({backlogStats.criticalUnits} units)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> High Risk (4-7 Days)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-amber-700 tabular-nums">{backlogStats.highCount}</span>
                  <span className="text-xs text-amber-500 font-semibold">orders ({backlogStats.highUnits} units)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs">
                <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Fast-Trackable (1-3 Days)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold text-indigo-700 tabular-nums">{backlogStats.moderateCount}</span>
                  <span className="text-xs text-indigo-500 font-semibold">orders ({backlogStats.moderateUnits} units)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Data-Driven Department Backlog Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Real Data Stage Breakdown */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Target className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Delayed Orders by Stage</h4>
                  <p className="text-xs text-slate-500">Calculated directly from live PMS stage status</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                {Array.from(
                  filteredBacklogList.reduce((acc, order) => {
                    const stage = order.currentStage || 'Unassigned / Pending';
                    if (!acc.has(stage)) acc.set(stage, { count: 0, units: 0, owner: order.currentResponsible || 'Team' });
                    const entry = acc.get(stage)!;
                    entry.count += 1;
                    entry.units += order.quantity;
                    return acc;
                  }, new Map<string, { count: number; units: number; owner: string }>())
                ).map(([stageName, data]) => (
                  <div key={stageName} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block text-xs">{stageName}</span>
                      <span className="text-xs text-slate-500">Responsible: <strong className="text-indigo-600">{data.owner}</strong></span>
                    </div>
                    <div className="text-right">
                      <span className="tabular-nums font-semibold text-rose-700 text-xs block">{data.count} Orders</span>
                      <span className="tabular-nums text-xs text-slate-500">{data.units} units</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backlog Orders Table List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">
                    Backlog Queue ({filteredBacklogList.length} Orders)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Sorted by delay severity. Click any order to open full 14-step inspection modal.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {filteredBacklogList.reduce((s, o) => s + o.quantity, 0)} Total Units
                </span>
              </div>

              {filteredBacklogList.length > 0 ? (
                <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                  {filteredBacklogList.map(order => (
                    <div
                      key={order.opfNo}
                      onClick={() => onSelectOrder(order)}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white transition-all cursor-pointer space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {order.opfNo}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            order.backlogSeverity === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            order.backlogSeverity === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {order.daysOverdue > 0 ? `${order.daysOverdue} Days Overdue` : 'At Risk / On Hold'}
                          </span>
                        </div>

                        <span className="tabular-nums text-slate-700 font-semibold">
                          {order.quantity} Units
                        </span>
                      </div>

                      <div className="font-semibold text-slate-800">
                        {order.modelName}
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-200/60 gap-2">
                        <span>
                          Target Dispatch: <strong className="text-rose-600 tabular-nums">{formatDateDDMMMYYYY(order.dispatchDate)}</strong>
                        </span>
                        <span>
                          Stuck At: <strong className="text-indigo-600">{order.currentStage || 'Ready for Dispatch'}</strong>
                        </span>
                        <span>
                          Owner: <strong className="text-indigo-600">{order.currentResponsible}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="font-semibold text-slate-800">Zero orders matching this backlog filter!</p>
                  <p className="text-slate-400 mt-1">All production schedules in this category are fully on track.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: 7-DAY PRIORITY ROLLING HORIZON */}
      {plannerTab === '7day' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                7-Day Production Rolling Horizon (01-Sep-2026 to 07-Sep-2026)
              </h3>
              <p className="text-xs text-slate-500">
                Direct visibility into day-wise dispatch quotas & stage deadlines for the upcoming week
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekHorizonDays.map((day) => {
              const isToday = day.isToday;

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl border p-3 flex flex-col justify-between space-y-3 transition-all ${
                    isToday
                      ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-xs'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Column Header */}
                  <div className="border-b border-slate-200 pb-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {day.dayName}
                      </span>
                      {isToday && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1 tabular-nums">
                      <span>{day.dispatches.length} Disp</span>
                      <span>{day.milestones.length} Steps</span>
                    </div>
                  </div>

                  {/* Orders Queue in this day */}
                  <div className="space-y-2 flex-1 max-h-[380px] overflow-y-auto pr-1">
                    {/* Dispatches */}
                    {day.dispatches.map(order => (
                      <div
                        key={order.opfNo}
                        onClick={() => onSelectOrder(order)}
                        className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer shadow-xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="tabular-nums font-semibold text-emerald-800">{order.opfNo}</span>
                          <span className="tabular-nums text-xs text-emerald-700">{order.quantity}u</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 truncate" title={order.modelName}>
                          {order.modelName}
                        </div>
                        <div className="text-xs text-emerald-700 font-medium">
                          🚚 Planned Dispatch
                        </div>
                      </div>
                    ))}

                    {/* Step Tasks */}
                    {day.milestones.slice(0, 8).map((ms, idx) => (
                      <div
                        key={`${ms.order.opfNo}-${ms.stageName}-${idx}`}
                        onClick={() => onSelectOrder(ms.order)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="tabular-nums font-semibold text-slate-800 text-[10.5px]">{ms.order.opfNo}</span>
                          <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                            {ms.stepCode}
                          </span>
                        </div>
                        <div className="text-[10.5px] font-medium text-slate-700 truncate">
                          {ms.stageName}
                        </div>
                        <div className="text-xs text-indigo-600 truncate">
                          {ms.owner}
                        </div>
                      </div>
                    ))}

                    {day.milestones.length > 8 && (
                      <div className="text-center text-xs font-semibold text-indigo-700 py-1 bg-indigo-50 rounded">
                        +{day.milestones.length - 8} more steps planned
                      </div>
                    )}

                    {day.dispatches.length === 0 && day.milestones.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400 italic">
                        No tasks scheduled
                      </div>
                    )}
                  </div>

                  {/* Stage Milestones count */}
                  <div className="pt-2 border-t border-slate-200/80 text-xs text-indigo-700 flex items-center justify-between font-medium">
                    <span>Total Day Tasks:</span>
                    <span className="font-semibold tabular-nums">{day.milestones.length + day.dispatches.length} due</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: STEP LEAD TIME PLANNING MATRIX */}
      {plannerTab === 'stage-matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                14-Stage Lead Time & Standard PMS Cycle Planning
              </h3>
              <p className="text-xs text-slate-500">
                Reference lead times required before Target Dispatch Date for seamless on-time performance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {PRODUCTION_STAGES.map((stage) => {
              const cfg = STAGE_CONFIGS[stage];
              const activeCount = enrichedOrders.filter(o => o.currentStage === stage && o.overallStatus === 'WIP').length;
              const activeUnits = enrichedOrders.filter(o => o.currentStage === stage && o.overallStatus === 'WIP').reduce((s, o) => s + o.quantity, 0);

              return (
                <div
                  key={stage}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-300 transition-all flex flex-col justify-between space-y-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {cfg?.stepCode}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">
                        {activeCount} WIP ({activeUnits} units)
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 mt-2">
                      {stage}
                    </h4>

                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-600" />
                      <span>{cfg?.responsible}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Lead Time:
                    </span>
                    <strong className="text-slate-700">{cfg?.timeline}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionPlannerCalendar;
