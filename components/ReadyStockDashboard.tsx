import React, { useState, useEffect, useMemo } from 'react';
import { titleCase } from '../utils/format';
import {
  fetchReadyStockData,
  getCachedReadyStock,
  calculateReadyStockSummary,
  calculateModelDistribution,
  calculateUpholsteryDistribution,
  type ReadyStockItem
} from '../services/readyStockService';
import { exportReadyStockToExcel } from '../utils/excelExport';
import {
  Search,
  RefreshCw,
  Download,
  Armchair,
  Sparkles,
  ExternalLink,
  Layers,
  AlertCircle,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  BarChart3,
  PieChart,
  Eye,
  ArrowUpDown,
  Tag,
  Palette,
  Maximize2,
  Zap,
  Check,
  Building2,
  PackageCheck
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

interface ReadyStockDashboardProps {
  onBackToDashboard?: () => void;
}

type TabMode = 'catalog' | 'analytics' | 'table';

const MODEL_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#84cc16',
  '#e11d48', '#d946ef', '#0ea5e9', '#64748b', '#a855f7'
];

const UPHOLSTERY_COLORS: Record<string, string> = {
  'PREMIUM FABRIC': '#3b82f6',
  'LEATHERETTE': '#f59e0b',
  'LEATHER': '#10b981',
  'OTHER': '#94a3b8'
};

