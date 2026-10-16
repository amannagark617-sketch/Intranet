import React, { useState, useEffect, useMemo } from 'react';
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
      {/* TOP HEADER & TITLE BAR (LIGHT LUXURY THEME) */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-500/20">
              <Armchair className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                  Ready Stock Available in Factory
                </h1>
                <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Ready For Sales Purpose
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                Immediate dispatch availability, model configurations, upholstery specifications & Google Drive photo catalog
              </p>
            </div>
          </div>

          {/* Controls */}
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
              title="Export Ready Stock to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        {/* TOP KPI OVERVIEW METRICS (CLICK-TO-FILTER INTERACTIVE) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-100">
          {/* 1. Total Ready Units */}
          <div 
            onClick={handleResetFilters}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              !hasActiveFilters
                ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-500/20'
                : 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-100/40'
            }`}
            title="Click to view all ready stock units"
          >
            <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider">Total Stock Units</span>
            <span className="text-2xl font-black font-mono text-amber-950 block mt-0.5">
              {activeSummary.totalUnits} <span className="text-xs font-bold text-amber-800">Units</span>
            </span>
            <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
              {activeSummary.totalItems} unique line items
            </span>
          </div>

          {/* 2. Distinct Models */}
          <div 
            onClick={() => setTabMode('analytics')}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              tabMode === 'analytics'
                ? 'bg-indigo-100/70 border-indigo-400 ring-2 ring-indigo-500/20'
                : 'bg-indigo-50/60 border-indigo-200/80 hover:bg-indigo-100/40'
            }`}
            title="Click to view Model Analytics Breakdown"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-900 block uppercase tracking-wider">Distinct Models</span>
              <span className="text-[9px] bg-indigo-200 text-indigo-800 font-bold px-1.5 py-0.2 rounded">View Charts</span>
            </div>
            <span className="text-2xl font-black font-mono text-indigo-950 block mt-0.5">
              {activeSummary.totalModels}
            </span>
            <span className="text-[10px] text-indigo-700 font-medium block mt-0.5">
              Armonia, Helios, Grande, etc.
            </span>
          </div>

          {/* 3. Motorised Recliners */}
          <div 
            onClick={() => setSelectedFunctionality(prev => prev === 'MOTORIZED' ? 'All' : 'MOTORIZED')}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              selectedFunctionality === 'MOTORIZED'
                ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500/30'
                : 'bg-blue-50/60 border-blue-200/80 hover:bg-blue-100/40'
            }`}
            title="Click to filter Motorised Recliner Units"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 block uppercase tracking-wider">Motorised Units</span>
              {selectedFunctionality === 'MOTORIZED' && (
                <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
            <span className="text-2xl font-black font-mono text-blue-950 block mt-0.5">
              {activeSummary.motorisedUnits}
            </span>
            <span className="text-[10px] text-blue-700 font-medium block mt-0.5">
              {activeSummary.totalUnits > 0 ? `${Math.round((activeSummary.motorisedUnits / activeSummary.totalUnits) * 100)}% of stock` : '0%'}
            </span>
          </div>

          {/* 4. Manual Recliners */}
          <div 
            onClick={() => setSelectedFunctionality(prev => prev === 'MANUAL' ? 'All' : 'MANUAL')}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              selectedFunctionality === 'MANUAL'
                ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-100/40'
            }`}
            title="Click to filter Manual Recliner Units"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 block uppercase tracking-wider">Manual Units</span>
              {selectedFunctionality === 'MANUAL' && (
                <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
            <span className="text-2xl font-black font-mono text-emerald-950 block mt-0.5">
              {activeSummary.manualUnits}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
              {activeSummary.totalUnits > 0 ? `${Math.round((activeSummary.manualUnits / activeSummary.totalUnits) * 100)}% of stock` : '0%'}
            </span>
          </div>

          {/* 5. Leatherette Units */}
          <div 
            onClick={() => setSelectedUpholsteryType(prev => prev === 'LEATHERETTE' ? 'All' : 'LEATHERETTE')}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              selectedUpholsteryType === 'LEATHERETTE'
                ? 'bg-orange-100 border-orange-500 ring-2 ring-orange-500/30'
                : 'bg-orange-50/60 border-orange-200/80 hover:bg-orange-100/40'
            }`}
            title="Click to filter Leatherette Material Units"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-900 block uppercase tracking-wider">Leatherette</span>
              {selectedUpholsteryType === 'LEATHERETTE' && (
                <span className="text-[9px] bg-orange-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
            <span className="text-2xl font-black font-mono text-orange-950 block mt-0.5">
              {activeSummary.leatheretteUnits} <span className="text-xs font-bold text-orange-800">Units</span>
            </span>
            <span className="text-[10px] text-orange-700 font-medium block mt-0.5">
              Kolors, Opulia Plus, Elvass
            </span>
          </div>

          {/* 6. Premium Fabric */}
          <div 
            onClick={() => setSelectedUpholsteryType(prev => prev === 'PREMIUM FABRIC' ? 'All' : 'PREMIUM FABRIC')}
            className={`rounded-xl p-3.5 border transition cursor-pointer hover:shadow-md ${
              selectedUpholsteryType === 'PREMIUM FABRIC'
                ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-500/30'
                : 'bg-purple-50/60 border-purple-200/80 hover:bg-purple-100/40'
            }`}
            title="Click to filter Premium Fabric Units"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-900 block uppercase tracking-wider">Premium Fabric</span>
              {selectedUpholsteryType === 'PREMIUM FABRIC' && (
                <span className="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
            <span className="text-2xl font-black font-mono text-purple-950 block mt-0.5">
              {activeSummary.fabricUnits} <span className="text-xs font-bold text-purple-800">Units</span>
            </span>
            <span className="text-[10px] text-purple-700 font-medium block mt-0.5">
              Porsche, Godivia, Suede LY
            </span>
          </div>
        </div>

        {/* ACTIVE DRILLDOWN FILTER BANNER */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-950 animate-fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-amber-900 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Active Filters:
              </span>
              {selectedModel !== 'All' && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                  Model: {selectedModel}
                </span>
              )}
              {selectedFunctionality !== 'All' && (
                <span className="bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full font-bold">
                  Functionality: {selectedFunctionality}
                </span>
              )}
              {selectedUpholsteryType !== 'All' && (
                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                  Material: {selectedUpholsteryType}
                </span>
              )}
              {searchTerm && (
                <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">
                  Search: "{searchTerm}"
                </span>
              )}
              <span className="text-slate-600 font-medium">
                ({filteredItems.length} configs • {activeSummary.totalUnits} units)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTabMode('table')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-900 font-bold rounded-lg border border-slate-300 transition cursor-pointer"
              >
                View in Ledger →
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
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTabMode('catalog')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                tabMode === 'catalog'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Stock Catalog Grid</span>
              <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                {filteredItems.length}
              </span>
            </button>

            <button
              onClick={() => setTabMode('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                tabMode === 'analytics'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Model & Upholstery Analytics</span>
            </button>

            <button
              onClick={() => setTabMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                tabMode === 'table'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Inventory Data Sheet</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search Model, Code, Color, Upholstery, Dimensions..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
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

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Model Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="All">All Models ({items.length})</option>
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Functionality Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Functionality</label>
            <select
              value={selectedFunctionality}
              onChange={(e) => { setSelectedFunctionality(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="All">All Mechanisms</option>
              {availableFunctionalities.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Upholstery Type Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Upholstery</label>
            <select
              value={selectedUpholsteryType}
              onChange={(e) => { setSelectedUpholsteryType(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
            >
              <option value="All">All Materials</option>
              {availableUpholsteryTypes.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-1.5 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition flex items-center justify-center gap-1 border border-slate-300"
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

      {/* TAB 1: STOCK CATALOG GRID */}
      {tabMode === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              Showing <span className="text-slate-900 font-black">{filteredItems.length}</span> Ready Stock configurations ({activeSummary.totalUnits} Units ready for immediate dispatch)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const isMotorised = (item.functionality || '').toUpperCase().includes('MOTOR');
              return (
                <div
                  key={`${item.srNo}-${item.code}`}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all p-4 space-y-3 cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Header line: SR.NO and QTY Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        SR #{item.srNo}
                      </span>
                      <span className="text-xs font-black font-mono bg-amber-500 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                        {item.qty} {item.qty === 1 ? 'Unit' : 'Units'} Ready
                      </span>
                    </div>

                    {/* Model Name & OPF/Code */}
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                        {item.model}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 truncate" title={item.code}>
                        Code: {item.code}
                      </p>
                    </div>

                    {/* Mechanism & Functionality Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isMotorised ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isMotorised && <Zap className="w-3 h-3 text-blue-600" />}
                        <span>{item.functionality}</span>
                      </span>
                    </div>

                    {/* Upholstery & Color Specification */}
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Material</span>
                        <span className="font-semibold text-slate-800">{item.upholsteryType}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Color Code</span>
                        <span className="font-semibold text-amber-800 truncate max-w-[140px]" title={item.upholsteryCode}>
                          {item.upholsteryCode || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Dimensions & Description if available */}
                    {(item.dimensions || item.description) && (
                      <div className="text-[11px] text-slate-600 line-clamp-2 bg-amber-50/40 p-2 rounded-lg border border-amber-100/60">
                        {item.dimensions || item.description}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-indigo-700 group-hover:underline flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>Inspect Specs</span>
                    </span>

                    {item.photos && (
                      <a
                        href={item.photos}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-bold"
                        title="View photo on Google Drive"
                      >
                        <span>Photos</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                    <h2 className="text-sm font-bold text-slate-900">Stock by Recliner Model</h2>
                    <p className="text-[11px] text-slate-500">Available finished units by model</p>
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
                    <h2 className="text-sm font-bold text-slate-900">Upholstery Material Split</h2>
                    <p className="text-[11px] text-slate-500">Share of Leatherette, Premium Fabric & Leather (Click to filter)</p>
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
                        <span className={`font-semibold ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-800'}`}>{u.type}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">Filtered</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900">{u.units} Units ({u.percentage}%)</span>
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
              <span className="text-sm font-bold text-slate-900">
                Ready Stock Floor Inventory Ledger
              </span>
              <span className="text-xs bg-amber-100 text-amber-900 font-mono font-bold px-2.5 py-0.5 rounded-full">
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
                <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
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
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                        {item.srNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {item.code}
                      </td>
                      <td 
                        className="py-2.5 px-3 font-bold text-slate-900 hover:text-amber-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(prev => prev === item.model ? 'All' : item.model);
                        }}
                        title={`Click to filter by ${item.model}`}
                      >
                        {item.model}
                      </td>
                      <td 
                        className="py-2.5 px-3 text-slate-700 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFunctionality(prev => prev === item.functionality ? 'All' : item.functionality);
                        }}
                        title={`Click to filter by ${item.functionality}`}
                      >
                        {item.functionality}
                      </td>
                      <td 
                        className="py-2.5 px-3 font-semibold text-slate-800 hover:text-purple-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUpholsteryType(prev => prev === item.upholsteryType ? 'All' : item.upholsteryType);
                        }}
                        title={`Click to filter by ${item.upholsteryType}`}
                      >
                        {item.upholsteryType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-800">
                        {item.upholsteryCode || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-mono font-black bg-amber-100 text-amber-900 text-xs">
                          {item.qty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate text-[11px]" title={item.dimensions || item.description}>
                        {item.dimensions || item.description || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {item.photos ? (
                          <a
                            href={item.photos}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold border border-emerald-200"
                            title="Open Google Drive photo"
                          >
                            <span>Photo</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
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

      {/* DETAIL INSPECTION MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-t-2xl flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-amber-200">SR.NO #{selectedItem.srNo} • CODE: {selectedItem.code}</span>
                <h3 className="text-xl font-black text-white mt-0.5">{selectedItem.model}</h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-white text-amber-900 rounded-full font-black text-xs font-mono">
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
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Functionality</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{selectedItem.functionality}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Upholstery Type</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{selectedItem.upholsteryType}</span>
                </div>

                <div className="col-span-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-900 block uppercase font-bold">Upholstery Code & Color</span>
                  <span className="font-mono font-black text-amber-950 text-sm mt-0.5 block">
                    {selectedItem.upholsteryCode || 'Standard Color'}
                  </span>
                </div>
              </div>

              {selectedItem.dimensions && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Dimensions & Arm Size</span>
                  <p className="font-semibold text-slate-800">{selectedItem.dimensions}</p>
                </div>
              )}

              {selectedItem.description && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Configuration & Notes</span>
                  <p className="text-slate-800">{selectedItem.description}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs"
                >
                  Close
                </button>
                {selectedItem.photos && (
                  <a
                    href={selectedItem.photos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-xs flex items-center gap-1.5 shadow-xs"
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
