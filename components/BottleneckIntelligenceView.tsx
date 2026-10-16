import React, { useState, useMemo } from 'react';
import type { Order, ProductionStepName } from '../types';
import { PRODUCTION_STAGES, STAGE_CONFIGS } from '../constants';
import { exportBottlenecksToExcel } from '../utils/excelExport';
import {
  AlertTriangle,
  Clock,
  Layers,
  Users,
  CheckCircle2,
  Download,
  Search,
  Filter,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';

interface BottleneckIntelligenceViewProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export const BottleneckIntelligenceView: React.FC<BottleneckIntelligenceViewProps> = ({
  orders,
  onSelectOrder
}) => {
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'stages' | 'owners' | 'delayedOrders'>('stages');

  // Compute Stage-Level Bottlenecks with True Delays & Overdue Detection
  const { stageStats, ownerStats, delayedOrdersList } = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Initialize Stage Map
    const stageMap = new Map<
      ProductionStepName,
      {
        stage: ProductionStepName;
        stepCode: string;
        responsible: string;
        category: string;
        timeline: string;
        color: string;
        wipOrders: number;
        wipUnits: number;
        delayedOrders: number;
        delayedUnits: number;
        delayDaysTotal: number;
        delayCount: number;
        reasonsList: string[];
      }
    >();

    PRODUCTION_STAGES.forEach((stage) => {
      const cfg = STAGE_CONFIGS[stage];
      stageMap.set(stage, {
        stage,
        stepCode: cfg.stepCode,
        responsible: cfg.responsible,
        category: cfg.category,
        timeline: cfg.timeline,
        color: cfg.color,
        wipOrders: 0,
        wipUnits: 0,
        delayedOrders: 0,
        delayedUnits: 0,
        delayDaysTotal: 0,
        delayCount: 0,
        reasonsList: []
      });
    });

    // Initialize Owner Map
    const ownerMap = new Map<
      string,
      {
        name: string;
        stages: ProductionStepName[];
        activeOrders: number;
        activeUnits: number;
        delayedOrders: number;
        delayedUnits: number;
        completedOrders: number;
        delayDaysTotal: number;
        delayIncidents: number;
        topReasons: string[];
      }
    >();

    const delayedOrders: (Order & {
      delayedStepsSummary: {
        stageName: string;
        delayDays: number;
        reason: string;
        responsible: string;
      }[];
    })[] = [];

    // Filter to active WIP & On-Hold orders (exclude already Dispatched/Archived for bottleneck detection)
    const activeOrders = orders.filter(
      (o) => !o.isArchived && o.overallStatus !== 'Dispatched'
    );

    activeOrders.forEach((order) => {
      let orderHasDelay = false;
      const orderDelayedSteps: {
        stageName: string;
        delayDays: number;
        reason: string;
        responsible: string;
      }[] = [];

      order.steps.forEach((step) => {
        const stageData = stageMap.get(step.name);
        const ownerName = step.responsible;

        if (!ownerMap.has(ownerName)) {
          ownerMap.set(ownerName, {
            name: ownerName,
            stages: [step.name],
            activeOrders: 0,
            activeUnits: 0,
            delayedOrders: 0,
            delayedUnits: 0,
            completedOrders: 0,
            delayDaysTotal: 0,
            delayIncidents: 0,
            topReasons: []
          });
        }
        const ownerData = ownerMap.get(ownerName)!;
        if (!ownerData.stages.includes(step.name)) {
          ownerData.stages.push(step.name);
        }

        // Active In-Progress count
        if (step.status === 'In Progress' || order.currentStage === step.name) {
          if (stageData) {
            stageData.wipOrders++;
            stageData.wipUnits += order.quantity;
          }
          ownerData.activeOrders++;
          ownerData.activeUnits += order.quantity;
        } else if (step.status === 'Completed') {
          ownerData.completedOrders++;
        }

        // Delay Detection:
        // 1. Explicit delay recorded
        // 2. Step is In Progress / Pending and planned date < today
        // 3. Status is Delayed / Failed / On Hold
        let isStepDelayed = false;
        let daysLate = 0;

        if (step.delay && step.delay > 0) {
          isStepDelayed = true;
          daysLate = step.delay;
        } else if (step.delayDays && step.delayDays > 0) {
          isStepDelayed = true;
          daysLate = step.delayDays;
        } else if (step.status === 'Delayed') {
          isStepDelayed = true;
          daysLate = 1;
        } else if (step.plannedDate && step.status !== 'Completed') {
          const planned = new Date(step.plannedDate);
          planned.setUTCHours(0, 0, 0, 0);
          if (planned < today && (order.overallStatus === 'WIP' || order.overallStatus === 'On Hold')) {
            const diffTime = Math.abs(today.getTime() - planned.getTime());
            daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (daysLate > 0) {
              isStepDelayed = true;
            }
          }
        }

        if (isStepDelayed) {
          orderHasDelay = true;
          const reason =
            step.reasonOfFail ||
            step.remarks ||
            (step.status === 'Delayed' ? 'Process delayed beyond target SLA' : 'Planned date elapsed');

          if (stageData) {
            stageData.delayedOrders++;
            stageData.delayedUnits += order.quantity;
            stageData.delayDaysTotal += daysLate;
            stageData.delayCount++;
            if (reason && !stageData.reasonsList.includes(reason)) {
              stageData.reasonsList.push(reason);
            }
          }

          ownerData.delayedOrders++;
          ownerData.delayedUnits += order.quantity;
          ownerData.delayDaysTotal += daysLate;
          ownerData.delayIncidents++;
          if (reason && !ownerData.topReasons.includes(reason)) {
            ownerData.topReasons.push(reason);
          }

          orderDelayedSteps.push({
            stageName: step.name,
            delayDays: daysLate,
            reason,
            responsible: step.responsible
          });
        }
      });

      if (orderHasDelay || order.overallStatus === 'On Hold') {
        delayedOrders.push({
          ...order,
          delayedStepsSummary: orderDelayedSteps
        });
      }
    });

    const stageStatsFormatted = Array.from(stageMap.values())
      .map((s) => {
        const avgDelayDays = s.delayCount > 0 ? Math.round(s.delayDaysTotal / s.delayCount) : 0;
        let severity: 'Critical' | 'Moderate' | 'Low' = 'Low';
        if (s.delayedOrders >= 8 || avgDelayDays >= 4) severity = 'Critical';
        else if (s.delayedOrders >= 2 || s.wipOrders >= 15) severity = 'Moderate';

        return {
          ...s,
          avgDelayDays,
          severity,
          topFailureReasons: s.reasonsList.slice(0, 4)
        };
      })
      .sort((a, b) => b.delayedOrders - a.delayedOrders || b.wipOrders - a.wipOrders);

    const ownerStatsFormatted = Array.from(ownerMap.values())
      .map((o) => {
        let bottleneckRisk = 'Low';
        if (o.delayedOrders >= 10 || o.activeOrders >= 25) bottleneckRisk = 'Critical Backlog';
        else if (o.delayedOrders >= 3 || o.activeOrders >= 10) bottleneckRisk = 'Moderate Workload';

        return {
          ...o,
          bottleneckRisk
        };
      })
      .sort((a, b) => b.delayedOrders - a.delayedOrders || b.activeOrders - a.activeOrders);

    return {
      stageStats: stageStatsFormatted,
      ownerStats: ownerStatsFormatted,
      delayedOrdersList: delayedOrders
    };
  }, [orders]);

  // Filtered Delayed Orders List for Drilldown
  const filteredDelayedOrders = useMemo(() => {
    return delayedOrdersList.filter((o) => {
      // Stage filter
      if (
        selectedStageFilter !== 'all' &&
        !o.delayedStepsSummary.some((s) => s.stageName === selectedStageFilter) &&
        o.currentStage !== selectedStageFilter
      ) {
        return false;
      }

      // Owner filter
      if (
        selectedOwnerFilter !== 'all' &&
        !o.delayedStepsSummary.some((s) => s.responsible === selectedOwnerFilter) &&
        o.currentResponsible !== selectedOwnerFilter
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOpf = o.opfNo?.toLowerCase().includes(q);
        const matchModel = o.modelName?.toLowerCase().includes(q);
        const matchUph = o.upholstery?.toLowerCase().includes(q);
        const matchResp = o.currentResponsible?.toLowerCase().includes(q);
        const matchReason = o.delayedStepsSummary.some((s) => s.reason?.toLowerCase().includes(q));
        return matchOpf || matchModel || matchUph || matchResp || matchReason;
      }

      return true;
    });
  }, [delayedOrdersList, selectedStageFilter, selectedOwnerFilter, searchQuery]);

  const handleExportExcel = () => {
    exportBottlenecksToExcel(stageStats, ownerStats, filteredDelayedOrders);
  };

  const topBottleneckStage = stageStats[0];
  const topBottleneckOwner = ownerStats[0];
  const uniqueDelayedUnits = delayedOrdersList.reduce((sum, o) => sum + o.quantity, 0);
  const activeOrdersCount = orders.filter((o) => !o.isArchived && o.overallStatus !== 'Dispatched');
  const uniqueWipUnits = activeOrdersCount.reduce((sum, o) => sum + o.quantity, 0);
  const cumulativeStationDelayedUnits = stageStats.reduce((sum, s) => sum + s.delayedUnits, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Factory Operations
                </span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  Root Cause & Delay Audit
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Station Bottleneck & Department Owner Intelligence
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time tracking of delayed stations, workload concentration, failure reasons, and action items.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Export complete Bottlenecks & Owner Audit to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Bottlenecks to Excel</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500">Top Bottleneck Stage</div>
            <div className="text-base font-black text-rose-700 mt-1 truncate" title={topBottleneckStage?.stage}>
              {topBottleneckStage?.stage || 'None'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {topBottleneckStage?.delayedOrders || 0} delayed orders ({topBottleneckStage?.responsible})
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500">Highest Workload Lead</div>
            <div className="text-base font-black text-indigo-900 mt-1 truncate">
              {topBottleneckOwner?.name || 'None'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {topBottleneckOwner?.activeOrders || 0} active WIP orders ({topBottleneckOwner?.stages.length} stages)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500">Total Delayed Units</div>
            <div className="text-base font-black font-mono text-amber-700 mt-1">
              {uniqueDelayedUnits.toLocaleString()} units
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {delayedOrdersList.length} delayed / hold work orders
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500">Active WIP Units</div>
            <div className="text-base font-black font-mono text-emerald-700 mt-1">
              {uniqueWipUnits.toLocaleString()} units
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {activeOrdersCount.length} active floor work orders
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('stages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'stages'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Stage Bottleneck Ranking ({stageStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('owners')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'owners'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Department Lead Workloads ({ownerStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('delayedOrders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'delayedOrders'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Delayed Work Orders ({filteredDelayedOrders.length})</span>
        </button>
      </div>

      {/* VIEW 1: STAGES RANKING & REASON ANALYSIS */}
      {activeTab === 'stages' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stageStats.map((st, idx) => {
              const isTop = idx < 3 && st.delayedOrders > 0;
              return (
                <div
                  key={st.stage}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between ${
                    isTop
                      ? 'border-rose-300 ring-1 ring-rose-100 bg-rose-50/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                            {st.stepCode}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {st.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">
                          {st.stage}
                        </h3>
                        <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                          Lead: {st.responsible}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                          st.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : st.severity === 'Moderate'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {st.severity === 'Critical' ? 'Critical Bottleneck' : st.severity === 'Moderate' ? 'Moderate Backlog' : 'On Track'}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Active WIP</span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {st.wipOrders} <span className="text-[10px] font-normal text-slate-500">({st.wipUnits}u)</span>
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg ${st.delayedOrders > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                        <span className="text-[10px] text-slate-400 block font-semibold">Delayed / Overdue</span>
                        <span className={`text-sm font-black font-mono ${st.delayedOrders > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                          {st.delayedOrders} <span className="text-[10px] font-normal text-slate-500">({st.delayedUnits}u)</span>
                        </span>
                      </div>
                    </div>

                    {/* Root Cause Failure Reasons from Sheet */}
                    {st.topFailureReasons.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Recorded Reasons & Remarks:
                        </span>
                        <div className="space-y-1">
                          {st.topFailureReasons.map((r, rIdx) => (
                            <div
                              key={rIdx}
                              className="text-[11px] text-slate-700 bg-amber-50/70 border border-amber-200/60 px-2 py-1 rounded-lg flex items-start gap-1.5"
                            >
                              <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                              <span className="line-clamp-2">{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 text-[11px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
                    <span>SLA: {st.timeline}</span>
                    <button
                      onClick={() => {
                        setSelectedStageFilter(st.stage);
                        setActiveTab('delayedOrders');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Orders</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: DEPARTMENT OWNERS WORKLOAD & STAGE DISTRIBUTION */}
      {activeTab === 'owners' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownerStats.map((owner) => {
              const isHigh = owner.delayedOrders >= 5 || owner.activeOrders >= 20;
              return (
                <div
                  key={owner.name}
                  className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between ${
                    isHigh
                      ? 'border-indigo-300 ring-1 ring-indigo-100 bg-indigo-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {owner.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Assigned Stages ({owner.stages.length}):
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          owner.delayedOrders > 0
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {owner.bottleneckRisk}
                      </span>
                    </div>

                    {/* Stage Chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {owner.stages.map((stName) => (
                        <span
                          key={stName}
                          className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                        >
                          {stName.replace('OF UPHOLSTERY', '').replace('QUALITY CONTROL', 'QC')}
                        </span>
                      ))}
                    </div>

                    {/* Workload breakdown */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-center">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Active WIP</span>
                        <span className="text-sm font-black font-mono text-indigo-700">
                          {owner.activeOrders} <span className="text-[10px] font-normal">({owner.activeUnits}u)</span>
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Delayed</span>
                        <span className="text-sm font-black font-mono text-rose-700">
                          {owner.delayedOrders}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Completed</span>
                        <span className="text-sm font-black font-mono text-emerald-700">
                          {owner.completedOrders}
                        </span>
                      </div>
                    </div>

                    {/* Top Reasons logged under this owner */}
                    {owner.topReasons.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Common Delay Reasons:
                        </span>
                        <div className="space-y-1">
                          {owner.topReasons.slice(0, 3).map((r, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200/70"
                            >
                              • {r}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 text-[11px] border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setSelectedOwnerFilter(owner.name);
                        setActiveTab('delayedOrders');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Filter Orders by {owner.name.split(' ')[1] || owner.name}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: DELAYED WORK ORDERS DRILLDOWN LEDGER */}
      {activeTab === 'delayedOrders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search OPF, Model, Reason..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 w-full sm:w-60 shadow-2xs"
                />
              </div>

              {/* Stage Filter */}
              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Delayed Stages ({stageStats.length})</option>
                {stageStats.map((s) => (
                  <option key={s.stage} value={s.stage}>
                    {s.stage} ({s.delayedOrders} delayed)
                  </option>
                ))}
              </select>

              {/* Owner Filter */}
              <select
                value={selectedOwnerFilter}
                onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Department Leads ({ownerStats.length})</option>
                {ownerStats.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name} ({o.delayedOrders} delayed)
                  </option>
                ))}
              </select>

              {(selectedStageFilter !== 'all' || selectedOwnerFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedStageFilter('all');
                    setSelectedOwnerFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <span className="text-xs font-bold text-slate-600">
              Showing {filteredDelayedOrders.length} matching delayed work orders
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">OPF No</th>
                  <th className="py-3 px-4">Model & Description</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Assigned Lead</th>
                  <th className="py-3 px-4">Scheduled Dispatch</th>
                  <th className="py-3 px-4">Delayed Step & Reasons</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredDelayedOrders.length > 0 ? (
                  filteredDelayedOrders.map((order) => (
                    <tr
                      key={order.opfNo}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => onSelectOrder(order)}
                    >
                      <td className="py-3 px-4 font-bold font-mono text-indigo-700">
                        {order.opfNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{order.modelName || 'Recliner'}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{order.upholstery || 'Standard'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {order.quantity}u
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium text-[11px]">
                          {order.currentStage || 'Floor WIP'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {order.currentResponsible || 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {order.dispatchDate || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {order.delayedStepsSummary.length > 0 ? (
                          <div className="space-y-1 max-w-sm">
                            {order.delayedStepsSummary.slice(0, 2).map((s, idx) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-bold text-rose-700">{s.stageName}:</span>{' '}
                                <span className="text-slate-600">{s.reason}</span>{' '}
                                {s.delayDays > 0 && (
                                  <span className="text-[10px] font-mono text-rose-600 font-bold">
                                    (+{s.delayDays}d)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Status On Hold</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(order);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No delayed orders match your search and filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottleneckIntelligenceView;
