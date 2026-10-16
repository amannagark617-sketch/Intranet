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
import { DailyEnterpriseSummaryView } from './DailyEnterpriseSummaryView';

interface ReadyGoodsDashboardProps {
  onBackToDashboard?: () => void;
}

type ViewMode = 'summary' | 'pipeline' | 'charts' | 'table';

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
      title: 'Fresh Ready',
      daysRange: '1 to 15 Days',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      headerBg: 'border-t-4 border-t-emerald-500',
      accentColor: 'text-emerald-700',
      description: 'Recently finished inspection, ready for initial dispatch coordination'
    },
    {
      id: '16 - 30 Days',
      title: 'Standard Transit',
      daysRange: '16 to 30 Days',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
      headerBg: 'border-t-4 border-t-sky-500',
      accentColor: 'text-sky-700',
      description: 'Awaiting site clearance or customer delivery confirmation'
    },
    {
      id: '31 - 45 Days',
      title: 'Follow-Up Notice',
      daysRange: '31 to 45 Days',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      headerBg: 'border-t-4 border-t-amber-500',
      accentColor: 'text-amber-700',
      description: 'Moderate aging; CRE follow-up active for balance collection'
    },
    {
      id: '46 - 60 Days',
      title: 'Aging Alert',
      daysRange: '46 to 60 Days',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
      headerBg: 'border-t-4 border-t-orange-500',
      accentColor: 'text-orange-700',
      description: 'Warehouse holding limits approaching; urgent escalation required'
    },
    {
      id: '61+ Days',
      title: 'Critical Stagnant',
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
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Finished Goods Inventory
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Ready Goods Stock
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Ready Goods Inventory & Pipeline</span>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
              {globalSummary.totalOrders} Orders • {globalSummary.totalReadyGoodsQty} Units
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time finished goods monitoring, aging pipeline stages, balance receivables & warehouse dues tracking
          </p>
        </div>

        {/* Global Actions: Back button, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
            >
              ← Back to Production
            </button>
          )}

          <button
            onClick={exportToExcel}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Export filtered Ready Goods inventory to formatted Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline font-bold hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. EXECUTIVE KPI CARDS (CLICK-TO-FILTER INTERACTIVE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Ready Goods Qty */}
        <div 
          onClick={resetFilters}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            !hasActiveFilters
              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/90 hover:border-emerald-300'
          }`}
          title="Click to view all Ready Goods inventory"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ready Stock</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-slate-900">
              {globalSummary.totalReadyGoodsQty}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">units</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Across {globalSummary.totalOrders} active orders
            </div>
          </div>
        </div>

        {/* Card 2: Balance Receivable */}
        <div 
          onClick={() => setPaymentFilter(prev => prev === 'due' ? 'All' : 'due')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            paymentFilter === 'due'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-amber-300'
          }`}
          title="Click to filter orders with pending Balance Due"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Balance Due</span>
            {paymentFilter === 'due' ? (
              <span className="text-[9px] bg-amber-600 text-white font-bold px-1.5 py-0.2 rounded animate-pulse">Active</span>
            ) : (
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-700">
              ₹{formatINR(globalSummary.totalBalance)}
            </div>
            <div className="text-[11px] text-amber-800 font-medium mt-0.5">
              {globalSummary.pctBalance}% of gross amount
            </div>
          </div>
        </div>

        {/* Card 3: Received Amount */}
        <div 
          onClick={() => setPaymentFilter(prev => prev === 'received' ? 'All' : 'received')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            paymentFilter === 'received'
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Click to filter orders with Collected / Received amount"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Received</span>
            {paymentFilter === 'received' ? (
              <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
            ) : (
              <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              ₹{formatINR(globalSummary.totalReceived)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              {globalSummary.pctReceived}% collected
            </div>
          </div>
        </div>

        {/* Card 4: Gross Order Value */}
        <div 
          onClick={resetFilters}
          className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all cursor-pointer hover:shadow-md"
          title="Click to reset filters and view full gross inventory"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Value</span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              ₹{formatINR(globalSummary.grossAmount)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Total invoiced value
            </div>
          </div>
        </div>

        {/* Card 5: Warehouse Charges */}
        <div 
          onClick={() => setPaymentFilter(prev => prev === 'warehouse' ? 'All' : 'warehouse')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            paymentFilter === 'warehouse'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-white border-slate-200/90 hover:border-rose-300'
          }`}
          title="Click to filter orders with Warehouse / Holding dues"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Warehouse Dues</span>
            {paymentFilter === 'warehouse' ? (
              <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
            ) : (
              <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-700">
              ₹{formatINR(globalSummary.totalWarehouseCharges)}
            </div>
            <div className="text-[11px] text-rose-700 font-medium mt-0.5">
              Holding charges accrued
            </div>
          </div>
        </div>

        {/* Card 6: Average Factory Days */}
        <div 
          onClick={() => setSelectedAgingStage(prev => prev === '61+ Days' ? 'All' : '61+ Days')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            selectedAgingStage === '61+ Days'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-white border-slate-200/90 hover:border-sky-300'
          }`}
          title="Click to filter Critical Overdue orders (>60 Days in Factory)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Aging</span>
            {selectedAgingStage === '61+ Days' ? (
              <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded">Overdue 61d+</span>
            ) : (
              <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-slate-900">
              {avgDays}
              <span className="text-xs font-sans text-slate-500 font-normal ml-1">days</span>
            </div>
            <div className="text-[11px] text-rose-700 font-bold mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{criticalOverdueCount} orders &gt;60d</span>
            </div>
          </div>
        </div>
      </div>

      {/* REAL-TIME ACTIVE DRILLDOWN SUMMARY BANNER */}
      {hasActiveFilters && (
        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-950 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-amber-900 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Active Filters:
            </span>
            {paymentFilter === 'due' && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                Balance Due: {filteredItems.length} orders (₹{formatINR(globalSummary.totalBalance)})
              </span>
            )}
            {paymentFilter === 'received' && (
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Collected Payments: {filteredItems.length} orders
              </span>
            )}
            {paymentFilter === 'warehouse' && (
              <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-full font-bold">
                Warehouse Dues (&gt; ₹0): {filteredItems.length} orders (₹{formatINR(globalSummary.totalWarehouseCharges)})
              </span>
            )}
            {selectedAgingStage !== 'All' && (
              <span className="bg-sky-100 text-sky-900 border border-sky-300 px-2 py-0.5 rounded-full font-bold">
                Aging Bracket: {selectedAgingStage}
              </span>
            )}
            {selectedSalesPerson !== 'All' && (
              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full font-bold">
                Salesperson: {selectedSalesPerson}
              </span>
            )}
            {selectedCreName !== 'All' && (
              <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                CRE: {selectedCreName}
              </span>
            )}
            {searchTerm && (
              <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">
                Search: "{searchTerm}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-900 font-bold rounded-lg border border-slate-300 transition cursor-pointer"
            >
              View {filteredItems.length} in Table →
            </button>
            <button
              onClick={resetFilters}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SUB-NAV VIEW SWITCHER & UNIVERSAL FILTERS BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Segmented View Mode Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit overflow-x-auto">
            <button
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                viewMode === 'summary'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Daily Operations Digest</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded-full border border-indigo-200">
                Summary
              </span>
            </button>

            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                viewMode === 'pipeline'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Aging Pipeline</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.2 rounded-full">
                5 Stages
              </span>
            </button>

            <button
              onClick={() => setViewMode('charts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'charts'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & Charts</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Executive Table</span>
            </button>
          </div>

          {/* Active Filter Count & Reset */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Showing <strong className="text-slate-900 font-bold">{filteredItems.length}</strong> of {items.length} orders</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1 bg-rose-50 rounded-lg border border-rose-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Universal Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search OPF, customer, model, remarks..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Salesperson Filter */}
          <div>
            <select
              value={selectedSalesPerson}
              onChange={e => setSelectedSalesPerson(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
            >
              <option value="All">All Salespersons ({salesPersons.length})</option>
              {salesPersons.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* CRE Name Filter */}
          <div>
            <select
              value={selectedCreName}
              onChange={e => setSelectedCreName(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
            >
              <option value="All">All CREs ({creNames.length})</option>
              {creNames.map(cre => (
                <option key={cre} value={cre}>{cre}</option>
              ))}
            </select>
          </div>

          {/* Aging Stage Filter */}
          <div>
            <select
              value={selectedAgingStage}
              onChange={e => setSelectedAgingStage(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
            >
              <option value="All">All Aging Stages</option>
              <option value="1 - 15 Days">1 - 15 Days (Fresh Ready)</option>
              <option value="16 - 30 Days">16 - 30 Days (Standard)</option>
              <option value="31 - 45 Days">31 - 45 Days (Moderate)</option>
              <option value="46 - 60 Days">46 - 60 Days (Aging Alert)</option>
              <option value="61+ Days">61+ Days (Critical Stagnant)</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
            >
              <option value="All">All Payment Statuses</option>
              <option value="pending">Full Balance Pending (0% paid)</option>
              <option value="partial">Partially Paid (&gt;0% paid)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN VIEW CONTENT AREA */}

      {/* VIEW 0: DAILY ENTERPRISE SUMMARY & OPERATIONS DIGEST */}
      {viewMode === 'summary' && (
        <DailyEnterpriseSummaryView onBackToDashboard={onBackToDashboard} />
      )}

      {/* VIEW 1: AGING PIPELINE (KANBAN STAGES FORMAT) */}
      {viewMode === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {PIPELINE_COLUMNS.map(col => {
              const colItems = pipelineGroups.get(col.id) || [];
              const totalUnits = colItems.reduce((acc, i) => acc + i.readyGoodsQty, 0);
              const totalBalance = colItems.reduce((acc, i) => acc + i.balancePayment, 0);
              const isColActive = selectedAgingStage === col.daysRange;

              return (
                <div 
                  key={col.id} 
                  className={`bg-slate-100/70 border rounded-2xl flex flex-col shadow-2xs overflow-hidden transition-all ${
                    isColActive 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                      : 'border-slate-200'
                  } ${col.headerBg}`}
                >
                  {/* Column Header */}
                  <div 
                    onClick={() => setSelectedAgingStage(prev => prev === col.daysRange ? 'All' : col.daysRange)}
                    className="p-3.5 bg-white border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition"
                    title={`Click to filter only ${col.daysRange} orders`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-black uppercase tracking-wider ${col.accentColor}`}>
                        {col.title}
                      </h3>
                      {isColActive ? (
                        <span className="text-[9px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                          Filtered
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {colItems.length} orders
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center justify-between">
                      <span>{col.daysRange}</span>
                      <span className="font-mono font-bold text-slate-900">{totalUnits} units</span>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50/70 px-2 py-0.5 rounded mt-1.5 border border-amber-200/60 flex items-center justify-between">
                      <span>Due:</span>
                      <span>₹{formatINR(totalBalance)}</span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="p-2.5 space-y-2.5 flex-1 max-h-[750px] overflow-y-auto">
                    {colItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                        No orders in this stage
                      </div>
                    ) : (
                      colItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedOrder(item)}
                          className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer space-y-2.5 group"
                        >
                          {/* Card Top: OPF & Days */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black font-mono bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 text-slate-900 px-2 py-0.5 rounded border border-slate-200 transition-colors">
                              {item.opfNo}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.daysInFactory > 60
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.daysInFactory > 30
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {item.daysInFactory} days
                            </span>
                          </div>

                          {/* Customer & Company */}
                          <div>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {item.customerName || 'Customer'}
                            </div>
                            {(item.companyName || item.location) && (
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                <span>{[item.companyName, item.location].filter(Boolean).join(' • ')}</span>
                              </div>
                            )}
                          </div>

                          {/* Model & Ready Qty */}
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 truncate pr-2 text-[11px]">
                              {item.modelOfRecliners || 'Standard Recliner'}
                            </span>
                            <span className="font-mono font-black text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded text-[11px] shrink-0">
                              {item.readyGoodsQty}u
                            </span>
                          </div>

                          {/* Financials & Payment Progress */}
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Balance Due:</span>
                              <span className="font-mono font-bold text-amber-700">
                                ₹{formatINR(item.balancePayment)}
                              </span>
                            </div>
                            {item.warehouseCharges > 0 && (
                              <div className="flex items-center justify-between text-[10px] text-rose-700 font-semibold">
                                <span>Warehouse:</span>
                                <span className="font-mono">₹{formatINR(item.warehouseCharges)}</span>
                              </div>
                            )}

                            {/* Tiny progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                              <div 
                                className="bg-emerald-500 h-full"
                                style={{
                                  width: `${item.grossAmount > 0 ? Math.min(100, Math.round((item.totalReceived / item.grossAmount) * 100)) : 0}%`
                                }}
                              />
                            </div>
                          </div>

                          {/* CRE Info & Remarks preview */}
                          {item.creCallingRemarks && (
                            <div className="text-[10px] text-slate-600 bg-amber-50/50 border border-amber-100 rounded-lg p-1.5 line-clamp-2 italic">
                              "{item.creCallingRemarks}"
                            </div>
                          )}

                          {/* Bottom Row */}
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="truncate">CRE: {item.creName || item.salesPerson || '-'}</span>
                            <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5">
                              View <ArrowUpRight className="w-2.5 h-2.5" />
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
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Aging Stage Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any bar bracket to filter data real-time
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-700">
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
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
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
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
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
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Aging Matrix & Financial Summary
              </h3>
              <span className="text-xs text-slate-500">Click any row to filter stage</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
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
                          isSelected ? 'bg-indigo-50/90 font-bold' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                          {row.dateRange}
                        </td>
                        <td className="p-3 text-right font-mono">{row.totalOrders}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">{row.readyGoodsQty}</td>
                        <td className="p-3 text-right font-mono">₹{formatINR(row.grossAmount)}</td>
                        <td className="p-3 text-right font-mono text-rose-700">₹{formatINR(row.warehouseCharges)}</td>
                        <td className="p-3 text-right font-mono text-indigo-700">₹{formatINR(row.totalReceived)}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700">₹{formatINR(row.balancePayment)}</td>
                        <td className="p-3 text-right font-mono">{row.pctBalancePayment}%</td>
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
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
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
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider select-none">
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
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-black text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {item.opfNo}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {formatDisplayDate(item.readyGoodsDate)}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.customerName || '-'}</div>
                        {(item.companyName || item.location) && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {[item.companyName, item.location].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700 font-medium max-w-xs truncate">
                        {item.modelOfRecliners || '-'}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap text-[11px]">
                        <div>SP: {item.salesPerson || '-'}</div>
                        <div className="text-slate-400">CRE: {item.creName || '-'}</div>
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-700">
                        {item.readyGoodsQty}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                        ₹{formatINR(item.balancePayment)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
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
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
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
                    <h3 className="text-base font-black font-mono tracking-tight">
                      OPF #{selectedOrder.opfNo}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Customer & Order Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Customer Name:</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedOrder.customerName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Company:</span>
                    <span className="font-bold text-slate-900">{selectedOrder.companyName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location:</span>
                    <span className="font-medium text-slate-700">{selectedOrder.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Model of Recliners:</span>
                    <span className="font-bold text-slate-900">{selectedOrder.modelOfRecliners || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ready Goods Quantity:</span>
                    <span className="font-mono font-black text-emerald-700 text-base">{selectedOrder.readyGoodsQty} Units</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Order Quantity:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedOrder.orderQty} Units</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Financial Status & Receivables
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Gross Amount</span>
                    <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.grossAmount)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">Received</span>
                    <span className="text-sm font-black font-mono text-emerald-800 mt-0.5 block">
                      ₹{formatINR(selectedOrder.totalReceived)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-800 uppercase block font-semibold">Balance Due</span>
                    <span className="text-sm font-black font-mono text-amber-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.balancePayment)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-[10px] text-rose-800 uppercase block font-semibold">Warehouse Dues</span>
                    <span className="text-sm font-black font-mono text-rose-900 mt-0.5 block">
                      ₹{formatINR(selectedOrder.warehouseCharges)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Balance Percentage:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedOrder.pctBalancePayment}</span>
                </div>
              </div>

              {/* Relationship & Calling Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
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
                    <span className="font-bold text-indigo-700">
                      {formatDisplayDate(selectedOrder.creNextFollowUpDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Follow-Up Count:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedOrder.noOfFollowUps} Calls</span>
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
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors"
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
                className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-xs"
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
