import React, { useState } from 'react';
import type { Order, ProductionStepName, Insight } from '../types';
import StatCard from './StatCard';
import FilterBar, { DEFAULT_STATUSES } from './FilterBar';
import OrderCard from './OrderCard';
import ProductionPlannerCalendar from './ProductionPlannerCalendar';
import HoldOrdersView from './HoldOrdersView';
import PmsTableView from './PmsTableView';
import ResponsibleStats from './ResponsibleStats';
import ProductionChart from './ProductionChart';
import AIPoweredInsightsCard from './AIPoweredInsightsCard';
import OnTimeDonutChart from './OnTimeDonutChart';
import BottleneckIntelligenceView from './BottleneckIntelligenceView';
import Pagination from './Pagination';
import { exportOrdersToExcel } from '../utils/excelExport';
import {
  Boxes,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  BarChart3,
  LayoutGrid,
  CalendarDays,
  AlertTriangle,
  Table as TableIcon,
  Factory,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Download
} from 'lucide-react';

export type PmsSubTab = 'cards' | 'planner' | 'hold' | 'stages' | 'table';

interface PmsManesarViewProps {
  orders: Order[];
  filteredOrders: Order[];
  onSelectOrder: (order: Order) => void;
  // Multi-Filter states
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  onSelectAllStatuses: () => void;
  onSelectActiveStatuses: () => void;
  onClearStatuses: () => void;
  selectedStages: string[];
  onStageToggle: (stage: string) => void;
  onSelectAllStages: () => void;
  onClearStages: () => void;
  selectedResponsibles: string[];
  onResponsibleToggle: (person: string) => void;
  onSelectAllResponsibles: () => void;
  onClearResponsibles: () => void;
  uniqueDispatchMonths: string[];
  dispatchMonthFilter: string;
  onDispatchMonthChange: (m: string) => void;
  sourceFilter: 'all' | 'live' | 'archive';
  onSourceChange: (s: 'all' | 'live' | 'archive') => void;
  counts: Record<string, number>;
  statusCounts: Record<string, number>;
  kpis: {
    total: { count: number; units: number };
    wip: { count: number; units: number };
    onHold: { count: number; units: number };
    ready: { count: number; units: number };
    dispatched: { count: number; units: number };
  };
  onResetFilters: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  chartData: any[];
  onTimeData: any[];
  onGenerateInsights?: () => Promise<Insight[]>;
  initialSubTab?: PmsSubTab;
}

