import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAndParseData, getCachedOrders } from './services/googleSheetService';
import type { Order, ProductionStepName, Insight } from './types';
import Header from './components/Header';
import type { ViewMode } from './components/Header';
import TodayHome from './components/TodayHome';
import ProductionDashboard from './components/ProductionDashboard';
import ReadyGoodsDashboard from './components/ReadyGoodsDashboard';
import ReadyStockDashboard from './components/ReadyStockDashboard';
import ReceivableListDashboard from './components/ReceivableListDashboard';
import PmsManesarView from './components/PmsManesarView';
import PmsIndoreView from './components/PmsIndoreView';
import OvertimeTrackerDashboard from './components/OvertimeTrackerDashboard';
import ServiceComplaintTrackerDashboard from './components/ServiceComplaintTrackerDashboard';
import SalesReportDashboard from './components/SalesReportDashboard';
import ExecutiveHubDashboard from './components/ExecutiveHubDashboard';
import RealTimeGrossProfitDashboard from './components/RealTimeGrossProfitDashboard';
import OrderDetailModal from './components/OrderDetailModal';
import LoadingSpinner from './components/LoadingSpinner';
import { AIAgentChatDrawer } from './components/AIAgentChatDrawer';
import { Bot } from 'lucide-react';
import { generateDashboardInsights } from './services/geminiService';
import { PRODUCTION_STAGES } from './constants';
import { fetchReadyGoodsData, getCachedReadyGoods } from './services/readyGoodsService';
import { fetchReadyStockData, getCachedReadyStock } from './services/readyStockService';
import { fetchReceivableListData, getCachedReceivables } from './services/receivableListService';
import { fetchFinalQcRecords } from './services/qcResponsesService';
import { fetchDispatchRecords } from './services/dispatchResponseService';
import { DEFAULT_STATUSES } from './components/FilterBar';

export interface ChatMessage {
  author: 'user' | 'ai';
  content: string;
}

