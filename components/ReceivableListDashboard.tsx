import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchReceivableListData,
  getCachedReceivables,
  calculateReceivableSummary,
  calculateGroupSummaries,
  calculateSalespersonSummaries,
  formatCurrency,
  formatINRInLakhsOrCrores,
  type ReceivableItem,
  type GroupSummaryItem,
  type SalespersonSummaryItem
} from '../services/receivableListService';
import { exportReceivablesToExcel } from '../utils/excelExport';
import {
  Search,
  RefreshCw,
  Filter,
  Download,
  ReceiptText,
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
  User,
  PhoneCall,
  BarChart3,
  PieChart,
  Table as TableIcon,
  Eye,
  ArrowUpDown,
  FileSpreadsheet,
  TrendingUp,
  Percent,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle
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

interface ReceivableListDashboardProps {
  onBackToDashboard?: () => void;
}

type TabMode = 'overview' | 'analytics' | 'table';

const GROUP_COLORS: Record<string, string> = {
  'Others': '#3b82f6',
  'VCS Group': '#f59e0b',
  'PVR': '#ec4899',
  'PHD': '#8b5cf6',
  'Cinepolis': '#10b981',
  'Cineline': '#06b6d4'
};

export const ReceivableListDashboard: React.FC<ReceivableListDashboardProps> = ({ onBackToDashboard }) => {
  const [items, setItems] = useState<ReceivableItem[]>(() => getCachedReceivables());
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active View Tab
  const [tabMode, setTabMode] = useState<TabMode>('overview');

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedCreSales, setSelectedCreSales] = useState<string>('All');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'due' | 'received'>('all');

  // Selected Item for Detail Modal
  const [selectedItem, setSelectedItem] = useState<ReceivableItem | null>(null);

  // Table Sorting & Pagination
  const [sortField, setSortField] = useState<keyof ReceivableItem>('balanceAmount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchReceivableListData(force);
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Unable to fetch live Receivable List data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Unique filter lists
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.group) set.add(i.group); });
    return Array.from(set).sort();
  }, [items]);

  const availableCreSales = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.creSales) set.add(i.creSales); });
    return Array.from(set).sort();
  }, [items]);

  const availableSalesPersons = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.salesPerson) set.add(i.salesPerson); });
    return Array.from(set).sort();
  }, [items]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.status) set.add(i.status); });
    return Array.from(set).sort();
  }, [items]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedGroup !== 'All' && item.group !== selectedGroup) return false;
      if (selectedCreSales !== 'All' && item.creSales !== selectedCreSales) return false;
      if (selectedSalesPerson !== 'All' && item.salesPerson !== selectedSalesPerson) return false;
      if (selectedStatus !== 'All' && item.status !== selectedStatus) return false;

      // Balance Filter
      if (balanceFilter === 'due' && item.balanceAmount <= 0) return false;
      if (balanceFilter === 'received' && item.receivedAmount <= 0 && item.balanceAmount > 0) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCust = (item.customerName || '').toLowerCase().includes(q);
        const matchOpf = (item.opfNo || '').toLowerCase().includes(q);
        const matchSp = (item.salesPerson || '').toLowerCase().includes(q);
        const matchInv = (item.invoiceNo || '').toLowerCase().includes(q);
        const matchRem = (item.remarks || '').toLowerCase().includes(q);
        const matchCreRem = (item.creRemarks || '').toLowerCase().includes(q);
        const matchGrp = (item.group || '').toLowerCase().includes(q);
        if (!matchCust && !matchOpf && !matchSp && !matchInv && !matchRem && !matchCreRem && !matchGrp) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedGroup, selectedCreSales, selectedSalesPerson, selectedStatus, balanceFilter, searchTerm]);

  // Overall & Filtered Metrics
  const overallSummary = useMemo(() => calculateReceivableSummary(items), [items]);
  const activeSummary = useMemo(() => calculateReceivableSummary(filteredItems), [filteredItems]);
  const groupSummaries = useMemo(() => calculateGroupSummaries(filteredItems), [filteredItems]);
  const salespersonSummaries = useMemo(() => calculateSalespersonSummaries(filteredItems), [filteredItems]);

  // Check if any filter is active
  const hasActiveFilters = selectedGroup !== 'All' || 
    selectedCreSales !== 'All' || 
    selectedSalesPerson !== 'All' || 
    selectedStatus !== 'All' || 
    balanceFilter !== 'all' || 
    searchTerm.trim().length > 0;

  // Sorted items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        const comp = (valA as string).localeCompare((valB as string) || '');
        return sortDirection === 'asc' ? comp : -comp;
      }
      if (typeof valA === 'number') {
        const comp = ((valA as number) || 0) - ((valB as number) || 0);
        return sortDirection === 'asc' ? comp : -comp;
      }
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (field: keyof ReceivableItem) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedGroup('All');
    setSelectedCreSales('All');
    setSelectedSalesPerson('All');
    setSelectedStatus('All');
    setBalanceFilter('all');
    setCurrentPage(1);
  };

  // Export Excel
  const handleExportExcel = () => {
    exportReceivablesToExcel(
      sortedItems.map(i => ({
        opfNo: i.opfNo || i.id,
        customerName: i.customerName,
        companyName: i.group || 'N/A',
        location: 'Pan India',
        salesPerson: i.salesPerson,
        creName: i.creSales,
        billAmount: i.invoiceAmount,
        receivedAmount: i.receivedAmount,
        balanceAmount: i.balanceAmount,
        daysOutstanding: 30,
        paymentStatus: i.status || 'Pending',
        lastFollowUpDate: i.newDueDate || i.dueDate,
        remarks: i.creRemarks || i.remarks || 'None'
      })),
      `Receivables_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* TOP HEADER & TITLE BAR (LIGHT REFINED THEME) */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-500/20">
              <ReceiptText className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                  Receivable List Dashboard
                </h1>
                <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  FMS Follow-Up
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                Live tracking of Invoice Amounts, Received Payments, Group Outstanding & CRE Daily Follow-Ups
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition border border-slate-300 flex items-center gap-1.5"
              >
                ← Back to Production Dashboard
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Export currently filtered list to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        {/* TOP KPI OVERVIEW METRICS (CLICKABLE FILTERS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-100">
          {/* Card 1: Total Invoice Amount */}
          <div 
            onClick={() => setBalanceFilter('all')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'all' && !hasActiveFilters
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/30'
                : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
            }`}
            title="Click to reset filters and view All Invoices"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Invoiced</span>
              {balanceFilter === 'all' && hasActiveFilters && (
                <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">Filtered</span>
              )}
            </div>
            <span className="text-xl md:text-2xl font-black font-mono text-slate-900 block mt-0.5">
              {formatINRInLakhsOrCrores(activeSummary.totalInvoiceAmount)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ₹{formatCurrency(activeSummary.totalInvoiceAmount)}
            </span>
          </div>

          {/* Card 2: Total Invoices Count */}
          <div 
            onClick={() => setBalanceFilter('all')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'all'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-amber-50/60 border-amber-200/80 hover:border-amber-300'
            }`}
            title="Click to view all invoice records"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Total Invoices</span>
              <span className="text-[9px] text-amber-700 font-bold">Click</span>
            </div>
            <span className="text-xl md:text-2xl font-black font-mono text-amber-950 block mt-0.5">
              {activeSummary.totalInvoices}
            </span>
            <span className="text-[10px] text-amber-700 font-mono">
              {activeSummary.totalInvoices === overallSummary.totalInvoices ? 'All records active' : `of ${overallSummary.totalInvoices} total`}
            </span>
          </div>

          {/* Card 3: Received Amount */}
          <div 
            onClick={() => setBalanceFilter(prev => prev === 'received' ? 'all' : 'received')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'received'
                ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-emerald-50/60 border-emerald-200/80 hover:border-emerald-300'
            }`}
            title="Click to filter orders with Collected / Received Payments"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">Received Amount</span>
              {balanceFilter === 'received' && (
                <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
            <span className="text-xl md:text-2xl font-black font-mono text-emerald-950 block mt-0.5">
              {formatINRInLakhsOrCrores(activeSummary.totalReceivedAmount)}
            </span>
            <span className="text-[10px] text-emerald-700 font-mono">
              ₹{formatCurrency(activeSummary.totalReceivedAmount)}
            </span>
          </div>

          {/* Card 4: % Received */}
          <div 
            onClick={() => setBalanceFilter(prev => prev === 'received' ? 'all' : 'received')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'received'
                ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-emerald-50/60 border-emerald-200/80 hover:border-emerald-300'
            }`}
            title="Click to filter Collection Rate"
          >
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">Collection Rate</span>
            <span className="text-xl md:text-2xl font-black font-mono text-emerald-950 block mt-0.5">
              {activeSummary.pctReceived}%
            </span>
            <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full" 
                style={{ width: `${Math.min(100, activeSummary.pctReceived)}%` }} 
              />
            </div>
          </div>

          {/* Card 5: Balance Amount (Priority Drill-Down) */}
          <div 
            onClick={() => setBalanceFilter(prev => prev === 'due' ? 'all' : 'due')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'due'
                ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-500/30 shadow-xs'
                : 'bg-rose-50/70 border-rose-200/80 hover:border-rose-300'
            }`}
            title="Click to filter orders with Pending Balance Due"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider block">Balance Due</span>
              {balanceFilter === 'due' ? (
                <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded animate-pulse">Active</span>
              ) : (
                <span className="text-[9px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.2 rounded">Click to Filter</span>
              )}
            </div>
            <span className="text-xl md:text-2xl font-black font-mono text-rose-950 block mt-0.5">
              {formatINRInLakhsOrCrores(activeSummary.totalBalanceAmount)}
            </span>
            <span className="text-[10px] text-rose-700 font-mono">
              ₹{formatCurrency(activeSummary.totalBalanceAmount)}
            </span>
          </div>

          {/* Card 6: % Balance */}
          <div 
            onClick={() => setBalanceFilter(prev => prev === 'due' ? 'all' : 'due')}
            className={`rounded-xl p-3.5 border transition-all cursor-pointer hover:shadow-md ${
              balanceFilter === 'due'
                ? 'bg-rose-100 border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-rose-50/70 border-rose-200/80 hover:border-rose-300'
            }`}
            title="Click to filter Outstanding Balances"
          >
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider block">% Balance Due</span>
            <span className="text-xl md:text-2xl font-black font-mono text-rose-950 block mt-0.5">
              {activeSummary.pctBalance}%
            </span>
            <div className="w-full bg-rose-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-rose-600 h-full rounded-full" 
                style={{ width: `${Math.min(100, activeSummary.pctBalance)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* REAL-TIME DRILL-DOWN SUMMARY BANNER */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-950 animate-fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-amber-900 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Active Filter Applied:
              </span>
              {balanceFilter === 'due' && (
                <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-full font-bold">
                  Balance Due (&gt; ₹0): {filteredItems.length} orders (₹{formatINRInLakhsOrCrores(activeSummary.totalBalanceAmount)})
                </span>
              )}
              {balanceFilter === 'received' && (
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  Settled / Received: {filteredItems.length} orders
                </span>
              )}
              {selectedGroup !== 'All' && (
                <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  Group: {selectedGroup}
                </span>
              )}
              {selectedSalesPerson !== 'All' && (
                <span className="bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full font-bold">
                  Salesperson: {selectedSalesPerson}
                </span>
              )}
              {selectedCreSales !== 'All' && (
                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                  CRE: {selectedCreSales}
                </span>
              )}
              {selectedStatus !== 'All' && (
                <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">
                  Status: {selectedStatus}
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
                onClick={() => setTabMode('table')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-900 font-bold rounded-lg border border-slate-300 transition"
              >
                View {filteredItems.length} in Table →
              </button>
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION TABS & FILTER TOOLBAR */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTabMode('overview')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                tabMode === 'overview'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview & Group FMS</span>
            </button>

            <button
              onClick={() => setTabMode('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                tabMode === 'analytics'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics & Charts</span>
            </button>

            <button
              onClick={() => setTabMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                tabMode === 'table'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>All Invoices Table</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {filteredItems.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search Customer, OPF, Invoice #, Salesperson, Remarks..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Group Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => { setSelectedGroup(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Groups ({items.length})</option>
              {availableGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* CRE / Sales Follow-Up Person Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CRE / Sales</label>
            <select
              value={selectedCreSales}
              onChange={(e) => { setSelectedCreSales(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All CRE / Sales</option>
              {availableCreSales.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Salesperson Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sales Person</label>
            <select
              value={selectedSalesPerson}
              onChange={(e) => { setSelectedSalesPerson(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Sales Persons</option>
              {availableSalesPersons.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Statuses</option>
              {availableStatuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-1.5 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md transition flex items-center justify-center gap-1 border border-slate-300"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER IF ANY */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* TAB 1: OVERVIEW & GROUP FMS */}
      {tabMode === 'overview' && (
        <div className="space-y-6">
          {/* GROUP SUMMARY BREAKDOWN & CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Group Summary Table */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Group Breakdown & Balances</h2>
                    <p className="text-[11px] text-slate-500">Breakdown across key customer account groups</p>
                  </div>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200">
                  {groupSummaries.length} Groups
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-2.5 px-3">Group</th>
                      <th className="py-2.5 px-3 text-right">Invoices</th>
                      <th className="py-2.5 px-3 text-right">Invoice Amount</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 px-3 text-right">% of Total Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupSummaries.map((grp) => {
                      const isSelected = selectedGroup === grp.group;
                      return (
                        <tr 
                          key={grp.group}
                          onClick={() => setSelectedGroup(isSelected ? 'All' : grp.group)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50/80 font-bold text-indigo-950' 
                              : 'hover:bg-slate-50/80 text-slate-700'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: GROUP_COLORS[grp.group] || '#64748b' }} 
                            />
                            <span>{grp.group}</span>
                            {isSelected && <span className="text-[10px] text-indigo-600 font-mono">(Active Filter)</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{grp.count}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">₹{formatCurrency(grp.invoiceAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">₹{formatCurrency(grp.receivedAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">₹{formatCurrency(grp.balanceAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                              {grp.pctBalanceAmount}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                      <td className="py-2.5 px-3">Grand Total</td>
                      <td className="py-2.5 px-3 text-right font-mono">{activeSummary.totalInvoices}</td>
                      <td className="py-2.5 px-3 text-right font-mono">₹{formatCurrency(activeSummary.totalInvoiceAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400">₹{formatCurrency(activeSummary.totalReceivedAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300">₹{formatCurrency(activeSummary.totalBalanceAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Right 1 Col: Balance Distribution Chart */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Balance Share</h2>
                    <p className="text-[11px] text-slate-500">Click slice to filter by Group</p>
                  </div>
                </div>
                {selectedGroup !== 'All' && (
                  <button
                    onClick={() => setSelectedGroup('All')}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Clear Group Filter
                  </button>
                )}
              </div>

              <div className="h-56 w-full flex items-center justify-center cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={groupSummaries}
                      dataKey="balanceAmount"
                      nameKey="group"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={2}
                      onClick={(entry: any) => {
                        if (entry && entry.group) {
                          setSelectedGroup(selectedGroup === entry.group ? 'All' : entry.group);
                          setCurrentPage(1);
                        }
                      }}
                    >
                      {groupSummaries.map((entry) => (
                        <Cell 
                          key={`cell-${entry.group}`} 
                          fill={GROUP_COLORS[entry.group] || '#64748b'} 
                          stroke={selectedGroup === entry.group ? '#000' : '#fff'}
                          strokeWidth={selectedGroup === entry.group ? 2 : 1}
                          className="cursor-pointer hover:opacity-80 transition"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => [`₹${formatCurrency(val)}`, 'Balance Due (Click to filter)']}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with direct filter triggers */}
              <div className="space-y-1.5 text-xs">
                {groupSummaries.map(g => (
                  <div 
                    key={g.group} 
                    onClick={() => { setSelectedGroup(selectedGroup === g.group ? 'All' : g.group); setCurrentPage(1); }}
                    className={`flex items-center justify-between cursor-pointer p-1.5 rounded-lg transition ${
                      selectedGroup === g.group ? 'bg-indigo-50 font-bold border border-indigo-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[g.group] || '#64748b' }} />
                      <span className="font-medium text-slate-700">{g.group}</span>
                      {selectedGroup === g.group && <span className="text-[10px] text-indigo-600 font-mono">✓</span>}
                    </div>
                    <span className="font-mono font-bold text-slate-900">₹{formatINRInLakhsOrCrores(g.balanceAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TOP 5 HIGH BALANCE INVOICES CALLOUT */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-red-700 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Highest Outstanding Receivables</h2>
                  <p className="text-[11px] text-slate-500">Top invoices requiring priority collection follow-up</p>
                </div>
              </div>
              <button
                onClick={() => setTabMode('table')}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
              >
                View All {sortedItems.length} Invoices →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedItems.slice(0, 6).map((inv) => (
                <div
                  key={inv.id + inv.sNo}
                  onClick={() => setSelectedItem(inv)}
                  className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg p-3.5 space-y-2 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 line-clamp-1">{inv.customerName}</span>
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded shrink-0">
                      S.No {inv.sNo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-mono">OPF: {inv.opfNo}</span>
                    <span className="font-semibold text-indigo-700">{inv.group}</span>
                  </div>

                  <div className="bg-white rounded p-2 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">Balance Due</span>
                      <span className="text-sm font-black font-mono text-red-700">
                        ₹{formatCurrency(inv.balanceAmount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">Invoice Amt</span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        ₹{formatCurrency(inv.invoiceAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>CRE: {inv.creSales || 'Unassigned'}</span>
                    {inv.dueDate && <span>Due: {inv.dueDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS & CHARTS */}
      {tabMode === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Salesperson Receivables */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Salesperson Outstanding</h2>
                    <p className="text-[11px] text-slate-500">Click bar to filter by Salesperson</p>
                  </div>
                </div>
                {selectedSalesPerson !== 'All' && (
                  <button
                    onClick={() => setSelectedSalesPerson('All')}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Clear Filter ({selectedSalesPerson})
                  </button>
                )}
              </div>

              <div className="h-72 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={salespersonSummaries.slice(0, 8)} 
                    margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const person = state.activePayload[0].payload.salesPerson;
                        if (person) {
                          setSelectedSalesPerson(selectedSalesPerson === person ? 'All' : person);
                          setCurrentPage(1);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="salesPerson" 
                      angle={-25} 
                      textAnchor="end" 
                      tick={{ fontSize: 10, fill: '#475569' }} 
                      height={40}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#475569' }}
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    />
                    <Tooltip 
                      formatter={(val: number) => [`₹${formatCurrency(val)}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="receivedAmount" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="balanceAmount" name="Balance Due" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Group Invoice vs Balance */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Group Invoiced vs Received</h2>
                    <p className="text-[11px] text-slate-500">Click bar to filter by Customer Group</p>
                  </div>
                </div>
                {selectedGroup !== 'All' && (
                  <button
                    onClick={() => setSelectedGroup('All')}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Clear Filter ({selectedGroup})
                  </button>
                )}
              </div>

              <div className="h-72 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={groupSummaries} 
                    margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const grp = state.activePayload[0].payload.group;
                        if (grp) {
                          setSelectedGroup(selectedGroup === grp ? 'All' : grp);
                          setCurrentPage(1);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="group" 
                      tick={{ fontSize: 11, fill: '#475569' }} 
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#475569' }}
                      tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`}
                    />
                    <Tooltip 
                      formatter={(val: number) => [`₹${formatCurrency(val)}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="invoiceAmount" name="Total Invoiced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="receivedAmount" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="balanceAmount" name="Balance Due" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALL INVOICES DATA TABLE */}
      {tabMode === 'table' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-indigo-700" />
              <span className="text-sm font-bold text-slate-900">
                Receivables Invoices Ledger
              </span>
              <span className="text-xs bg-indigo-100 text-indigo-800 font-mono font-bold px-2 py-0.5 rounded">
                Showing {paginatedItems.length} of {sortedItems.length}
              </span>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-800"
              >
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <th 
                    onClick={() => handleSort('sNo')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition text-center w-12"
                  >
                    #
                  </th>
                  <th 
                    onClick={() => handleSort('customerName')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('opfNo')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Order / OPF
                  </th>
                  <th 
                    onClick={() => handleSort('salesPerson')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Sales Person
                  </th>
                  <th 
                    onClick={() => handleSort('invoiceDate')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Invoice Date
                  </th>
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th 
                    onClick={() => handleSort('invoiceAmount')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition"
                  >
                    Invoice Amt
                  </th>
                  <th 
                    onClick={() => handleSort('receivedAmount')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition text-emerald-700"
                  >
                    Received
                  </th>
                  <th 
                    onClick={() => handleSort('balanceAmount')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 transition text-amber-700"
                  >
                    Balance Due
                  </th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">CRE / Sales</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-500 font-medium">
                      No receivable records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr 
                      key={item.id + item.sNo}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                        {item.sNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title={item.customerName}>
                        {item.customerName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {item.opfNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {item.salesPerson}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {item.invoiceDate}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 max-w-[140px] truncate" title={item.invoiceNo}>
                        {item.invoiceNo}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                        ₹{formatCurrency(item.invoiceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 whitespace-nowrap font-medium">
                        {item.receivedAmount > 0 ? `₹${formatCurrency(item.receivedAmount)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-800 whitespace-nowrap">
                        ₹{formatCurrency(item.balanceAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span 
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: `${GROUP_COLORS[item.group] || '#64748b'}20`,
                            color: GROUP_COLORS[item.group] || '#334155'
                          }}
                        >
                          {item.group}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {item.creSales}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate text-[11px]" title={item.remarks}>
                        {item.remarks || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {item.formLink ? (
                          <a
                            href={item.formLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold transition border border-indigo-200"
                            title="Open FMS Google Form to log follow-up"
                          >
                            <span>Form</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
              <span className="text-slate-600">
                Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded font-medium disabled:opacity-40 hover:bg-slate-100 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded font-medium disabled:opacity-40 hover:bg-slate-100 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL FOR SELECTED INVOICE */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-scale-up">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 rounded-t-2xl flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400">S.No #{selectedItem.sNo}</span>
                <h3 className="text-lg font-black text-white mt-0.5">{selectedItem.customerName}</h3>
                <p className="text-xs text-slate-300 font-mono">OPF: {selectedItem.opfNo}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 text-xs text-slate-700">
              {/* Key Financial Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Invoice Amount</span>
                  <span className="text-base font-black font-mono text-slate-900 block mt-0.5">
                    ₹{formatCurrency(selectedItem.invoiceAmount)}
                  </span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase">Received</span>
                  <span className="text-base font-black font-mono text-emerald-800 block mt-0.5">
                    ₹{formatCurrency(selectedItem.receivedAmount)}
                  </span>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 text-center">
                  <span className="text-[10px] text-amber-800 font-bold block uppercase">Balance Due</span>
                  <span className="text-base font-black font-mono text-amber-900 block mt-0.5">
                    ₹{formatCurrency(selectedItem.balanceAmount)}
                  </span>
                </div>
              </div>

              {/* Order & Billing Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Sales Person</span>
                  <span className="font-semibold text-slate-800 text-xs">{selectedItem.salesPerson || '-'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Group</span>
                  <span className="font-semibold text-indigo-700 text-xs">{selectedItem.group || '-'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Invoice Date</span>
                  <span className="font-mono text-slate-800 text-xs">{selectedItem.invoiceDate || '-'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Due Date</span>
                  <span className="font-mono text-slate-800 text-xs">{selectedItem.dueDate || '-'}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Invoice Number(s)</span>
                  <span className="font-mono text-slate-800 text-xs break-all">{selectedItem.invoiceNo || '-'}</span>
                </div>
              </div>

              {/* Follow-Up & Remarks */}
              <div className="space-y-3">
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">CRE / Sales Follow-Up</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-950">Follow-Up By: {selectedItem.creSales || 'Not Assigned'}</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-800">
                      Status: {selectedItem.status || 'Pending'}
                    </span>
                  </div>
                  {selectedItem.creRemarks && (
                    <p className="mt-2 text-indigo-900 text-xs font-medium bg-white p-2.5 rounded border border-indigo-100">
                      {selectedItem.creRemarks}
                    </p>
                  )}
                </div>

                {selectedItem.remarks && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">General Remarks</span>
                    <p className="text-slate-800 text-xs">{selectedItem.remarks}</p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs"
                >
                  Close
                </button>
                {selectedItem.formLink && (
                  <a
                    href={selectedItem.formLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Open Follow-Up Google Form</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceivableListDashboard;
