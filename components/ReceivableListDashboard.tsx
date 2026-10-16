import React, { useState, useEffect, useMemo } from 'react';
import { formatInrCompact, titleCase } from '../utils/format';
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
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Receivables</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeSummary.totalInvoices} invoices · {activeSummary.pctReceived}% collected
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Key numbers (tap to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { key: 'due', label: 'Still to collect', value: formatInrCompact(activeSummary.totalBalanceAmount), sub: `${activeSummary.pctBalance}% of invoiced`, active: balanceFilter === 'due', onClick: () => setBalanceFilter(balanceFilter === 'due' ? 'all' : 'due') },
          { key: 'inv', label: 'Invoiced', value: formatInrCompact(activeSummary.totalInvoiceAmount), sub: `${activeSummary.totalInvoices} invoices`, active: false, onClick: () => { setBalanceFilter('all'); } },
          { key: 'rec', label: 'Collected', value: formatInrCompact(activeSummary.totalReceivedAmount), sub: `${activeSummary.pctReceived}% of invoiced`, active: balanceFilter === 'received', onClick: () => setBalanceFilter(balanceFilter === 'received' ? 'all' : 'received') },
          { key: 'rate', label: 'Collection rate', value: `${activeSummary.pctReceived}%`, sub: `${activeSummary.pctBalance}% outstanding`, active: false, onClick: () => setBalanceFilter('all') },
        ].map(c => (
          <button
            key={c.key}
            onClick={c.onClick}
            className={`text-left bg-white rounded-2xl border px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer ${
              c.active ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/80'
            }`}
          >
            <div className="text-[13px] font-medium text-slate-500">{c.label}</div>
            <div className="mt-2 text-2xl sm:text-3xl whitespace-nowrap font-semibold tracking-tight text-slate-900 tabular-nums">{c.value}</div>
            <div className="mt-1 text-xs text-slate-400">{c.sub}</div>
          </button>
        ))}
      </div>

      {/* Tabs and filters */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {([
              { id: 'overview', label: 'Overview' },
              { id: 'table', label: 'All invoices' },
              { id: 'analytics', label: 'Charts' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTabMode(t.id)}
                className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  tabMode === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-3">
            <span>{filteredItems.length} of {items.length} invoices</span>
            {(hasActiveFilters || balanceFilter !== 'all') && (
              <button onClick={handleResetFilters} className="flex items-center gap-1 font-medium text-rose-600 hover:text-rose-700 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search customer or invoice"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => { setSelectedGroup(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All groups</option>
            {availableGroups.map(g => (<option key={g} value={g}>{g}</option>))}
          </select>
          <select
            value={selectedSalesPerson}
            onChange={(e) => { setSelectedSalesPerson(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All salespeople</option>
            {availableSalesPersons.map(sp => (<option key={sp} value={sp}>{sp}</option>))}
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
              value={selectedCreSales}
              onChange={(e) => { setSelectedCreSales(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All follow-up owners</option>
              {availableCreSales.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">Any status</option>
              {availableStatuses.map(st => (<option key={st} value={st}>{st}</option>))}
            </select>
          </div>
        )}
      </div>

      {/* ERROR BANNER IF ANY */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline font-semibold">Retry</button>
        </div>
      )}

      {/* Overview */}
      {tabMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-semibold text-slate-900">By customer group</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Tap a group to filter</p>
            <ul className="mt-4 divide-y divide-slate-100">
              {groupSummaries.map((grp) => {
                const isSelected = selectedGroup === grp.group;
                return (
                  <li
                    key={grp.group}
                    onClick={() => setSelectedGroup(isSelected ? 'All' : grp.group)}
                    className={`py-3 px-2 -mx-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800">{grp.group}</span>
                      <span className="text-sm tabular-nums text-slate-600">
                        <span className="font-semibold text-slate-900">{formatInrCompact(grp.balanceAmount)}</span>
                        <span className="text-slate-400"> · {grp.count} invoices</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500/80" style={{ width: `${Math.min(100, grp.pctBalanceAmount)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900">Largest balances</h2>
              <button onClick={() => setTabMode('table')} className="text-[13px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
                See all
              </button>
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {sortedItems.slice(0, 6).map((inv) => (
                <li
                  key={inv.id + inv.sNo}
                  onClick={() => setSelectedItem(inv)}
                  className="py-3 flex items-baseline justify-between gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{titleCase(inv.customerName)}</span>
                    <span className="block text-xs text-slate-400 truncate">{inv.dueDate ? `Due ${inv.dueDate}` : inv.opfNo}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatInrCompact(inv.balanceAmount)}</span>
                </li>
              ))}
            </ul>
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
                    <h2 className="text-sm font-semibold text-slate-900">Salesperson Outstanding</h2>
                    <p className="text-xs text-slate-500">Click bar to filter by Salesperson</p>
                  </div>
                </div>
                {selectedSalesPerson !== 'All' && (
                  <button
                    onClick={() => setSelectedSalesPerson('All')}
                    className="text-xs font-semibold text-rose-600 hover:underline"
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
                    <h2 className="text-sm font-semibold text-slate-900">Group Invoiced vs Received</h2>
                    <p className="text-xs text-slate-500">Click bar to filter by Customer Group</p>
                  </div>
                </div>
                {selectedGroup !== 'All' && (
                  <button
                    onClick={() => setSelectedGroup('All')}
                    className="text-xs font-semibold text-rose-600 hover:underline"
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
              <span className="text-sm font-semibold text-slate-900">
                Receivables Invoices Ledger
              </span>
              <span className="text-xs bg-indigo-100 text-indigo-800 tabular-nums font-semibold px-2 py-0.5 rounded">
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
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
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
                      <td className="py-2.5 px-3 text-center tabular-nums font-semibold text-slate-500">
                        {item.sNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title={item.customerName}>
                        {item.customerName}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-slate-600">
                        {item.opfNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {item.salesPerson}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-slate-600 whitespace-nowrap">
                        {item.invoiceDate}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-slate-600 max-w-[140px] truncate" title={item.invoiceNo}>
                        {item.invoiceNo}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">
                        ₹{formatCurrency(item.invoiceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 whitespace-nowrap font-medium">
                        {item.receivedAmount > 0 ? `₹${formatCurrency(item.receivedAmount)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-amber-800 whitespace-nowrap">
                        ₹{formatCurrency(item.balanceAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-semibold"
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
                      <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate text-xs" title={item.remarks}>
                        {item.remarks || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {item.formLink ? (
                          <a
                            href={item.formLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold transition border border-indigo-200"
                            title="Open FMS Google Form to log follow-up"
                          >
                            <span>Form</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
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
                Page <span className="font-semibold text-slate-900">{currentPage}</span> of <span className="font-semibold text-slate-900">{totalPages}</span>
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
                <span className="text-xs tabular-nums font-semibold text-amber-400">S.No #{selectedItem.sNo}</span>
                <h3 className="text-lg font-semibold text-white mt-0.5">{selectedItem.customerName}</h3>
                <p className="text-xs text-slate-300 tabular-nums">OPF: {selectedItem.opfNo}</p>
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
                  <span className="text-xs text-slate-500 font-semibold block">Invoice Amount</span>
                  <span className="text-base font-semibold tabular-nums text-slate-900 block mt-0.5">
                    ₹{formatCurrency(selectedItem.invoiceAmount)}
                  </span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <span className="text-xs text-emerald-700 font-semibold block">Received</span>
                  <span className="text-base font-semibold tabular-nums text-emerald-800 block mt-0.5">
                    ₹{formatCurrency(selectedItem.receivedAmount)}
                  </span>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 text-center">
                  <span className="text-xs text-amber-800 font-semibold block">Balance Due</span>
                  <span className="text-base font-semibold tabular-nums text-amber-900 block mt-0.5">
                    ₹{formatCurrency(selectedItem.balanceAmount)}
                  </span>
                </div>
              </div>

              {/* Order & Billing Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Sales Person</span>
                  <span className="font-semibold text-slate-800 text-xs">{selectedItem.salesPerson || '-'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Group</span>
                  <span className="font-semibold text-indigo-700 text-xs">{selectedItem.group || '-'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Invoice Date</span>
                  <span className="tabular-nums text-slate-800 text-xs">{selectedItem.invoiceDate || '-'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Due Date</span>
                  <span className="tabular-nums text-slate-800 text-xs">{selectedItem.dueDate || '-'}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-xs text-slate-400 block font-semibold">Invoice Number(s)</span>
                  <span className="tabular-nums text-slate-800 text-xs break-all">{selectedItem.invoiceNo || '-'}</span>
                </div>
              </div>

              {/* Follow-Up & Remarks */}
              <div className="space-y-3">
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                  <span className="text-xs font-semibold text-indigo-900 block mb-1">CRE / Sales Follow-Up</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-950">Follow-Up By: {selectedItem.creSales || 'Not Assigned'}</span>
                    <span className="tabular-nums bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-800">
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
                    <span className="text-xs font-semibold text-slate-500 block mb-1">General Remarks</span>
                    <p className="text-slate-800 text-xs">{selectedItem.remarks}</p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs"
                >
                  Close
                </button>
                {selectedItem.formLink && (
                  <a
                    href={selectedItem.formLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition text-xs flex items-center gap-1.5 shadow-xs"
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