export const ReadyStockDashboard: React.FC<ReadyStockDashboardProps> = ({ onBackToDashboard }) => {
  const [items, setItems] = useState<ReadyStockItem[]>(() => getCachedReadyStock());
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active View Tab
  const [tabMode, setTabMode] = useState<TabMode>('catalog');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('All');
  const [selectedFunctionality, setSelectedFunctionality] = useState<string>('All');
  const [selectedUpholsteryType, setSelectedUpholsteryType] = useState<string>('All');

  // Selected Stock Item for Detail Modal
  const [selectedItem, setSelectedItem] = useState<ReadyStockItem | null>(null);

  // Table Sorting & Pagination
  const [sortField, setSortField] = useState<keyof ReadyStockItem>('qty');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchReadyStockData(force);
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Unable to fetch live Ready Stock sheet data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Filter Dropdown Options
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.model) set.add(i.model.trim().toUpperCase()); });
    return Array.from(set).sort();
  }, [items]);

  const availableFunctionalities = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.functionality) set.add(i.functionality.trim()); });
    return Array.from(set).sort();
  }, [items]);

  const availableUpholsteryTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.upholsteryType) set.add(i.upholsteryType.trim().toUpperCase()); });
    return Array.from(set).sort();
  }, [items]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedModel !== 'All' && item.model.trim().toUpperCase() !== selectedModel.toUpperCase()) return false;
      
      if (selectedFunctionality !== 'All') {
        const itemFunc = (item.functionality || '').toUpperCase();
        if (selectedFunctionality === 'MOTORIZED') {
          if (!itemFunc.includes('MOTOR')) return false;
        } else if (selectedFunctionality === 'MANUAL') {
          if (!itemFunc.includes('MANUAL')) return false;
        } else if (item.functionality.trim() !== selectedFunctionality) {
          return false;
        }
      }

      if (selectedUpholsteryType !== 'All' && item.upholsteryType.trim().toUpperCase() !== selectedUpholsteryType.toUpperCase()) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchModel = (item.model || '').toLowerCase().includes(q);
        const matchCode = (item.code || '').toLowerCase().includes(q);
        const matchFunc = (item.functionality || '').toLowerCase().includes(q);
        const matchUphType = (item.upholsteryType || '').toLowerCase().includes(q);
        const matchUphCode = (item.upholsteryCode || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchDim = (item.dimensions || '').toLowerCase().includes(q);
        if (!matchModel && !matchCode && !matchFunc && !matchUphType && !matchUphCode && !matchDesc && !matchDim) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedModel, selectedFunctionality, selectedUpholsteryType, searchTerm]);

  // Summaries
  const overallSummary = useMemo(() => calculateReadyStockSummary(items), [items]);
  const activeSummary = useMemo(() => calculateReadyStockSummary(filteredItems), [filteredItems]);
  const modelDistribution = useMemo(() => calculateModelDistribution(filteredItems), [filteredItems]);
  const upholsteryDistribution = useMemo(() => calculateUpholsteryDistribution(filteredItems), [filteredItems]);

  const hasActiveFilters = searchTerm !== '' || 
    selectedModel !== 'All' || 
    selectedFunctionality !== 'All' || 
    selectedUpholsteryType !== 'All';

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

  const handleSort = (field: keyof ReadyStockItem) => {
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
    setSelectedModel('All');
    setSelectedFunctionality('All');
    setSelectedUpholsteryType('All');
    setCurrentPage(1);
  };

  // Export Excel
  const handleExportExcel = () => {
    exportReadyStockToExcel(
      sortedItems.map(i => ({
        stockId: i.code || `STK-${i.srNo}`,
        modelName: i.model,
        upholstery: `${i.upholsteryType} - ${i.upholsteryCode}`,
        qty: i.qty,
        category: i.functionality,
        location: 'Manesar Warehouse',
        date: 'Immediate Available',
        remarks: i.description || i.dimensions || 'Available for immediate sales purpose'
      })),
      `Ready_Stock_Factory_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Ready stock</h1>
          <p className="mt-1 text-sm text-slate-500">Finished chairs available to sell right now</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { key: 'all', label: 'Chairs in stock', value: `${activeSummary.totalUnits}`, sub: `${activeSummary.totalItems} configurations`, active: false, onClick: handleResetFilters },
          { key: 'models', label: 'Models', value: `${activeSummary.totalModels}`, sub: 'see breakdown', active: false, onClick: () => setTabMode('analytics') },
          { key: 'motor', label: 'Motorised', value: `${activeSummary.motorisedUnits}`, sub: `${activeSummary.totalUnits ? Math.round((activeSummary.motorisedUnits / activeSummary.totalUnits) * 100) : 0}% of stock`, active: selectedFunctionality === 'MOTORIZED', onClick: () => setSelectedFunctionality(prev => (prev === 'MOTORIZED' ? 'All' : 'MOTORIZED')) },
          { key: 'manual', label: 'Manual', value: `${activeSummary.manualUnits}`, sub: `${activeSummary.totalUnits ? Math.round((activeSummary.manualUnits / activeSummary.totalUnits) * 100) : 0}% of stock`, active: selectedFunctionality === 'MANUAL', onClick: () => setSelectedFunctionality(prev => (prev === 'MANUAL' ? 'All' : 'MANUAL')) },
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
              { id: 'catalog', label: 'Catalogue' },
              { id: 'table', label: 'List' },
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
            <span>{filteredItems.length} of {items.length} configurations</span>
            {hasActiveFilters && (
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
              placeholder="Search model, colour or material"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={selectedModel}
            onChange={(e) => { setSelectedModel(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All models</option>
            {availableModels.map(m => (<option key={m} value={m}>{m}</option>))}
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
              value={selectedFunctionality}
              onChange={(e) => { setSelectedFunctionality(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">Any mechanism</option>
              {availableFunctionalities.map(f => (<option key={f} value={f}>{f}</option>))}
            </select>
            <select
              value={selectedUpholsteryType}
              onChange={(e) => { setSelectedUpholsteryType(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">Any material</option>
              {availableUpholsteryTypes.map(u => (<option key={u} value={u}>{u}</option>))}
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

      {/* Catalogue */}
      {tabMode === 'catalog' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={`${item.srNo}-${item.code}`}
              onClick={() => setSelectedItem(item)}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all p-4 cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900 leading-snug">{titleCase(item.model)}</h3>
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
                  {item.qty} {item.qty === 1 ? 'chair' : 'chairs'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 truncate">{titleCase(item.functionality)}</p>
              <p className="mt-3 text-sm text-slate-700 truncate">
                {titleCase([item.upholsteryType, item.upholsteryCode].filter(Boolean).join(' · ')) || '—'}
              </p>
              {item.photos && (
                <a
                  href={item.photos}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:text-indigo-800 self-start"
                >
                  <span>Photos</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: MODEL & UPHOLSTERY ANALYTICS */}
      {tabMode === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Model Distribution Bar Chart */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                    <Armchair className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Stock by Recliner Model</h2>
                    <p className="text-xs text-slate-500">Available finished units by model</p>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={modelDistribution.slice(0, 8)} 
                    margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedModel = state.activePayload[0].payload.model;
                        setSelectedModel(prev => prev === clickedModel ? 'All' : clickedModel);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="model" 
                      angle={-25} 
                      textAnchor="end" 
                      tick={{ fontSize: 10, fill: '#475569' }} 
                      height={40}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#475569' }}
                    />
                    <Tooltip 
                      formatter={(val: number) => [`${val} Units (Click to filter)`, 'Ready Stock']}
                    />
                    <Bar dataKey="units" name="Units Available" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                      {modelDistribution.slice(0, 8).map((entry, idx) => {
                        const isSelected = selectedModel === entry.model;
                        return (
                          <Cell 
                            key={`cell-${idx}`} 
                            fill={isSelected ? '#d97706' : MODEL_COLORS[idx % MODEL_COLORS.length]} 
                            stroke={isSelected ? '#78350f' : undefined}
                            strokeWidth={isSelected ? 2 : 0}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Upholstery Distribution Donut */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Upholstery Material Split</h2>
                    <p className="text-xs text-slate-500">Share of Leatherette, Premium Fabric & Leather (Click to filter)</p>
                  </div>
                </div>
              </div>

              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={upholsteryDistribution}
                      dataKey="units"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={3}
                      onClick={(entry: any) => {
                        if (entry && entry.type) {
                          setSelectedUpholsteryType(prev => prev === entry.type ? 'All' : entry.type);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {upholsteryDistribution.map((entry) => {
                        const isSelected = selectedUpholsteryType === entry.type;
                        return (
                          <Cell 
                            key={`uph-${entry.type}`} 
                            fill={UPHOLSTERY_COLORS[entry.type] || '#64748b'} 
                            stroke={isSelected ? '#1e1b4b' : '#ffffff'}
                            strokeWidth={isSelected ? 3 : 1}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => [`${val} Units (Click to filter)`, 'Ready Stock']}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with interactive triggers */}
              <div className="space-y-1.5 text-xs">
                {upholsteryDistribution.map(u => {
                  const isSelected = selectedUpholsteryType === u.type;
                  return (
                    <div 
                      key={u.type} 
                      onClick={() => setSelectedUpholsteryType(selectedUpholsteryType === u.type ? 'All' : u.type)}
                      className={`flex items-center justify-between cursor-pointer p-1.5 rounded-lg transition ${
                        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: UPHOLSTERY_COLORS[u.type] || '#64748b' }} />
                        <span className={`font-semibold ${isSelected ? 'text-indigo-900 font-semibold' : 'text-slate-800'}`}>{u.type}</span>
                        {isSelected && (
                          <span className="text-xs bg-indigo-600 text-white font-semibold px-1.5 py-0.2 rounded">Filtered</span>
                        )}
                      </div>
                      <span className="tabular-nums font-semibold text-slate-900">{u.units} Units ({u.percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY DATA SHEET TABLE */}
      {tabMode === 'table' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-semibold text-slate-900">
                Ready Stock Floor Inventory Ledger
              </span>
              <span className="text-xs bg-amber-100 text-amber-900 tabular-nums font-semibold px-2.5 py-0.5 rounded-full">
                Showing {paginatedItems.length} of {sortedItems.length} ({activeSummary.totalUnits} Units)
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
                <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-semibold">
                  <th 
                    onClick={() => handleSort('srNo')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition text-center w-14"
                  >
                    SR#
                  </th>
                  <th 
                    onClick={() => handleSort('code')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Code / OPF
                  </th>
                  <th 
                    onClick={() => handleSort('model')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Model</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('functionality')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Functionality
                  </th>
                  <th 
                    onClick={() => handleSort('upholsteryType')}
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                  >
                    Upholstery Type
                  </th>
                  <th className="py-2.5 px-3">Upholstery Code</th>
                  <th 
                    onClick={() => handleSort('qty')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition"
                  >
                    Qty Ready
                  </th>
                  <th className="py-2.5 px-3">Dimensions / Specs</th>
                  <th className="py-2.5 px-3 text-center">Photos</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500 font-medium">
                      No ready stock items match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr 
                      key={`${item.srNo}-${item.code}`}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="py-2.5 px-3 text-center tabular-nums font-semibold text-slate-500">
                        {item.srNo}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-semibold text-slate-800">
                        {item.code}
                      </td>
                      <td 
                        className="py-2.5 px-3 font-semibold text-slate-900 hover:text-amber-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(prev => prev === item.model ? 'All' : item.model);
                        }}
                        title={`Click to filter by ${item.model}`}
                      >
                        {item.model}
                      </td>
                      <td 
                        className="py-2.5 px-3 text-slate-700 hover:text-indigo-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFunctionality(prev => prev === item.functionality ? 'All' : item.functionality);
                        }}
                        title={`Click to filter by ${item.functionality}`}
                      >
                        {item.functionality}
                      </td>
                      <td 
                        className="py-2.5 px-3 font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUpholsteryType(prev => prev === item.upholsteryType ? 'All' : item.upholsteryType);
                        }}
                        title={`Click to filter by ${item.upholsteryType}`}
                      >
                        {item.upholsteryType}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-amber-800">
                        {item.upholsteryCode || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full tabular-nums font-semibold bg-amber-100 text-amber-900 text-xs">
                          {item.qty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate text-xs" title={item.dimensions || item.description}>
                        {item.dimensions || item.description || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {item.photos ? (
                          <a
                            href={item.photos}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-semibold border border-emerald-200"
                            title="Open Google Drive photo"
                          >
                            <span>Photo</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                        >
                          Specs
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

      {/* DETAIL INSPECTION MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-t-2xl flex items-start justify-between">
              <div>
                <span className="text-xs tabular-nums font-semibold text-amber-200">SR.NO #{selectedItem.srNo} • CODE: {selectedItem.code}</span>
                <h3 className="text-xl font-semibold text-white mt-0.5">{selectedItem.model}</h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-white text-amber-900 rounded-full font-semibold text-xs tabular-nums">
                  {selectedItem.qty} {selectedItem.qty === 1 ? 'Unit Ready' : 'Units Ready for Sales'}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-amber-200 hover:text-white rounded-lg bg-amber-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block font-semibold">Functionality</span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{selectedItem.functionality}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block font-semibold">Upholstery Type</span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{selectedItem.upholsteryType}</span>
                </div>

                <div className="col-span-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <span className="text-xs text-amber-900 block font-semibold">Upholstery Code & Color</span>
                  <span className="tabular-nums font-semibold text-amber-950 text-sm mt-0.5 block">
                    {selectedItem.upholsteryCode || 'Standard Color'}
                  </span>
                </div>
              </div>

              {selectedItem.dimensions && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block font-semibold mb-1">Dimensions & Arm Size</span>
                  <p className="font-semibold text-slate-800">{selectedItem.dimensions}</p>
                </div>
              )}

              {selectedItem.description && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-400 block font-semibold mb-1">Configuration & Notes</span>
                  <p className="text-slate-800">{selectedItem.description}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs"
                >
                  Close
                </button>
                {selectedItem.photos && (
                  <a
                    href={selectedItem.photos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Open Drive Photos</span>
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

export default ReadyStockDashboard;