const App: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(() => getCachedOrders());
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getCachedOrders();
    return !cached || cached.length === 0;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAIAgentOpen, setIsAIAgentOpen] = useState<boolean>(false);

  // View Mode: 'today' (CEO home) | 'dashboard' | 'readyGoods' | 'readyStock' | 'receivableList' | 'pmsManesar' | 'pmsIndore' | 'overtime' | 'serviceComplaints' | 'salesReport' | 'executiveHub' | 'grossProfit'
  const [viewMode, setViewMode] = useState<ViewMode>('today');

  // Detail Modal for Selected Order
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Multi-Filter states
  const [searchQuery, setSearchQuery] = useState('');
  // Default status EXCLUDES "Dispatched" orders for optimal performance & focused workflow
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [dispatchMonthFilter, setDispatchMonthFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'live' | 'archive'>('all');

  // Pagination states for Cards view
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Badge dynamic counts for universal sync
  const [readyGoodsCount, setReadyGoodsCount] = useState<number>(() =>
    getCachedReadyGoods().reduce((sum, item) => sum + item.readyGoodsQty, 0)
  );
  const [readyStockCount, setReadyStockCount] = useState<number>(() =>
    getCachedReadyStock().reduce((sum, item) => sum + item.qty, 0)
  );
  const [receivablesTotal, setReceivablesTotal] = useState<number>(() =>
    getCachedReceivables().length
  );
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else if (orders.length === 0) {
        setLoading(true);
      }
      
      // Step 1: Fast path - fetch and parse production orders (resolves in ~1s)
      const ordersData = await fetchAndParseData();
      setOrders(ordersData);
      setLoading(false); // Screen is rendered immediately!

      // Step 2: Background stream for auxiliary badges without blocking the main dashboard
      Promise.allSettled([
        fetchFinalQcRecords(isManualRefresh),
        fetchDispatchRecords(),
        fetchReadyGoodsData(isManualRefresh),
        fetchReadyStockData(isManualRefresh),
        fetchReceivableListData(isManualRefresh),
      ]).then(([qcRes, dispatchRes, rgRes, rsRes, recvRes]) => {
        if (rgRes.status === 'fulfilled' && rgRes.value && rgRes.value.length > 0) {
          setReadyGoodsCount(rgRes.value.reduce((sum, item) => sum + item.readyGoodsQty, 0));
        }
        if (rsRes.status === 'fulfilled' && rsRes.value && rsRes.value.length > 0) {
          setReadyStockCount(rsRes.value.reduce((sum, item) => sum + item.qty, 0));
        }
        if (recvRes.status === 'fulfilled' && recvRes.value) {
          setReceivablesTotal(recvRes.value.length);
        }
        setRefreshKey(prev => prev + 1);
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred loading production data.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fail-safe: Ensure loading screen never blocks or persists longer than 1.5 seconds under any network condition
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    loadData();

    return () => clearTimeout(safetyTimer);
  }, []);

  const counts = useMemo(() => {
    const live = orders.filter(o => !o.isArchived).length;
    const archive = orders.filter(o => o.isArchived).length;
    return { all: orders.length, live, archive };
  }, [orders]);

  // Status counts based on current source
  const statusCounts = useMemo(() => {
    const sourceScoped = sourceFilter === 'live'
      ? orders.filter(o => !o.isArchived)
      : sourceFilter === 'archive'
      ? orders.filter(o => o.isArchived)
      : orders;

    const countsMap: { [status: string]: number } = {
      'WIP': 0,
      'Ready': 0,
      'On Hold': 0,
      'Dispatched': 0,
    };

    sourceScoped.forEach(o => {
      if (countsMap[o.overallStatus] !== undefined) {
        countsMap[o.overallStatus]++;
      }
    });

    return countsMap;
  }, [orders, sourceFilter]);

  const uniqueDispatchMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(o => {
      if (o.dispatchDate) {
        months.add(o.dispatchDate.substring(0, 7)); // YYYY-MM
      }
    });
    return ['All', ...Array.from(months).sort().reverse()];
  }, [orders]);

  // Comprehensive Multi-Dimensional Filtering
  useEffect(() => {
    let result = orders;

    // Filter by Sheet Source (All, Live Stream, Dispatched Archive)
    if (sourceFilter === 'live') {
      result = result.filter(o => !o.isArchived);
    } else if (sourceFilter === 'archive') {
      result = result.filter(o => o.isArchived);
    }

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(o => 
        (o.opfNo || '').toLowerCase().includes(q) || 
        (o.modelName || '').toLowerCase().includes(q) ||
        (o.upholstery || '').toLowerCase().includes(q) ||
        (o.currentResponsible ? o.currentResponsible.toLowerCase().includes(q) : false)
      );
    }

    // Status Multi-Select Filter (if not empty)
    if (selectedStatuses.length > 0) {
      result = result.filter(o => selectedStatuses.includes(o.overallStatus));
    } else {
      // If user cleared all statuses, return empty list
      result = [];
    }

    // Stage Multi-Select Filter
    if (selectedStages.length > 0) {
      result = result.filter(o => 
        selectedStages.includes(o.currentStage) || 
        o.steps.some(s => selectedStages.includes(s.name) && s.status === 'In Progress')
      );
    }

    // Responsible Person Multi-Select Filter
    if (selectedResponsibles.length > 0) {
      result = result.filter(o => 
        (o.currentResponsible && selectedResponsibles.includes(o.currentResponsible)) || 
        o.steps.some(s => selectedResponsibles.includes(s.responsible) && (s.status === 'In Progress' || (s.delay && s.delay > 0)))
      );
    }

    // Dispatch Month Filter
    if (dispatchMonthFilter !== 'All') {
      result = result.filter(o => o.dispatchDate && o.dispatchDate.startsWith(dispatchMonthFilter));
    }

    setFilteredOrders(result);
    setCurrentPage(1); // Reset page to 1 on filter changes
  }, [
    searchQuery, 
    selectedStatuses, 
    selectedStages, 
    selectedResponsibles, 
    dispatchMonthFilter, 
    sourceFilter, 
    orders
  ]);

  // Handlers for Status Multi-Select
  const handleStatusToggle = useCallback((status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  }, []);

  const handleSelectAllStatuses = useCallback(() => {
    setSelectedStatuses(['WIP', 'Ready', 'On Hold', 'Dispatched']);
  }, []);

  const handleSelectActiveStatuses = useCallback(() => {
    setSelectedStatuses(DEFAULT_STATUSES);
  }, []);

  const handleClearStatuses = useCallback(() => {
    setSelectedStatuses([]);
  }, []);

  // Handlers for Stage Multi-Select
  const handleStageToggle = useCallback((stage: string) => {
    setSelectedStages(prev => 
      prev.includes(stage)
        ? prev.filter(s => s !== stage)
        : [...prev, stage]
    );
  }, []);

  const handleSelectAllStages = useCallback(() => {
    setSelectedStages([...PRODUCTION_STAGES]);
  }, []);

  const handleClearStages = useCallback(() => {
    setSelectedStages([]);
  }, []);

  // Handlers for Responsible Multi-Select
  const handleResponsibleToggle = useCallback((person: string) => {
    setSelectedResponsibles(prev => 
      prev.includes(person)
        ? prev.filter(p => p !== person)
        : [...prev, person]
    );
  }, []);

  const handleSelectAllResponsibles = useCallback(() => {
    const allOwners = Array.from(new Set(orders.map(o => o.currentResponsible).filter(Boolean))) as string[];
    setSelectedResponsibles(allOwners);
  }, [orders]);

  const handleClearResponsibles = useCallback(() => {
    setSelectedResponsibles([]);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedStatuses(DEFAULT_STATUSES); // Resets to Active (WIP, Ready, On Hold) excluding Dispatched
    setSelectedStages([]);
    setSelectedResponsibles([]);
    setDispatchMonthFilter('All');
    setSourceFilter('all');
    setCurrentPage(1);
  }, []);

  // KPIs calculation on filtered set
  const kpis = useMemo(() => {
    const calculateStats = (orderList: Order[]) => ({
      count: orderList.length,
      units: orderList.reduce((sum, o) => sum + o.quantity, 0)
    });

    return {
      total: calculateStats(filteredOrders),
      onHold: calculateStats(filteredOrders.filter(o => o.overallStatus === 'On Hold')),
      wip: calculateStats(filteredOrders.filter(o => o.overallStatus === 'WIP')),
      ready: calculateStats(filteredOrders.filter(o => o.overallStatus === 'Ready')),
      dispatched: calculateStats(filteredOrders.filter(o => o.overallStatus === 'Dispatched')),
    };
  }, [filteredOrders]);

  // Stage Bottleneck Counts (Active WIP only)
  const chartData = useMemo(() => {
    const stageCounts: { [key in ProductionStepName]: number } = Object.fromEntries(
      PRODUCTION_STAGES.map(stage => [stage, 0])
    ) as { [key in ProductionStepName]: number };

    filteredOrders.forEach(order => {
      if (order.currentStage && stageCounts.hasOwnProperty(order.currentStage) && order.overallStatus === 'WIP') {
        stageCounts[order.currentStage]++;
      }
    });

    return PRODUCTION_STAGES.map(stage => ({ 
      name: stage, 
      orders: stageCounts[stage] 
    }));
  }, [filteredOrders]);
  
  // On-time Performance
  const onTimeData = useMemo(() => {
    let onTime = 0;
    let delayed = 0;

    filteredOrders.forEach(order => {
      const qcStep = order.steps.find(step => step.name === 'QUALITY CONTROL');
      const dispatchDate = order.dispatchDate;
      if (qcStep?.actualDate && dispatchDate) {
        const qcDate = new Date(qcStep.actualDate);
        const schedDate = new Date(dispatchDate);
        qcDate.setUTCHours(0, 0, 0, 0);
        schedDate.setUTCHours(0, 0, 0, 0);
        if (qcDate <= schedDate) {
          onTime++;
        } else {
          delayed++;
        }
      } else if (order.overallStatus === 'Dispatched') {
        onTime++;
      }
    });

    return [
      { name: 'Delayed', value: delayed, color: '#F97316' }, 
      { name: 'On Time', value: onTime || 1, color: '#22C55E' }
    ];
  }, [filteredOrders]);

  // Paginated order cards
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, validCurrentPage, pageSize]);

  const handleGenerateInsights = async (): Promise<Insight[]> => {
    return generateDashboardInsights({
      totalOrders: kpis.total.count,
      kpis: {
        wip: kpis.wip.count,
        onHold: kpis.onHold.count,
        dispatched: kpis.dispatched.count,
        ready: kpis.ready.count
      },
      bottleneckStages: [...chartData].filter(d => d.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 3),
      sampleOrders: filteredOrders.slice(0, 8).map(o => ({ 
        opf: o.opfNo, 
        model: o.modelName, 
        status: o.overallStatus, 
        currentStage: o.currentStage, 
        dispatchDate: o.dispatchDate,
        responsible: o.currentResponsible
      })),
      onTimeData,
    });
  };
  
  // Hold Orders stats for header badge
  const holdOrdersStats = useMemo(() => {
    const holds = orders.filter(o => {
      if (o.overallStatus === 'Dispatched' || o.isArchived) return false;
      return o.overallStatus === 'On Hold' || 
        (o.dispatchDate ? o.dispatchDate.toUpperCase().includes('HOLD') : false) ||
        o.steps.some(s => s.remarks && s.remarks.toUpperCase().includes('HOLD'));
    });
    return {
      count: holds.length,
      units: holds.reduce((sum, o) => sum + (o.quantity || 0), 0)
    };
  }, [orders]);

  // Total ready goods units for header badge
  const readyGoodsUnits = useMemo(() => {
    return getCachedReadyGoods().reduce((sum, item) => sum + item.readyGoodsQty, 0);
  }, []);

  // Total ready stock units for header badge
  const readyStockUnits = useMemo(() => {
    return getCachedReadyStock().reduce((sum, item) => sum + item.qty, 0);
  }, []);

  // Total receivables count for header badge
  const receivablesCount = useMemo(() => {
    return getCachedReceivables().length;
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700 px-4">
        <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center">
          <img
            src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png"
            alt="Little Nap Recliners Logo"
            className="h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="text-[11px] font-bold text-slate-600 tracking-wider mt-1.5 uppercase">
            Intranet Enterprise Portal
          </span>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Header with Production title, PC Kanishka badge, View switcher, and universal live sync */}
      <Header 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        totalOrders={orders.length}
        holdCount={holdOrdersStats.count}
        holdUnits={holdOrdersStats.units}
        readyGoodsUnits={readyGoodsCount}
        readyStockUnits={readyStockCount}
        receivablesCount={receivablesTotal}
        onOpenAIAgent={() => setIsAIAgentOpen(true)}
      />


      <main className={`w-full flex-1 animate-fade-in ${
        viewMode === 'overtime' || viewMode === 'pmsIndore' || viewMode === 'serviceComplaints' || viewMode === 'salesReport' || viewMode === 'executiveHub' || viewMode === 'grossProfit'
          ? 'p-0 max-w-none flex flex-col' 
          : 'max-w-[1920px] mx-auto p-4 md:p-6 lg:p-8 space-y-6'
      }`}>
        {/* VIEW 0: TODAY - CEO HOME SUMMARY */}
        {viewMode === 'today' && (
          <TodayHome
            key={`today-${refreshKey}`}
            orders={orders}
            readyGoodsUnits={readyGoodsCount}
            readyStockUnits={readyStockCount}
            receivables={getCachedReceivables()}
            onNavigate={setViewMode}
            onGenerateInsights={handleGenerateInsights}
          />
        )}

        {/* VIEW 1: EXECUTIVE PRODUCTION DASHBOARD */}
        {viewMode === 'dashboard' && (
          <ProductionDashboard 
            key={`dashboard-${refreshKey}`}
            orders={orders}
            onRefresh={() => loadData(true)}
            isRefreshing={isRefreshing}
            onSelectOrder={setSelectedOrder}
            onNavigateToReadyGoods={() => setViewMode('readyGoods')}
            onNavigateToReadyStock={() => setViewMode('readyStock')}
          />
        )}

        {/* VIEW 2: READY GOODS DASHBOARD */}
        {viewMode === 'readyGoods' && (
          <ReadyGoodsDashboard 
            key={`readyGoods-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 3: READY STOCK DASHBOARD */}
        {viewMode === 'readyStock' && (
          <ReadyStockDashboard 
            key={`readyStock-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 4: RECEIVABLE LIST DASHBOARD */}
        {viewMode === 'receivableList' && (
          <ReceivableListDashboard 
            key={`receivableList-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 5: PMS @ MANESAR (CONSOLIDATED PIPELINE, CALENDAR, HOLD ORDERS, BOTTLENECKS, DATA SHEET) */}
        {viewMode === 'pmsManesar' && (
          <PmsManesarView 
            key={`pmsManesar-${refreshKey}`}
            orders={orders}
            filteredOrders={filteredOrders}
            onSelectOrder={setSelectedOrder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedStatuses={selectedStatuses}
            onStatusToggle={handleStatusToggle}
            onSelectAllStatuses={handleSelectAllStatuses}
            onSelectActiveStatuses={handleSelectActiveStatuses}
            onClearStatuses={handleClearStatuses}
            selectedStages={selectedStages}
            onStageToggle={handleStageToggle}
            onSelectAllStages={handleSelectAllStages}
            onClearStages={handleClearStages}
            selectedResponsibles={selectedResponsibles}
            onResponsibleToggle={handleResponsibleToggle}
            onSelectAllResponsibles={handleSelectAllResponsibles}
            onClearResponsibles={handleClearResponsibles}
            uniqueDispatchMonths={uniqueDispatchMonths}
            dispatchMonthFilter={dispatchMonthFilter}
            onDispatchMonthChange={setDispatchMonthFilter}
            sourceFilter={sourceFilter}
            onSourceChange={setSourceFilter}
            counts={counts}
            statusCounts={statusCounts}
            kpis={kpis}
            onResetFilters={handleResetFilters}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            chartData={chartData}
            onTimeData={onTimeData}
            onGenerateInsights={handleGenerateInsights}
          />
        )}

        {/* VIEW 6: PMS @ INDORE FACTORY DASHBOARD */}
        {viewMode === 'pmsIndore' && (
          <PmsIndoreView 
            key={`pmsIndore-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 7: WORKFORCE OVERTIME MANAGEMENT PORTAL & STEP ANALYTICS */}
        {viewMode === 'overtime' && (
          <OvertimeTrackerDashboard 
            key={`overtime-${refreshKey}`}
            orders={orders}
            onBackToDashboard={() => setViewMode('today')}
            onSelectOrder={setSelectedOrder}
          />
        )}

        {/* VIEW 8: SERVICE OPEN COMPLAINT TRACKER PORTAL & DATA STREAM */}
        {viewMode === 'serviceComplaints' && (
          <ServiceComplaintTrackerDashboard 
            key={`serviceComplaints-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 9: SALE REPORT & ADMIN TEAM PERFORMANCE PORTAL & DATA STREAM */}
        {viewMode === 'salesReport' && (
          <SalesReportDashboard 
            key={`salesReport-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 10: EXECUTIVE MASTER RESOURCE & COMMAND HUB */}
        {viewMode === 'executiveHub' && (
          <ExecutiveHubDashboard 
            key={`executiveHub-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}

        {/* VIEW 11: REAL-TIME GROSS PROFIT PORTAL & DATA STREAM */}
        {viewMode === 'grossProfit' && (
          <RealTimeGrossProfitDashboard 
            key={`grossProfit-${refreshKey}`}
            onBackToDashboard={() => setViewMode('today')}
          />
        )}
      </main>

      {/* Detail Modal for Selected Order */}
      <OrderDetailModal 
        order={selectedOrder} 
        onClose={() => setSelectedOrder(null)} 
      />

      {/* Floating Assistant Trigger Button */}
      <div className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ${isAIAgentOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
        <button
          onClick={() => setIsAIAgentOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all cursor-pointer"
          aria-label="Open Assistant"
          title="Open Assistant"
        >
          <Bot className="w-4 h-4" />
          <span className="text-xs font-semibold">Ask AI</span>
        </button>
      </div>

      {/* AI Agent Chat Drawer with Live Data Grounding & File Upload capability */}
      <AIAgentChatDrawer 
        isOpen={isAIAgentOpen}
        onClose={() => setIsAIAgentOpen(false)}
        orders={orders}
        readyGoods={getCachedReadyGoods()}
        readyStock={getCachedReadyStock()}
        receivables={getCachedReceivables()}
      />
    </div>
  );
};

export default App;
