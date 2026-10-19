import React, { useState } from 'react';
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
import type { QcMonthlyAggregate } from '../types';
import type { OnTimeMonthlySummary } from '../services/onTimeDeliveryService';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Target,
  ArrowUpRight,
  Truck,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react';

interface ProductionChartsSectionProps {
  selectedMonth: string;
  selectedMonthDisplay: string;
  productionTarget: number;
  liveProducedTillDate: number;
  actualPerDay: number;
  newTargetPerDay: number;
  targetPerDay: number;
  pctTargetAchieved: string;
  shortfall: number;
  projectedOutput: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDaysInMonth: number;
  monthlyAggregates: QcMonthlyAggregate[];
  onTimeSummaries?: OnTimeMonthlySummary[];
  queueMetrics: {
    inQueueCurrent: number;
    backlogChairs: number;
    nextMonthChairs: number;
    holdChairs: number;
    readyGoodsUnits: number;
    readyStockUnits: number;
    dispatchedThisMonth: number;
  };
  bottleneckStages: Array<{
    stage: string;
    orders: number;
    units: number;
    responsible: string;
  }>;
  onViewOnTimeTab?: () => void;
  onViewDailyTab?: () => void;
}

export const ProductionChartsSection: React.FC<ProductionChartsSectionProps> = ({
  selectedMonth,
  selectedMonthDisplay,
  productionTarget,
  liveProducedTillDate,
  actualPerDay,
  newTargetPerDay,
  targetPerDay,
  pctTargetAchieved,
  shortfall,
  projectedOutput,
  daysRemaining,
  daysElapsed,
  totalDaysInMonth,
  monthlyAggregates,
  onTimeSummaries = [],
  queueMetrics,
  bottleneckStages,
  onViewOnTimeTab,
  onViewDailyTab
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'trends' | 'onTime' | 'floorQueue' | 'bottlenecks'>('trends');

  // Multi-month historical data formatted for trend chart (from Apr-2025 onwards)
  const historicalTrendData = React.useMemo(() => {
    return [...monthlyAggregates]
      .reverse()
      .map(item => ({
        month: item.monthDisplay || item.monthKey,
        monthKey: item.monthKey,
        Target: item.target || 0,
        'QC Passed': item.achieved || 0,
        Dispatched: item.dispatched || 0,
        achievementRate: item.achPct || 0
      }));
  }, [monthlyAggregates]);

  // On-Time monthly trend data (Historical execution up to current month)
  const onTimeTrendData = React.useMemo(() => {
    return onTimeSummaries
      .filter(item => !item.isFutureMonth)
      .map(item => ({
        month: item.monthDisplay,
        monthKey: item.monthKey,
        'On-Time Units': item.onTimeUnits,
        'Delayed Units': item.delayedUnits,
        'Total Scheduled': item.totalUnits,
        'On-Time %': item.unitOnTimePct,
        isFuture: item.isFutureMonth,
      }));
  }, [onTimeSummaries]);

  // Factory Floor Distribution (Donut Chart Data)
  const queueCompositionData = React.useMemo(() => {
    const data = [
      { name: 'Current Month Queue', value: queueMetrics.inQueueCurrent, color: '#4F46E5', desc: 'Orders scheduled for this month' },
      { name: 'Overdue Backlog', value: queueMetrics.backlogChairs, color: '#E11D48', desc: 'Orders pending from previous dates' },
      { name: 'Next Month Advance', value: queueMetrics.nextMonthChairs, color: '#0284C7', desc: 'Advance orders in workflow' },
      { name: 'On Hold Orders', value: queueMetrics.holdChairs, color: '#D97706', desc: 'Awaiting customer/fabric clearance' },
      { name: 'Ready in Warehouse', value: queueMetrics.readyGoodsUnits, color: '#059669', desc: 'Finished goods awaiting dispatch' },
      { name: 'Ready Stock Floor', value: queueMetrics.readyStockUnits, color: '#7C3AED', desc: 'Stock available for immediate sales' }
    ];
    return data.filter(d => d.value > 0);
  }, [queueMetrics]);

  const totalFactoryChairs = queueCompositionData.reduce((acc, d) => acc + d.value, 0);

  // Top Bottleneck stages formatted
  const topBottlenecksData = React.useMemo(() => {
    return bottleneckStages.slice(0, 8).map(s => ({
      stage: s.stage.length > 16 ? `${s.stage.slice(0, 14)}...` : s.stage,
      fullStage: s.stage,
      Units: s.units,
      Orders: s.orders,
      Responsible: s.responsible
    }));
  }, [bottleneckStages]);

  const pctNumber = parseFloat(pctTargetAchieved) || 0;
  const projectedPct = productionTarget > 0 ? Math.round((projectedOutput / productionTarget) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header with Tab Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              Visual Production &amp; Run-Rate Intelligence
            </h2>
            <p className="text-[13px] text-slate-500">
              Interactive visual analytics of monthly velocity, on-time delivery rates, floor composition, and bottlenecks
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center overflow-x-auto max-w-full p-1 bg-slate-200/70 rounded-xl text-[13px] font-semibold self-start sm:self-auto gap-0.5 scrollbar-none w-full sm:w-auto">
          <button
            onClick={() => setActiveChartTab('trends')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeChartTab === 'trends'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Monthly Velocity</span>
          </button>

          <button
            onClick={() => setActiveChartTab('onTime')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeChartTab === 'onTime'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>On-Time Delivery Data</span>
          </button>

          <button
            onClick={() => setActiveChartTab('floorQueue')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeChartTab === 'floorQueue'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Floor Load Distribution</span>
          </button>

          <button
            onClick={() => setActiveChartTab('bottlenecks')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeChartTab === 'bottlenecks'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Stage Bottlenecks</span>
          </button>
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="p-3 sm:p-6 space-y-6">
        {/* KPI RUN-RATE PACE METER (Always Visible for Immediate Executive Clarity) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          {/* 1. Target Velocity Meter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                Target
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {liveProducedTillDate.toLocaleString()} / {productionTarget.toLocaleString()} units ({pctTargetAchieved}%)
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex relative">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                style={{ width: `${Math.min(100, pctNumber)}%` }}
              />
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span>{daysElapsed} days elapsed</span>
              <span>{shortfall > 0 ? `${shortfall.toLocaleString()} shortfall` : 'Target Met'}</span>
            </div>
          </div>

          {/* 2. Daily Run-Rate Comparison */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-semibold text-slate-600">Daily Run-Rate Pace</span>
              <span className={`font-semibold tabular-nums text-[13px] px-2 py-0.5 rounded ${
                actualPerDay >= newTargetPerDay ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {actualPerDay >= newTargetPerDay ? 'On Target Pace' : `Deficit: -${Math.max(0, newTargetPerDay - actualPerDay)}/day`}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 pt-1">
              <div className="flex-1 text-center bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200">
                <div className="text-[13px] sm:text-[13px] text-slate-500 font-semibold">Actual Output</div>
                <div className="text-sm sm:text-base font-semibold tabular-nums text-indigo-700">{actualPerDay} <span className="text-[13px] sm:text-[13px] font-normal">/day</span></div>
              </div>
              <div className="flex-1 text-center bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200">
                <div className="text-[13px] sm:text-[13px] text-slate-500 font-semibold">Required Pace</div>
                <div className="text-sm sm:text-base font-semibold tabular-nums text-rose-700">{newTargetPerDay} <span className="text-[13px] sm:text-[13px] font-normal">/day</span></div>
              </div>
              <div className="flex-1 text-center bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200">
                <div className="text-[13px] sm:text-[13px] text-slate-500 font-semibold">Target</div>
                <div className="text-sm sm:text-base font-semibold tabular-nums text-slate-800">{targetPerDay} <span className="text-[13px] sm:text-[13px] font-normal">/day</span></div>
              </div>
            </div>
            {onViewDailyTab && (
              <button
                onClick={onViewDailyTab}
                className="w-full text-center text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline pt-0.5 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>View Daily Production &amp; Step Matrix →</span>
              </button>
            )}
          </div>

          {/* 3. Projected Realization */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-semibold text-slate-600">Projected Month-End Output</span>
              <span className="font-semibold text-slate-900 tabular-nums">{projectedPct}% of Target</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold tabular-nums text-slate-900">
                  {projectedOutput.toLocaleString()} <span className="text-[13px] font-normal text-slate-500">chairs projected</span>
                </div>
                <div className="text-[13px] text-slate-500">
                  Based on current velocity over remaining {daysRemaining} days
                </div>
              </div>
              <div className={`p-2 rounded-lg ${projectedPct >= 95 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: HISTORICAL MONTHLY TRENDS (BAR CHART) */}
        {activeChartTab === 'trends' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Monthly Target vs. QC Passed vs. Dispatched Performance</h3>
                <p className="text-[13px] text-slate-500">Multi-month comparative volume tracking from April 2025 onwards</p>
              </div>
              <div className="flex items-center gap-3 text-[13px] font-medium">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-slate-300 inline-block"></span> Target</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-indigo-600 inline-block"></span> QC Passed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span> Dispatched</span>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }} className="pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
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
                    formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} units`, name]}
                  />
                  <Bar dataKey="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="QC Passed" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Dispatched" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: ON-TIME DELIVERY TRENDS */}
        {activeChartTab === 'onTime' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">On-Time vs Delayed Delivery Performance</h3>
                <p className="text-[13px] text-slate-500">Compares each order's dispatch date with the day it passed final QC</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-3 text-[13px] font-medium">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span> On-Time Units</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-rose-500 inline-block"></span> Delayed Units</span>
                </div>
                {onViewOnTimeTab && (
                  <button
                    onClick={onViewOnTimeTab}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[13px] font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Open Full On-Time Audit &rarr;
                  </button>
                )}
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }} className="pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={onTimeTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
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
                    formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} units`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="On-Time Units" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Delayed Units" fill="#f43f5e" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 3: FACTORY FLOOR LOAD & QUEUE COMPOSITION (DONUT & CHIPS) */}
        {activeChartTab === 'floorQueue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Donut Chart (5 cols) */}
            <div style={{ width: '100%', height: 260 }} className="lg:col-span-5 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={queueCompositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {queueCompositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${Number(val).toLocaleString()} units (${Math.round((Number(val) / (totalFactoryChairs || 1)) * 100)}%)`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[13px] font-semibold text-slate-500">Total Load</span>
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{totalFactoryChairs.toLocaleString()}</span>
                <span className="text-[13px] text-slate-500 font-medium">Chairs Across Floor</span>
              </div>
            </div>

            {/* Breakdown Cards Grid (7 cols) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {queueCompositionData.map((item) => {
                const pct = Math.round((item.value / (totalFactoryChairs || 1)) * 100);
                return (
                  <div key={item.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="tabular-nums font-semibold text-slate-900">{pct}%</span>
                    </div>
                    <div className="text-base font-semibold tabular-nums text-slate-900">
                      {item.value.toLocaleString()} <span className="text-[13px] font-normal text-slate-500">units</span>
                    </div>
                    <p className="text-[13px] text-slate-500 truncate">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: STAGE BOTTLENECK WORKLOAD DISTRIBUTION */}
        {activeChartTab === 'bottlenecks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Orders at each stage</h3>
                <p className="text-[13px] text-slate-500">Live order &amp; chair concentration across production workstations</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 300 }} className="pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBottlenecksData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                    formatter={(val: any, name: any, props: any) => [
                      `${val} ${name === 'Units' ? 'chairs' : 'orders'} (Lead: ${props.payload.Responsible})`,
                      name
                    ]}
                  />
                  <Bar dataKey="Units" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionChartsSection;
