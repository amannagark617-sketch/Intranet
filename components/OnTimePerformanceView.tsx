import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Download,
  HelpCircle,
  Package,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import type { OnTimeOverallMetrics, OnTimeOrderItem } from '../services/onTimeDeliveryService';
import { WeeklyOtdMatrixTable } from './WeeklyOtdMatrixTable';
import { exportOnTimeReportToExcel, exportOnTimeLedgerToExcel } from '../utils/excelExport';

interface OnTimePerformanceViewProps {
  onTimeMetrics: OnTimeOverallMetrics;
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
}

export const OnTimePerformanceView: React.FC<OnTimePerformanceViewProps> = ({
  onTimeMetrics,
  selectedMonth,
  onSelectMonth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'On-Time' | 'Partially Delayed' | 'Delayed' | 'Upcoming' | 'On Hold'>('all');
  const [monthScopeFilter, setMonthScopeFilter] = useState<string>(selectedMonth || 'all');
  const [weekScopeFilter, setWeekScopeFilter] = useState<string | null>(null);
  const [chartMetricMode, setChartMetricMode] = useState<'units' | 'orders'>('units');

  // Available weeks in current selected month (if month is specific)
  const availableWeeksInMonth = useMemo(() => {
    if (monthScopeFilter === 'all') return [];
    const matrix = onTimeMetrics.weeklyMatrices[monthScopeFilter];
    return matrix ? matrix.weeks : [];
  }, [monthScopeFilter, onTimeMetrics.weeklyMatrices]);

  // Active week object (if a week is filtered within selected month)
  const activeWeekObj = useMemo(() => {
    if (!weekScopeFilter || monthScopeFilter === 'all') return null;
    const matrix = onTimeMetrics.weeklyMatrices[monthScopeFilter];
    return matrix ? matrix.weeks.find((w) => w.weekName === weekScopeFilter) || null : null;
  }, [weekScopeFilter, monthScopeFilter, onTimeMetrics.weeklyMatrices]);

  // Reset week filter if month changes and the week is not present
  const handleMonthChange = (newMonth: string) => {
    setMonthScopeFilter(newMonth);
    setWeekScopeFilter(null);
    if (onSelectMonth && newMonth !== 'all') {
      onSelectMonth(newMonth);
    }
  };

  // Filtered order items
  const filteredOrders = useMemo(() => {
    return onTimeMetrics.orderItems.filter((item) => {
      // If a specific month is selected:
      if (monthScopeFilter !== 'all') {
        if (item.dispatchMonthKey !== monthScopeFilter && item.assignedMonthKey !== monthScopeFilter) {
          return false;
        }
        if (activeWeekObj) {
          // Strictly match orders whose dispatch date falls within this specific week's start & end dates
          const isInWeek = item.dispatchYMD && (
            item.dispatchYMD >= activeWeekObj.startDate && item.dispatchYMD <= activeWeekObj.endDate
          );
          if (!isInWeek) return false;
        }
      } else if (weekScopeFilter) {
        // If "all" months is selected, but user selected a week name, match by weekName
        if (item.weekName !== weekScopeFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOpf = item.opfNo.toLowerCase().includes(q);
        const matchModel = item.modelName.toLowerCase().includes(q);
        const matchCust = item.customerName ? item.customerName.toLowerCase().includes(q) : false;
        const matchExpl = item.statusExplanation.toLowerCase().includes(q);
        if (!matchOpf && !matchModel && !matchCust && !matchExpl) return false;
      }

      return true;
    });
  }, [onTimeMetrics.orderItems, monthScopeFilter, weekScopeFilter, activeWeekObj, statusFilter, searchTerm]);

  // Current scope metrics for selected month / week / all
  const scopeMetrics = useMemo(() => {
    let list = onTimeMetrics.orderItems;

    if (monthScopeFilter !== 'all') {
      list = list.filter((o) => o.dispatchMonthKey === monthScopeFilter || o.assignedMonthKey === monthScopeFilter);
      if (activeWeekObj) {
        list = list.filter((o) =>
          o.dispatchYMD && (
            o.dispatchYMD >= activeWeekObj.startDate && o.dispatchYMD <= activeWeekObj.endDate
          )
        );
      }
    } else if (weekScopeFilter) {
      list = list.filter((o) => o.weekName === weekScopeFilter);
    }

    const totalOrders = list.length;
    const totalUnits = list.reduce((sum, o) => sum + o.totalQty, 0);
    const onTimeUnits = list.reduce((sum, o) => sum + o.onTimeQty, 0);
    const delayedUnits = list.reduce((sum, o) => sum + o.delayedQty, 0);
    const upcomingUnits = list.reduce((sum, o) => sum + o.upcomingQty, 0);
    const onTimeOrders = list.filter((o) => o.status === 'On-Time').length;
    const partialOrders = list.filter((o) => o.status === 'Partially Delayed').length;
    const delayedOrders = list.filter((o) => o.status === 'Delayed').length;
    const upcomingOrders = list.filter((o) => o.status === 'Upcoming').length;
    const holdOrders = list.filter((o) => o.status === 'On Hold').length;

    const dueUnits = onTimeUnits + delayedUnits;
    const dueOrders = onTimeOrders + partialOrders + delayedOrders;

    const unitOnTimePct = dueUnits > 0 ? Math.round((onTimeUnits / dueUnits) * 100) : 0;
    const orderOnTimePct = dueOrders > 0 ? Math.round((onTimeOrders / dueOrders) * 100) : 0;

    const isFutureScope = monthScopeFilter !== 'all' && monthScopeFilter > '2026-09';

    return {
      totalOrders,
      totalUnits,
      onTimeUnits,
      delayedUnits,
      upcomingUnits,
      dueUnits,
      dueOrders,
      onTimeOrders,
      partialOrders,
      delayedOrders,
      upcomingOrders,
      holdOrders,
      unitOnTimePct,
      orderOnTimePct,
      isFutureScope,
    };
  }, [onTimeMetrics.orderItems, monthScopeFilter, weekScopeFilter, activeWeekObj]);

  // Chart data for monthly trend (Historical execution up to current month)
  const monthlyChartData = useMemo(() => {
    return onTimeMetrics.monthlySummaries
      .filter((m) => !m.isFutureMonth)
      .map((m) => ({
        month: m.monthDisplay,
        monthKey: m.monthKey,
        'On-Time Units': m.onTimeUnits,
        'Delayed Units': m.delayedUnits,
        'Total Units': m.totalUnits,
        'On-Time Rate %': m.unitOnTimePct,
        'On-Time Orders': m.onTimeOrders,
        'Delayed Orders': m.delayedOrders,
        'Order On-Time %': m.orderOnTimePct,
        isFuture: m.isFutureMonth,
      }));
  }, [onTimeMetrics.monthlySummaries]);

  // Donut chart status breakdown data
  const statusPieData = useMemo(() => {
    return [
      { name: 'On-Time (100%)', value: scopeMetrics.onTimeOrders, color: '#10B981' },
      { name: 'Partially Delayed', value: scopeMetrics.partialOrders, color: '#F59E0B' },
      { name: 'Delayed', value: scopeMetrics.delayedOrders, color: '#EF4444' },
      { name: 'Upcoming Orders', value: scopeMetrics.upcomingOrders, color: '#6366F1' },
      { name: 'On Hold Orders', value: scopeMetrics.holdOrders, color: '#94A3B8' },
    ].filter(d => d.value > 0);
  }, [scopeMetrics]);

  // Full Report Export Excel Handler
  const handleExportExcel = () => {
    const selectedMonthlySummary = onTimeMetrics.monthlySummaries.find(m => m.monthKey === monthScopeFilter);
    exportOnTimeReportToExcel(
      filteredOrders,
      onTimeMetrics.monthlySummaries,
      selectedMonthlySummary?.weeklyMatrix?.weeks || [],
      `LittleNap_OnTime_Delivery_Report_${monthScopeFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Dedicated Ledger Export Handler
  const handleExportLedger = () => {
    const filename = `LittleNap_OnTime_Delayed_Order_Ledger_${monthScopeFilter}${weekScopeFilter ? `_${weekScopeFilter.replace(/\s+/g, '_')}` : ''}_${statusFilter !== 'all' ? statusFilter.replace(/\s+/g, '_') : 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportOnTimeLedgerToExcel(filteredOrders, filename);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Performance &amp; SLA
                </span>
                <span className="text-slate-300">•</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Scheduled Dispatch vs Final QC Pass
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight mt-0.5">
                On-Time Production &amp; Delivery Intelligence
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates on-time delivery by matching scheduled dispatch dates against completed Final QC pass dates across all PMS live and archived orders.
              </p>
            </div>
          </div>

          {/* Month Scope Switcher & Export Button */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 sm:flex-initial">
              <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <select
                value={monthScopeFilter}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 pr-5 focus:outline-hidden cursor-pointer w-full"
              >
                <option value="all">All Months (Lifetime Data)</option>
                {onTimeMetrics.monthlySummaries.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.monthDisplay} ({m.totalUnits.toLocaleString()} units)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer w-full sm:w-auto shrink-0"
              title="Export filtered On-Time records and SLA summaries to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        {/* Active Scope / Week Filter Indicator Tag */}
        {(monthScopeFilter !== 'all' || weekScopeFilter) && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Active Scope:</span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                {monthScopeFilter === 'all' ? 'All Months' : monthScopeFilter}
              </span>
              {weekScopeFilter && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-900 font-semibold border border-indigo-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <span>Filtered to {activeWeekObj ? `${activeWeekObj.weekName} (${activeWeekObj.dateRange})` : weekScopeFilter}</span>
                  <button
                    onClick={() => setWeekScopeFilter(null)}
                    className="hover:text-rose-600 font-semibold ml-1 cursor-pointer text-xs"
                    title="Clear week filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            {weekScopeFilter && (
              <button
                onClick={() => setWeekScopeFilter(null)}
                className="text-xs text-slate-500 hover:text-indigo-600 font-semibold cursor-pointer underline"
              >
                Reset to Full Month
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI 4-CARD SUMMARY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unit-Wise On-Time Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Unit On-Time Fulfillment</span>
              <span className={`px-2 py-0.5 rounded-md font-semibold tabular-nums text-xs ${
                scopeMetrics.unitOnTimePct >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {scopeMetrics.unitOnTimePct}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 mt-1">
              {scopeMetrics.onTimeUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ {scopeMetrics.totalUnits.toLocaleString()} units</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3.5">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, scopeMetrics.unitOnTimePct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Units with Final QC passed on or before scheduled dispatch date
          </p>
        </div>

        {/* Card 2: Order-Wise On-Time Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Order Success Rate</span>
              <span className={`px-2 py-0.5 rounded-md font-semibold tabular-nums text-xs ${
                scopeMetrics.orderOnTimePct >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {scopeMetrics.orderOnTimePct}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 mt-1">
              {scopeMetrics.onTimeOrders.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ {scopeMetrics.totalOrders.toLocaleString()} orders</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3.5">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, scopeMetrics.orderOnTimePct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Orders where 100% quantity passed QC by dispatch date
          </p>
        </div>

        {/* Card 3: Delayed Units & Shortfall */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Delayed Units / Shortfall</span>
              <span className="p-1 rounded bg-rose-50 text-rose-600 border border-rose-100">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-rose-600 mt-1">
              {scopeMetrics.delayedUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">delayed chairs</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-600 bg-rose-50/70 p-2 rounded-xl border border-rose-100">
            <span className="font-semibold text-rose-700">{scopeMetrics.partialOrders} partial</span>
            <span>+</span>
            <span className="font-semibold text-rose-700">{scopeMetrics.delayedOrders} late orders</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Units not cleared by QC deadline or cleared after dispatch date
          </p>
        </div>

        {/* Card 4: Upcoming / Active Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Upcoming Scheduled Pipeline</span>
              <span className="p-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Package className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-indigo-700 mt-1">
              {scopeMetrics.upcomingOrders.toLocaleString()} <span className="text-xs font-normal text-slate-500">active orders</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-600 bg-indigo-50/70 p-2 rounded-xl border border-indigo-100">
            <span className="font-semibold text-indigo-700">{scopeMetrics.holdOrders} orders on hold</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Orders scheduled for future dates currently progressing on floor
          </p>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart (8 cols): Monthly On-Time vs Delayed Performance */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Monthly Delivery Performance &amp; Execution Velocity
              </h3>
              <p className="text-xs text-slate-500">
                Comparing On-Time cleared units vs Delayed units month-over-month
              </p>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setChartMetricMode('units')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMetricMode === 'units'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Units View
              </button>
              <button
                onClick={() => setChartMetricMode('orders')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMetricMode === 'orders'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders View
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    padding: '10px'
                  }}
                  formatter={(val: any, name: any) => [
                    `${Number(val).toLocaleString()} ${chartMetricMode === 'units' ? 'units' : 'orders'}`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartMetricMode === 'units' ? (
                  <>
                    <Bar dataKey="On-Time Units" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Delayed Units" fill="#f43f5e" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="On-Time Orders" fill="#6366f1" stackId="b" radius={[0, 0, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Delayed Orders" fill="#f43f5e" stackId="b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart (4 cols): Punctuality Composition Donut */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Order Status Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown for {monthScopeFilter === 'all' ? 'All Records' : monthScopeFilter}
            </p>
          </div>

          <div style={{ width: '100%', height: 190 }} className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${val} orders (${Math.round((Number(val) / (scopeMetrics.totalOrders || 1)) * 100)}%)`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400 font-semibold">Orders</span>
              <span className="text-xl font-semibold tabular-nums text-slate-900">{scopeMetrics.totalOrders.toLocaleString()}</span>
            </div>
          </div>

          {/* Mini Legend list */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate text-slate-600">{item.name}: <strong className="text-slate-900">{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WEEKLY OTD PRODUCTION DATA SPREADSHEET MATRIX */}
      <WeeklyOtdMatrixTable
        monthlySummaries={onTimeMetrics.monthlySummaries}
        weeklyMatrices={onTimeMetrics.weeklyMatrices}
        initialMonthKey={monthScopeFilter !== 'all' ? monthScopeFilter : selectedMonth}
        selectedWeek={weekScopeFilter}
        onSelectMonth={(mKey) => handleMonthChange(mKey)}
        onSelectWeek={(wkName) => setWeekScopeFilter(wkName)}
      />

      {/* FILTER & ORDER DRILLDOWN TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span>On-Time vs Delayed Order Ledger</span>
                  <span className="px-2 py-0.5 rounded-full text-xs tabular-nums font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {filteredOrders.length.toLocaleString()} matching
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed audit showing Column G scheduled dispatch date against Final QC pass records
                </p>
              </div>
            </div>

            {/* Search Box & Export Ledger Button */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search OPF, Model, Customer..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 w-full sm:w-56 shadow-2xs text-slate-800"
                />
              </div>

              <button
                onClick={handleExportLedger}
                disabled={filteredOrders.length === 0}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer w-full sm:w-auto shrink-0 ${
                  filteredOrders.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title="Export this filtered On-Time vs Delayed Order Ledger directly to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Ledger ({filteredOrders.length})</span>
              </button>
            </div>
          </div>

          {/* Filter Toolbar: Week Selector & Status Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
            {/* Week Selector (if specific month is active) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
              <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">
                Week:
              </span>
              <button
                onClick={() => setWeekScopeFilter(null)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  !weekScopeFilter
                    ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Weeks
              </button>
              {availableWeeksInMonth.map((w) => {
                const isSelected = weekScopeFilter === w.weekName;
                return (
                  <button
                    key={w.weekName}
                    onClick={() => setWeekScopeFilter(isSelected ? null : w.weekName)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                      isSelected
                        ? 'bg-indigo-600 text-white border border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                    title={`Filter by ${w.weekName} ${w.dateRange}`}
                  >
                    <span>{w.weekName}</span>
                    <span className={`text-xs font-medium px-1 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {w.totalOpf}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto max-w-full scrollbar-none shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('On-Time')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  statusFilter === 'On-Time' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                On-Time
              </button>
              <button
                onClick={() => setStatusFilter('Partially Delayed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  statusFilter === 'Partially Delayed' ? 'bg-white text-amber-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Partial
              </button>
              <button
                onClick={() => setStatusFilter('Delayed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  statusFilter === 'Delayed' ? 'bg-white text-rose-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Delayed
              </button>
            </div>
          </div>

          {/* Active Filter Summary Banner */}
          {weekScopeFilter && (
            <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span>
                  Showing orders scheduled for <strong className="font-semibold">{monthScopeFilter} • {activeWeekObj ? `${activeWeekObj.weekName} (${activeWeekObj.dateRange})` : weekScopeFilter}</strong> ({filteredOrders.length} orders, {scopeMetrics.totalUnits} units, {scopeMetrics.unitOnTimePct}% on-time).
                </span>
              </div>
              <button
                onClick={() => setWeekScopeFilter(null)}
                className="font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer ml-2"
              >
                Clear Week Filter
              </button>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">OPF &amp; Model</th>
                <th className="py-3 px-4">Week Schedule</th>
                <th className="py-3 px-4">Total Qty</th>
                <th className="py-3 px-4">Scheduled Dispatch</th>
                <th className="py-3 px-4">Final QC Date</th>
                <th className="py-3 px-4 text-emerald-700">On-Time Qty</th>
                <th className="py-3 px-4 text-rose-700">Delayed Qty</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4">Audit Diagnosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No orders matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.slice(0, 150).map((o, idx) => {
                  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (o.status === 'On-Time') {
                    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (o.status === 'Partially Delayed') {
                    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                  } else if (o.status === 'Delayed') {
                    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (o.status === 'Upcoming') {
                    badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                  } else if (o.status === 'On Hold') {
                    badgeClass = 'bg-amber-50 text-amber-900 border-amber-200';
                  }

                  return (
                    <tr key={`${o.opfNo}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* OPF & Model */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 tabular-nums">{o.opfNo}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]" title={o.modelName}>
                          {o.modelName}
                        </div>
                      </td>

                      {/* Week Schedule */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {o.weekName ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 text-xs w-fit">
                              {o.weekName}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {o.weekRangeLabel || ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>

                      {/* Total Qty */}
                      <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                        {o.totalQty} <span className="text-xs text-slate-400 font-normal">units</span>
                      </td>

                      {/* Scheduled Dispatch Date */}
                      <td className="py-3 px-4 tabular-nums font-semibold text-slate-800">
                        {o.dispatchDateStr}
                      </td>

                      {/* Final QC Pass Date */}
                      <td className="py-3 px-4 tabular-nums text-slate-700">
                        {o.qcPassDateLatest ? (
                          <span className="flex items-center gap-1 text-slate-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {o.qcPassDateLatest}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Cleared</span>
                        )}
                      </td>

                      {/* On-Time Qty */}
                      <td className="py-3 px-4 tabular-nums font-semibold text-emerald-700">
                        {o.onTimeQty > 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-50 rounded-lg border border-emerald-200">
                            {o.onTimeQty}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Delayed Qty */}
                      <td className="py-3 px-4 tabular-nums font-semibold text-rose-700">
                        {o.delayedQty > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-50 rounded-lg border border-rose-200">
                            {o.delayedQty}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Punctuality Status Badge */}
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-block ${badgeClass}`}>
                          {o.status}
                        </span>
                      </td>

                      {/* Diagnosis */}
                      <td className="py-3 px-4 text-slate-600 text-xs max-w-[240px]">
                        <p className="truncate" title={o.statusExplanation}>
                          {o.statusExplanation}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 150 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
            Showing first 150 of {filteredOrders.length.toLocaleString()} matching records. Use search or filters to narrow down.
          </div>
        )}
      </div>
    </div>
  );
};

export default OnTimePerformanceView;