export const PmsManesarView: React.FC<PmsManesarViewProps> = ({
  orders,
  filteredOrders,
  onSelectOrder,
  searchQuery,
  onSearchChange,
  selectedStatuses,
  onStatusToggle,
  onSelectAllStatuses,
  onSelectActiveStatuses,
  onClearStatuses,
  selectedStages,
  onStageToggle,
  onSelectAllStages,
  onClearStages,
  selectedResponsibles,
  onResponsibleToggle,
  onSelectAllResponsibles,
  onClearResponsibles,
  uniqueDispatchMonths,
  dispatchMonthFilter,
  onDispatchMonthChange,
  sourceFilter,
  onSourceChange,
  counts,
  statusCounts,
  kpis,
  onResetFilters,
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  chartData,
  onTimeData,
  onGenerateInsights,
  initialSubTab = 'cards'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PmsSubTab>(initialSubTab);

  // Pagination calculations for Cards
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

  // Hold count calculation
  const holdOrdersCount = orders.filter(o => {
    if (o.overallStatus === 'Dispatched' || o.isArchived) return false;
    const hasHoldStatus = o.overallStatus === 'On Hold';
    const hasHoldDispatch = o.dispatchDate ? o.dispatchDate.toUpperCase().includes('HOLD') : false;
    const hasHoldRemarks = o.steps?.some(s => s.remarks && s.remarks.toUpperCase().includes('HOLD'));
    return hasHoldStatus || hasHoldDispatch || hasHoldRemarks;
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PMS@MANESAR HEADER & SUB-NAVIGATION BAR */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                  PMS @ Manesar Plant
                </h1>
                <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-full border border-indigo-200 font-mono">
                  {orders.length} Active Work Orders
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                14-Stage Floor Workflow, Production Scheduling, Order Holds, Station Bottlenecks & PMS Matrix
              </p>
            </div>
          </div>

          {/* SUB-VIEW SWITCHER PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
            {/* 1. Cards Pipeline */}
            <button
              onClick={() => setActiveSubTab('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSubTab === 'cards'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pipeline Cards</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-slate-200 text-slate-700">
                {filteredOrders.length}
              </span>
            </button>

            {/* 2. Planning Calendar */}
            <button
              onClick={() => setActiveSubTab('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSubTab === 'planner'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
              <span>Planning Calendar</span>
            </button>

            {/* 3. Hold Orders */}
            <button
              onClick={() => setActiveSubTab('hold')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSubTab === 'hold'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:text-amber-950 hover:bg-amber-100/60'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${activeSubTab === 'hold' ? 'text-white' : 'text-amber-600'}`} />
              <span>Hold Orders</span>
              {holdOrdersCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeSubTab === 'hold' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {holdOrdersCount}
                </span>
              )}
            </button>

            {/* 4. Bottlenecks & Owners */}
            <button
              onClick={() => setActiveSubTab('stages')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSubTab === 'stages'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bottlenecks</span>
            </button>

            {/* 5. Data Sheet Matrix */}
            <button
              onClick={() => setActiveSubTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSubTab === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Sheet</span>
            </button>

            {/* Excel Export Button */}
            <button
              onClick={() => exportOrdersToExcel(filteredOrders, `PMS_Manesar_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ml-1 cursor-pointer"
              title="Export currently filtered PMS orders to formatted Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: PIPELINE CARDS */}
      {activeSubTab === 'cards' && (
        <div className="space-y-6">
          {/* Top Multi-Filter Bar */}
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            selectedStatuses={selectedStatuses}
            onStatusToggle={onStatusToggle}
            onSelectAllStatuses={onSelectAllStatuses}
            onSelectActiveStatuses={onSelectActiveStatuses}
            onClearStatuses={onClearStatuses}
            selectedStages={selectedStages}
            onStageToggle={onStageToggle}
            onSelectAllStages={onSelectAllStages}
            onClearStages={onClearStages}
            selectedResponsibles={selectedResponsibles}
            onResponsibleToggle={onResponsibleToggle}
            onSelectAllResponsibles={onSelectAllResponsibles}
            onClearResponsibles={onClearResponsibles}
            dispatchMonths={uniqueDispatchMonths}
            dispatchMonthFilter={dispatchMonthFilter}
            onDispatchMonthChange={onDispatchMonthChange}
            sourceFilter={sourceFilter}
            onSourceChange={onSourceChange}
            counts={counts}
            statusCounts={statusCounts}
            onResetFilters={onResetFilters}
          />

          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard 
              title="Total Orders" 
              value={kpis.total.count.toString()} 
              units={`${kpis.total.units} (units) in scope`} 
              icon={<Boxes className="w-6 h-6" />} 
              iconBgColor="bg-indigo-50" 
              iconColor="text-indigo-600" 
            />
            <StatCard 
              title="WIP Orders" 
              value={kpis.wip.count.toString()} 
              units={`${kpis.wip.units} (units) in stages`} 
              icon={<Clock className="w-6 h-6" />} 
              iconBgColor="bg-blue-50" 
              iconColor="text-blue-600" 
            />
            <StatCard 
              title="On Hold / Attention" 
              value={kpis.onHold.count.toString()} 
              units={`${kpis.onHold.units} (units) delayed`} 
              icon={<AlertCircle className="w-6 h-6" />} 
              iconBgColor="bg-amber-50" 
              iconColor="text-amber-600" 
            />
            <StatCard 
              title="Ready for Dispatch" 
              value={kpis.ready.count.toString()} 
              units={`${kpis.ready.units} (units) packed & ready`} 
              icon={<CheckCircle2 className="w-6 h-6" />} 
              iconBgColor="bg-teal-50" 
              iconColor="text-teal-600" 
            />
            <StatCard 
              title="Dispatched" 
              value={kpis.dispatched.count.toString()} 
              units={`${kpis.dispatched.units} (units) delivered/archived`} 
              icon={<Truck className="w-6 h-6" />} 
              iconBgColor="bg-emerald-50" 
              iconColor="text-emerald-600" 
            />
          </div>

          {/* Responsible Department Owners Strip */}
          <ResponsibleStats 
            orders={filteredOrders}
            selectedResponsibles={selectedResponsibles}
            onTogglePersonFilter={onResponsibleToggle}
            onClearAll={onClearResponsibles}
          />

          {/* Orders Pipeline List Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-600" />
                  Orders Pipeline ({filteredOrders.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  14-step workflow tracking. Showing {paginatedOrders.length} orders on page {validCurrentPage} of {totalPages}.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span> WIP Active
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Delayed
                </span>
              </div>
            </div>

            {/* List of Orders */}
            <div className="flex flex-col gap-3.5">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map(order => (
                  <OrderCard 
                    key={order.opfNo} 
                    order={order} 
                    onSelect={onSelectOrder} 
                  />
                ))
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-xs">
                  <p className="font-bold text-base text-slate-800">No matching production orders</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting your multi-filters or click "Reset Filters".</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredOrders.length > 0 && (
              <Pagination
                currentPage={validCurrentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={[15, 25, 50, 100]}
              />
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PLANNING CALENDAR */}
      {activeSubTab === 'planner' && (
        <ProductionPlannerCalendar 
          orders={orders} 
          onSelectOrder={onSelectOrder} 
        />
      )}

      {/* SUB-TAB 3: ON HOLD ORDERS */}
      {activeSubTab === 'hold' && (
        <HoldOrdersView 
          orders={orders} 
          onSelectOrder={onSelectOrder} 
        />
      )}

      {/* SUB-TAB 4: BOTTLENECKS & ROOT CAUSE INTELLIGENCE */}
      {activeSubTab === 'stages' && (
        <BottleneckIntelligenceView
          orders={orders}
          onSelectOrder={onSelectOrder}
        />
      )}

      {/* SUB-TAB 5: DATA SHEET MATRIX */}
      {activeSubTab === 'table' && (
        <div className="space-y-4">
          <PmsTableView 
            orders={filteredOrders} 
            onSelectOrder={onSelectOrder} 
          />
        </div>
      )}
    </div>
  );
};

export default PmsManesarView;
