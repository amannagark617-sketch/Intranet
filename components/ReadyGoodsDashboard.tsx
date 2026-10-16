import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchReadyGoodsData, 
  calculateReadyGoodsSummary, 
  calculateDateRangeBreakdown,
  formatINR, 
  formatDisplayDate,
  getCachedReadyGoods,
  type ReadyGoodItem,
  type DateRangeCategorySummary 
} from '../services/readyGoodsService';
import { exportReadyGoodsToExcel } from '../utils/excelExport';
import { 
  Search, 
  RefreshCw, 
  Filter, 
  Download, 
  PackageCheck, 
  Calendar, 
  ChevronDown, 
  ExternalLink, 
  Layers, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Building2, 
  MapPin, 
  User, 
  PhoneCall, 
  BarChart3, 
  PieChart, 
  LayoutGrid, 
  Table as TableIcon, 
  Eye, 
  ArrowUpRight, 
  ShieldAlert, 
  ArrowUpDown, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { formatInrCompact, titleCase } from '../utils/format';

interface ReadyGoodsDashboardProps {
  onBackToDashboard?: () => void;
}

type ViewMode = 'pipeline' | 'charts' | 'table';

export const ReadyGoodsDashboard: React.FC<ReadyGoodsDashboardProps> = ({ onBackToDashboard }) => {
  // Initialize with pre-cached ready goods dataset so data displays automatically with zero delay
  const [items, setItems] = useState<ReadyGoodItem[]>(() => getCachedReadyGoods());
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active View Mode: pipeline (kanban stages), charts, table
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('All');
  const [selectedCreName, setSelectedCreName] = useState<string>('All');
  const [selectedAgingStage, setSelectedAgingStage] = useState<string>('All');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'pending' | 'partial' | 'due' | 'received' | 'warehouse'>('All');

  // Selected Order for Slide-out / Modal Details
  const [selectedOrder, setSelectedOrder] = useState<ReadyGoodItem | null>(null);

  // Table Sorting & Pagination States
  const [sortField, setSortField] = useState<keyof ReadyGoodItem>('daysInFactory');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchReadyGoodsData(force);
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load Ready Goods sheet data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct Filter Options
  const salesPersons = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.salesPerson) set.add(i.salesPerson); });
    return Array.from(set).sort();
  }, [items]);

  const creNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.creName) set.add(i.creName); });
    return Array.from(set).sort();
  }, [items]);

  // Helper to get stage bucket for an item
  const getStageBucket = (days: number): string => {
    if (days <= 15) return '1 - 15 Days';
    if (days <= 30) return '16 - 30 Days';
    if (days <= 45) return '31 - 45 Days';
    if (days <= 60) return '46 - 60 Days';
    return '61+ Days';
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Salesperson
      if (selectedSalesPerson !== 'All' && item.salesPerson !== selectedSalesPerson) return false;
      // CRE Name
      if (selectedCreName !== 'All' && item.creName !== selectedCreName) return false;
      // Aging Stage
      if (selectedAgingStage !== 'All') {
        const bucket = getStageBucket(item.daysInFactory);
        if (bucket !== selectedAgingStage) return false;
      }
      // Payment status
      if (paymentFilter === 'pending' && item.totalReceived > 0) return false;
      if (paymentFilter === 'partial' && (item.totalReceived === 0 || item.balancePayment <= 0)) return false;
      if (paymentFilter === 'due' && item.balancePayment <= 0) return false;
      if (paymentFilter === 'received' && item.totalReceived <= 0) return false;
      if (paymentFilter === 'warehouse' && item.warehouseCharges <= 0) return false;

      // Universal Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const mOpf = (item.opfNo || '').toLowerCase().includes(q);
        const mModel = (item.modelOfRecliners || '').toLowerCase().includes(q);
        const mCust = (item.customerName || '').toLowerCase().includes(q);
        const mComp = (item.companyName || '').toLowerCase().includes(q);
        const mLoc = (item.location || '').toLowerCase().includes(q);
        const mSales = (item.salesPerson || '').toLowerCase().includes(q);
        const mCre = (item.creName || '').toLowerCase().includes(q);
        const mRemarks = (item.creCallingRemarks || '').toLowerCase().includes(q);
        if (!mOpf && !mModel && !mCust && !mComp && !mLoc && !mSales && !mCre && !mRemarks) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedSalesPerson, selectedCreName, selectedAgingStage, paymentFilter, searchTerm]);

  // Overall & Global KPI Summary
  const overallSummary = useMemo(() => calculateReadyGoodsSummary(items), [items]);
  const globalSummary = useMemo(() => calculateReadyGoodsSummary(filteredItems), [filteredItems]);

  // Average days in factory
  const avgDays = useMemo(() => {
    if (filteredItems.length === 0) return 0;
    const total = filteredItems.reduce((acc, i) => acc + (i.daysInFactory || 0), 0);
    return Math.round(total / filteredItems.length);
  }, [filteredItems]);

  // Critical overdue (>60 days) count
  const criticalOverdueCount = useMemo(() => {
    return filteredItems.filter(i => i.daysInFactory > 60).length;
  }, [filteredItems]);

  // Reset Filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSalesPerson('All');
    setSelectedCreName('All');
    setSelectedAgingStage('All');
    setPaymentFilter('All');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm !== '' || 
    selectedSalesPerson !== 'All' || 
    selectedCreName !== 'All' || 
    selectedAgingStage !== 'All' || 
    paymentFilter !== 'All';

  // Export Excel
  const exportToExcel = () => {
    if (filteredItems.length === 0) return;
    exportReadyGoodsToExcel(filteredItems, `Ready_Goods_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Pipeline Columns Definition
  const PIPELINE_COLUMNS = [
    {
      id: '1 - 15 Days',
      title: 'Up to 15 days',
      daysRange: '1 to 15 Days',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      headerBg: 'border-t-4 border-t-emerald-500',
      accentColor: 'text-emerald-700',
      description: 'Recently finished inspection, ready for initial dispatch coordination'
    },
    {
      id: '16 - 30 Days',
      title: '16 – 30 days',
      daysRange: '16 to 30 Days',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      headerBg: 'border-t-4 border-t-sky-500',
      accentColor: 'text-indigo-700',
      description: 'Awaiting site clearance or customer delivery confirmation'
    },
    {
      id: '31 - 45 Days',
      title: '31 – 45 days',
      daysRange: '31 to 45 Days',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      headerBg: 'border-t-4 border-t-amber-500',
      accentColor: 'text-amber-700',
      description: 'Moderate aging; CRE follow-up active for balance collection'
    },
    {
      id: '46 - 60 Days',
      title: '46 – 60 days',
      daysRange: '46 to 60 Days',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      headerBg: 'border-t-4 border-t-orange-500',
      accentColor: 'text-amber-700',
      description: 'Warehouse holding limits approaching; urgent escalation required'
    },
    {
      id: '61+ Days',
      title: 'Over 60 days',
      daysRange: '61+ Days',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      headerBg: 'border-t-4 border-t-rose-500',
      accentColor: 'text-rose-700',
      description: 'High holding duration, warehouse penalty accumulation'
    }
  ];

  // Group items by pipeline stage
  const pipelineGroups = useMemo(() => {
    const map = new Map<string, ReadyGoodItem[]>();
    PIPELINE_COLUMNS.forEach(col => map.set(col.id, []));

    filteredItems.forEach(item => {
      const bucket = getStageBucket(item.daysInFactory);
      const list = map.get(bucket) || [];
      list.push(item);
      map.set(bucket, list);
    });

    return map;
  }, [filteredItems]);

  // Chart Data: Aging Distribution
  const agingChartData = useMemo(() => {
    return PIPELINE_COLUMNS.map(col => {
      const colItems = pipelineGroups.get(col.id) || [];
      const units = colItems.reduce((acc, i) => acc + i.readyGoodsQty, 0);
      const balanceLakhs = Number((colItems.reduce((acc, i) => acc + i.balancePayment, 0) / 100000).toFixed(2));
      return {
        name: col.title,
        range: col.daysRange,
        orders: colItems.length,
        units,
        balanceLakhs
      };
    });
  }, [pipelineGroups]);

  // Chart Data: Payment Breakdown Donut
  const paymentDonutData = useMemo(() => {
    const received = globalSummary.totalReceived;
    const balance = globalSummary.totalBalance;
    const warehouse = globalSummary.totalWarehouseCharges;
    return [
      { name: 'Total Received', value: received, color: '#10b981' },
      { name: 'Balance Receivable', value: balance, color: '#f59e0b' },
      { name: 'Warehouse Dues', value: warehouse, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [globalSummary]);

  // Chart Data: Top Salesperson Outstanding
  const salesChartData = useMemo(() => {
    const map = new Map<string, { orders: number; units: number; balance: number }>();
    filteredItems.forEach(i => {
      const sp = i.salesPerson || 'Unassigned';
      const cur = map.get(sp) || { orders: 0, units: 0, balance: 0 };
      cur.orders += 1;
      cur.units += i.readyGoodsQty;
      cur.balance += i.balancePayment;
      map.set(sp, cur);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        balanceLakhs: Number((data.balance / 100000).toFixed(2)),
        orders: data.orders,
        units: data.units
      }))
      .sort((a, b) => b.balanceLakhs - a.balanceLakhs)
      .slice(0, 8);
  }, [filteredItems]);

  // Table Sorting and Pagination
  const sortedTableItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredItems, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedTableItems.length / pageSize) || 1;
  const paginatedTableItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTableItems.slice(start, start + pageSize);
  }, [sortedTableItems, currentPage, pageSize]);

  const handleSort = (field: keyof ReadyGoodItem) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/60 p-3 sm:p-6 lg:p-8 font-sans text-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Ready goods</h1>
          <p className="mt-1 text-sm text-slate-500">
            {globalSummary.totalOrders} orders · {globalSummary.totalReadyGoodsQty} chairs finished and waiting
          </p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={filteredItems.length === 0}
          className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline font-semibold hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Key numbers (tap one to filter the list below) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            key: 'all',
            label: 'Chairs ready',
            value: `${globalSummary.totalReadyGoodsQty}`,
            sub: `${globalSummary.totalOrders} orders`,
            active: !hasActiveFilters,
            onClick: resetFilters,
          },
          {
            key: 'due',
            label: 'Balance to collect',
            value: formatInrCompact(globalSummary.totalBalance),
            sub: `${globalSummary.pctReceived}% of ${formatInrCompact(globalSummary.grossAmount)} collected`,
            active: paymentFilter === 'due',
            onClick: () => setPaymentFilter(prev => (prev === 'due' ? 'All' : 'due')),
          },
          {
            key: 'wh',
            label: 'Warehouse charges',
            value: formatInrCompact(globalSummary.totalWarehouseCharges),
            sub: 'owed for storage',
            active: paymentFilter === 'warehouse',
            onClick: () => setPaymentFilter(prev => (prev === 'warehouse' ? 'All' : 'warehouse')),
          },
          {
            key: 'age',
            label: 'Average time in factory',
            value: `${avgDays} days`,
            sub: `${criticalOverdueCount} orders over 60 days`,
            active: selectedAgingStage === '61+ Days',
            onClick: () => setSelectedAgingStage(prev => (prev === '61+ Days' ? 'All' : '61+ Days')),
          },
        ].map(c => (
          <button
            key={c.key}
            onClick={c.onClick}
            className={`text-left bg-white rounded-2xl border px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer ${
              c.active && c.key !== 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/80'
            }`}
          >
            <div className="text-[13px] font-medium text-slate-500">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{c.value}</div>
            <div className="mt-1 text-xs text-slate-400">{c.sub}</div>
          </button>
        ))}
      </div>

      {/* REAL-TIME ACTIVE DRILLDOWN SUMMARY BANNER */}
      {hasActiveFilters && (
        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-950 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-amber-900 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Filtered by:
            </span>
            {paymentFilter === 'due' && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
                Balance Due: {filteredItems.length} orders (₹{formatINR(globalSummary.totalBalance)})
              </span>
            )}
            {paymentFilter === 'received' && (
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                Collected Payments: {filteredItems.length} orders
              </span>
            )}
            {paymentFilter === 'warehouse' && (
              <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-full font-semibold">
                Warehouse Dues (&gt; ₹0): {filteredItems.length} orders (₹{formatINR(globalSummary.totalWarehouseCharges)})
              </span>
            )}
            {selectedAgingStage !== 'All' && (
              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                Aging Bracket: {selectedAgingStage}
              </span>
            )}
            {selectedSalesPerson !== 'All' && (
              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                Salesperson: {selectedSalesPerson}
              </span>
            )}
            {selectedCreName !== 'All' && (
              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                CRE: {selectedCreName}
              </span>
            )}
            {searchTerm && (
              <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-semibold">
                Search: "{searchTerm}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-900 font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
            >
              View {filteredItems.length} in Table →
            </button>
            <button
              onClick={resetFilters}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SUB-NAV VIEW SWITCHER & UNIVERSAL FILTERS BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* View tabs */}
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {([
              { id: 'pipeline', label: 'By age' },
              { id: 'table', label: 'Table' },
              { id: 'charts', label: 'Charts' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setViewMode(t.id)}
                className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active Filter Count & Reset */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{filteredItems.length} of {items.length} orders</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 bg-rose-50 rounded-lg border border-rose-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search order or customer"
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-indigo-500 focus:outline-hidden transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={selectedSalesPerson}
            onChange={e => setSelectedSalesPerson(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden"
          >
            <option value="All">All salespeople</option>
            {salesPersons.map(sp => (
              <option key={sp} value={sp}>{sp}</option>
            ))}
          </select>
          <select
            value={selectedAgingStage}
            onChange={e => setSelectedAgingStage(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden"
          >
            <option value="All">Any age</option>
            <option value="1 - 15 Days">Up to 15 days</option>
            <option value="16 - 30 Days">16 – 30 days</option>
            <option value="31 - 45 Days">31 – 45 days</option>
            <option value="46 - 60 Days">46 – 60 days</option>
            <option value="61+ Days">Over 60 days</option>
          </select>
          <button
            onClick={() => setShowMoreFilters(v => !v)}
            className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap"
          >
            {showMoreFilters ? 'Fewer filters' : 'More filters'}
          </button>
        </div>
        {showMoreFilters && (
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedCreName}
              onChange={e => setSelectedCreName(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="All">All follow-up owners</option>
              {creNames.map(cre => (
                <option key={cre} value={cre}>{cre}</option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as any)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="All">Any payment status</option>
              <option value="pending">Nothing paid yet</option>
              <option value="partial">Partly paid</option>
            </select>
          </div>
        )}
      </div>

      {/* Main content */}

      {/* VIEW 1: AGING PIPELINE (KANBAN STAGES FORMAT) */}
      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {PIPELINE_COLUMNS.map(col => {
              const colItems = pipelineGroups.get(col.id) || [];
              const totalUnits = colItems.reduce((acc, i) => acc + i.readyGoodsQty, 0);
              const totalBalance = colItems.reduce((acc, i) => acc + i.balancePayment, 0);
              const isColActive = selectedAgingStage === col.id;

              return (
                <div 
                  key={col.id} 
                  className={`bg-slate-50 border rounded-2xl flex flex-col overflow-hidden transition-all ${
                    isColActive 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* Column Header */}
                  <div 
                    onClick={() => setSelectedAgingStage(prev => prev === col.id ? 'All' : col.id)}
                    className="p-3.5 bg-white border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition"
                    title={`Click to filter only ${col.daysRange} orders`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
                      <span className="text-xs tabular-nums font-medium text-slate-500 whitespace-nowrap">
                        {isColActive ? 'Filtered' : `${colItems.length} orders`}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-xs text-slate-500">
                      <span className="tabular-nums">{totalUnits} chairs</span>
                      <span className="tabular-nums font-medium text-slate-800">{formatInrCompact(totalBalance)} due</span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="p-2.5 space-y-2.5 flex-1 max-h-[750px] overflow-y-auto">
                    {colItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                        No orders
                      </div>
                    ) : (
                      colItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedOrder(item)}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{titleCase(item.customerName) || 'Customer'}</div>
                              <div className="text-xs text-slate-400 tabular-nums truncate">{item.opfNo}</div>
                            </div>
                            <span className={`shrink-0 whitespace-nowrap text-xs font-medium ${
                              item.daysInFactory > 60 ? 'text-rose-600' : item.daysInFactory > 30 ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                              {item.daysInFactory} days
                            </span>
                          </div>
                          <div className="mt-3 flex items-baseline justify-between text-xs">
                            <span className="text-slate-500 truncate pr-2">{item.readyGoodsQty} × {titleCase(item.modelOfRecliners) || 'Recliner'}</span>
                            <span className="tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                              {item.balancePayment > 0 ? `${formatInrCompact(item.balancePayment)} due` : 'Paid'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: ANALYTICS & CHARTS VIEW (CLICK-TO-FILTER INTERACTIVE) */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          {/* Top 2 Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Aging Stage Distribution */}
            <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Aging Stage Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any bar bracket to filter data real-time
                  </p>
                </div>
                <span className="text-xs tabular-nums font-semibold bg-slate-100 px-2 py-1 rounded text-slate-700">
                  {globalSummary.totalReadyGoodsQty} Total Units
                </span>
              </div>

              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={agingChartData} 
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clicked = state.activePayload[0].payload;
                        if (clicked && clicked.name) {
                          setSelectedAgingStage(prev => prev === clicked.name ? 'All' : clicked.name);
                        }
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#475569' }} 
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip 
                      formatter={(val: any, name: string | undefined) => [
                        name === 'balanceLakhs' ? `₹${val} Lakhs` : `${val} Units`,
                        name === 'balanceLakhs' ? 'Balance Due' : 'Ready Units'
                      ]}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="units" name="Ready Units" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="balanceLakhs" name="Balance (₹ Lakhs)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Payment Breakdown Donut */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Payment Collection Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click slice to filter by Received, Due, or Warehouse
                  </p>
                </div>
              </div>

              <div className="w-full h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={paymentDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      className="cursor-pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.name) {
                          if (entry.name.includes('Received')) {
                            setPaymentFilter(prev => prev === 'received' ? 'All' : 'received');
                          } else if (entry.name.includes('Balance')) {
                            setPaymentFilter(prev => prev === 'due' ? 'All' : 'due');
                          } else if (entry.name.includes('Warehouse')) {
                            setPaymentFilter(prev => prev === 'warehouse' ? 'All' : 'warehouse');
                          }
                        }
                      }}
                    >
                      {paymentDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`₹${formatINR(Number(val))}`, 'Amount']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 3: Top Salesperson Outstanding Balance */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Top Salespersons - Outstanding Balance
                </h3>
                <p className="text-xs text-slate-500">
                  Click any salesperson bar to drill-down and filter data
                </p>
              </div>
            </div>

            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={salesChartData} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const clicked = state.activePayload[0].payload;
                      if (clicked && clicked.name) {
                        setSelectedSalesPerson(prev => prev === clicked.name ? 'All' : clicked.name);
                      }
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip 
                    formatter={(val: any) => [`₹${val} Lakhs`, 'Balance Outstanding']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="balanceLakhs" name="Outstanding Balance (₹ Lakhs)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aging Matrix Summary Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Aging Matrix & Financial Summary
              </h3>
              <span className="text-xs text-slate-500">Click any row to filter stage</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="p-3">Aging Bracket</th>
                    <th className="p-3 text-right">Orders</th>
                    <th className="p-3 text-right">Ready Qty</th>
                    <th className="p-3 text-right">Gross Amount</th>
                    <th className="p-3 text-right">Warehouse Dues</th>
                    <th className="p-3 text-right">Total Received</th>
                    <th className="p-3 text-right">Balance Due</th>
                    <th className="p-3 text-right">% Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {calculateDateRangeBreakdown(filteredItems).map(row => {
                    const isSelected = selectedAgingStage === row.dateRange;
                    return (
                      <tr 
                        key={row.dateRange} 
                        onClick={() => setSelectedAgingStage(prev => prev === row.dateRange ? 'All' : row.dateRange)}
                        className={`hover:bg-indigo-50/70 cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50/90 font-semibold' : ''
                        }`}
                      >
                        <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                          {row.dateRange}
                        </td>
                        <td className="p-3 text-right tabular-nums">{row.totalOrders}</td>
                        <td className="p-3 text-right tabular-nums font-semibold text-emerald-700">{row.readyGoodsQty}</td>
                        <td className="p-3 text-right tabular-nums">₹{formatINR(row.grossAmount)}</td>
                        <td className="p-3 text-right tabular-nums text-rose-700">₹{formatINR(row.warehouseCharges)}</td>
                        <td className="p-3 text-right tabular-nums text-indigo-700">₹{formatINR(row.totalReceived)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold text-amber-700">₹{formatINR(row.balancePayment)}</td>
                        <td className="p-3 text-right tabular-nums">{row.pctBalancePayment}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: EXECUTIVE DATA TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Header with Row Counts */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Ready Goods Master Register
              </h3>
              <p className="text-xs text-slate-500">
                Sorted by {String(sortField)} ({sortDirection.toUpperCase()})
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 font-semibold"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-xs  select-none">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th 
                    onClick={() => handleSort('opfNo')}
                    className="p-3 cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center gap-1">
                      <span>OPF No</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('readyGoodsDate')}
                    className="p-3 cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ready Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('customerName')}
                    className="p-3 cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer / Company</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Sales / CRE</th>
                  <th 
                    onClick={() => handleSort('readyGoodsQty')}
                    className="p-3 text-right cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Ready Qty</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('balancePayment')}
                    className="p-3 text-right cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Balance Due</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('daysInFactory')}
                    className="p-3 text-center cursor-pointer hover:bg-slate-200/60"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Days</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTableItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 text-xs italic">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedTableItems.map((item, idx) => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedOrder(item)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-center text-slate-400 tabular-nums text-xs">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {item.opfNo}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDisplayDate(item.readyGoodsDate)}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{item.customerName || '-'}</div>
                        {(item.companyName || item.location) && (
                          <div className="text-xs text-slate-500 truncate max-w-xs">
                            {[item.companyName, item.location].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700 font-medium max-w-xs truncate">
                        {item.modelOfRecliners || '-'}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap text-xs">
                        <div>SP: {item.salesPerson || '-'}</div>
                        <div className="text-slate-400">CRE: {item.creName || '-'}</div>
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold text-emerald-700">
                        {item.readyGoodsQty}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                        ₹{formatINR(item.balancePayment)}
                      </td>
                      <td className="p-3 text-center tabular-nums">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          item.daysInFactory > 60
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : item.daysInFactory > 30
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {item.daysInFactory}d
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedOrder(item);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({sortedTableItems.length} records)
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. ORDER DETAIL MODAL / DRAWER */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tabular-nums tracking-tight">
                      OPF #{selectedOrder.opfNo}
                    </h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      selectedOrder.daysInFactory > 60
                        ? 'bg-rose-500/30 text-rose-300'
                        : 'bg-emerald-500/30 text-emerald-300'
                    }`}>
                      {selectedOrder.daysInFactory} Days in Factory
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ready Goods Date: {formatDisplayDate(selectedOrder.readyGoodsDate)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Customer & Product Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500">
                  Customer & Order Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Customer Name:</span>
                    <span className="font-semibold text-slate-900 text-sm">{selectedOrder.customerName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Company:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.companyName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location:</span>
                    <span className="font-medium text-slate-700">{selectedOrder.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Model of Recliners:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.modelOfRecliners || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ready Goods Quantity:</span>
                    <span className="tabular-nums font-semibold text-emerald-700 text-base">{selectedOrder.readyGoodsQty} Units</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Order Quantity:</span>
                    <span className="tabular-nums font-semibold text-slate-800">{selectedOrder.orderQty} Units</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500">
                  Financial Status & Receivables
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block font-semibold">Gross Amount</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.grossAmount)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-xs text-emerald-800 block font-semibold">Received</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-800 mt-0.5 block">
                      ₹{formatINR(selectedOrder.totalReceived)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-xs text-amber-800 block font-semibold">Balance Due</span>
                    <span className="text-sm font-semibold tabular-nums text-amber-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.balancePayment)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-xs text-rose-800 block font-semibold">Warehouse Dues</span>
                    <span className="text-sm font-semibold tabular-nums text-rose-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.warehouseCharges)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                  <span>Balance Percentage:</span>
                  <span className="tabular-nums font-semibold text-slate-900">{selectedOrder.pctBalancePayment}</span>
                </div>
              </div>

              {/* Relationship & Calling Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500">
                  CRM & Dispatch Follow-Up
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block">Salesperson:</span>
                    <span className="font-semibold text-slate-800">{selectedOrder.salesPerson || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CRE Executive:</span>
                    <span className="font-semibold text-slate-800">{selectedOrder.creName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Next Follow-Up Date:</span>
                    <span className="font-semibold text-indigo-700">
                      {formatDisplayDate(selectedOrder.creNextFollowUpDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Follow-Up Count:</span>
                    <span className="tabular-nums font-semibold text-slate-800">{selectedOrder.noOfFollowUps} Calls</span>
                  </div>
                </div>

                {selectedOrder.creCallingRemarks && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block mb-1">Latest Calling Remarks:</span>
                    <p className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 italic leading-relaxed">
                      "{selectedOrder.creCallingRemarks}"
                    </p>
                  </div>
                )}
              </div>

              {/* Form Link if present */}
              {selectedOrder.formLink && (
                <div className="flex justify-end">
                  <a
                    href={selectedOrder.formLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <span>Open Form Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors text-xs"
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

export default ReadyGoodsDashboard;
