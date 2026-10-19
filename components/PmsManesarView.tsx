import React, { useState } from 'react';
import type { Order, ProductionStepName, Insight } from '../types';
import StatCard from './StatCard';
import FilterBar, { DEFAULT_STATUSES } from './FilterBar';
import OrderCard from './OrderCard';
import ProductionPlannerCalendar from './ProductionPlannerCalendar';
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

export type PmsSubTab = 'cards' | 'planner' | 'stages' | 'table';

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
  const [showOwners, setShowOwners] = useState<boolean>(false);
  const inProgressCount = orders.filter(o => !o.isArchived && o.overallStatus !== 'Dispatched').length;

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
      {/* Header and sub-views */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Manesar</h1>
            <p className="mt-1 text-sm text-slate-500">{inProgressCount} orders in progress</p>
          </div>
          <button
            onClick={() => exportOrdersToExcel(filteredOrders, `PMS_Manesar_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {([
            { id: 'cards', label: 'Orders', badge: filteredOrders.length },
            { id: 'planner', label: 'Calendar' },
            { id: 'stages', label: 'Bottlenecks' },
            { id: 'table', label: 'Data sheet' },
          ] as Array<{ id: PmsSubTab; label: string; badge?: number }>).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span className={`text-[13px] tabular-nums ${activeSubTab === t.id ? 'text-slate-300' : 'text-slate-500'}`}>{t.badge}</span>
              )}
            </button>
          ))}
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

          {/* Key numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'Orders shown', value: kpis.total.count, sub: `${kpis.total.units} chairs` },
              { label: 'WIP Orders', value: kpis.wip.count, sub: `${kpis.wip.units} chairs` },
              { label: 'Ready to dispatch', value: kpis.ready.count, sub: `${kpis.ready.units} chairs` },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="text-[13px] font-medium text-slate-500">{c.label}</div>
                <div className="mt-2 text-2xl sm:text-3xl whitespace-nowrap font-semibold tracking-tight text-slate-900 tabular-nums">{c.value}</div>
                <div className="mt-1 text-[13px] text-slate-500">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Stage owners (collapsed) */}
          <div>
            <button
              onClick={() => setShowOwners(v => !v)}
              className="w-full flex items-center justify-between bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/80 px-5 py-4 text-left cursor-pointer transition-colors"
              aria-expanded={showOwners}
            >
              <span>
                <span className="block text-base font-semibold text-slate-900">Who owns each stage</span>
                <span className="block text-[13px] text-slate-500 mt-0.5">Tap a person to filter the orders</span>
              </span>
              <span className="text-sm font-medium text-slate-500">{showOwners ? 'Hide' : 'Show'}</span>
            </button>
            {showOwners && (
              <div className="mt-4">
                <ResponsibleStats
                  orders={filteredOrders}
                  selectedResponsibles={selectedResponsibles}
                  onTogglePersonFilter={onResponsibleToggle}
                  onClearAll={onClearResponsibles}
                />
              </div>
            )}
          </div>

          {/* Orders list */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Orders <span className="text-slate-500 font-normal tabular-nums">{filteredOrders.length}</span>
            </h2>

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
                  <p className="font-semibold text-base text-slate-800">No orders match</p>
                  <p className="text-[13px] text-slate-500 mt-1">Try clearing the filters.</p>
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
