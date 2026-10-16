import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  User, 
  Calendar, 
  Layers, 
  Database, 
  Archive, 
  Check, 
  ChevronDown, 
  X,
  AlertTriangle,
  Truck,
  Clock,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { RESPONSIBLE_PERSONS, PRODUCTION_STAGES, STAGE_CONFIGS } from '../constants';

export const DEFAULT_STATUSES = ['WIP', 'Ready', 'On Hold'];

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Multi-select Status
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  onSelectAllStatuses: () => void;
  onSelectActiveStatuses: () => void;
  onClearStatuses: () => void;
  // Multi-select Stages
  selectedStages: string[];
  onStageToggle: (stage: string) => void;
  onSelectAllStages: () => void;
  onClearStages: () => void;
  // Multi-select Responsible Persons
  selectedResponsibles: string[];
  onResponsibleToggle: (person: string) => void;
  onSelectAllResponsibles: () => void;
  onClearResponsibles: () => void;
  // Dispatch Month
  dispatchMonths: string[];
  dispatchMonthFilter: string;
  onDispatchMonthChange: (month: string) => void;
  // Source Filter
  sourceFilter: 'all' | 'live' | 'archive';
  onSourceChange: (source: 'all' | 'live' | 'archive') => void;
  counts: { all: number; live: number; archive: number };
  statusCounts: { [status: string]: number };
  onResetFilters: () => void;
}

const ALL_STATUS_OPTIONS = [
  { key: 'WIP', label: 'WIP', color: 'indigo', icon: Clock },
  { key: 'Ready', label: 'Ready for Dispatch', color: 'teal', icon: CheckCircle2 },
  { key: 'On Hold', label: 'On Hold', color: 'amber', icon: AlertTriangle },
  { key: 'Dispatched', label: 'Dispatched', color: 'emerald', icon: Truck },
];

const FilterBar: React.FC<FilterBarProps> = ({
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
  dispatchMonths,
  dispatchMonthFilter,
  onDispatchMonthChange,
  sourceFilter,
  onSourceChange,
  counts,
  statusCounts,
  onResetFilters,
}) => {
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [stageSearch, setStageSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');

  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDefaultActive = 
    selectedStatuses.length === 3 &&
    selectedStatuses.includes('WIP') &&
    selectedStatuses.includes('Ready') &&
    selectedStatuses.includes('On Hold') &&
    !selectedStatuses.includes('Dispatched');

  const totalActiveFilterCount = 
    (selectedStatuses.length !== 4 && !isDefaultActive ? selectedStatuses.length : 0) +
    selectedStages.length +
    selectedResponsibles.length +
    (dispatchMonthFilter !== 'All' ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0);

  const filteredStageList = PRODUCTION_STAGES.filter(s => 
    s.toLowerCase().includes(stageSearch.toLowerCase()) ||
    STAGE_CONFIGS[s]?.category.toLowerCase().includes(stageSearch.toLowerCase())
  );

  const availableResponsibles = RESPONSIBLE_PERSONS.filter(p => p !== 'All');
  const filteredResponsibleList = availableResponsibles.filter(p => 
    p.toLowerCase().includes(ownerSearch.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
      {/* Single Unified Filter Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search OPF Number, Model Name, Fabric, Stage, Owner..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full p-2.5 pl-10 pr-8 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs shadow-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 placeholder:text-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Quick Action Controls & Unified Filter Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Data Source Selector */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => onSourceChange('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                sourceFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => onSourceChange('live')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                sourceFilter === 'live'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Live ({counts.live})
            </button>
            <button
              onClick={() => onSourceChange('archive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                sourceFilter === 'archive'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archive ({counts.archive})
            </button>
          </div>

          {/* THE SINGLE UNIFIED MULTI-FILTER DROPDOWN BUTTON */}
          <div className="relative" ref={filterPopoverRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                totalActiveFilterCount > 0
                  ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 shadow-sm'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Multi-Filters</span>
              {totalActiveFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">
                  {totalActiveFilterCount}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* UNIFIED MULTI-FILTER POPOVER MODAL / PANEL */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-[340px] sm:w-[500px] md:w-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 md:p-5 z-50 animate-fade-in space-y-4">
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">Unified Multi-Filter Matrix</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={onResetFilters}
                      className="text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset All</span>
                    </button>
                    <button
                      onClick={() => setIsFilterDropdownOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Section 1: Order Statuses Multi-Select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      1. Status Filter:
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={onSelectAllStatuses} className="text-indigo-600 hover:underline font-medium">
                        All
                      </button>
                      <span className="text-slate-300">•</span>
                      <button onClick={onSelectActiveStatuses} className="text-indigo-600 hover:underline font-medium">
                        Active Only
                      </button>
                      <span className="text-slate-300">•</span>
                      <button onClick={onClearStatuses} className="text-slate-500 hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALL_STATUS_OPTIONS.map((opt) => {
                      const isSelected = selectedStatuses.includes(opt.key);
                      const count = statusCounts[opt.key] ?? 0;
                      const Icon = opt.icon;

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => onStatusToggle(opt.key)}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 ring-1 ring-indigo-300'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="truncate">{opt.label}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: 14 Production Stages Multi-Select */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        2. Stages ({selectedStages.length === 0 ? 'All 14' : `${selectedStages.length} Selected`}):
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={onSelectAllStages} className="text-indigo-600 hover:underline font-medium">
                        All
                      </button>
                      <span className="text-slate-300">•</span>
                      <button onClick={onClearStages} className="text-slate-500 hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Search stages (e.g. Carpentry, Stitching, QC)..."
                    value={stageSearch}
                    onChange={(e) => setStageSearch(e.target.value)}
                    className="w-full p-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />

                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                    {filteredStageList.map((stage) => {
                      const isChecked = selectedStages.includes(stage);
                      const cfg = STAGE_CONFIGS[stage];
                      return (
                        <div
                          key={stage}
                          onClick={() => onStageToggle(stage)}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold'
                              : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] shrink-0 ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <div className="truncate flex-1">
                            <span className="text-xs">{stage}</span>
                            {cfg && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {cfg.stepCode} • {cfg.responsible}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Department Owners & Dispatch Month */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  {/* Owners */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                        <User className="w-3 h-3 text-pink-600" /> Owner:
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button onClick={onSelectAllResponsibles} className="text-indigo-600 hover:underline">All</button>
                        <span>•</span>
                        <button onClick={onClearResponsibles} className="text-slate-500 hover:underline">Clear</button>
                      </div>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1.5 bg-slate-50/50">
                      {availableResponsibles.map((person) => {
                        const isChecked = selectedResponsibles.includes(person);
                        return (
                          <div
                            key={person}
                            onClick={() => onResponsibleToggle(person)}
                            className={`flex items-center gap-1.5 p-1 rounded text-xs cursor-pointer ${
                              isChecked ? 'bg-pink-50 text-pink-900 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <div
                              className={`w-3 h-3 rounded flex items-center justify-center border text-[8px] shrink-0 ${
                                isChecked ? 'bg-pink-600 border-pink-600 text-white' : 'border-slate-300 bg-white'
                              }`}
                            >
                              <Check className="w-2 h-2" />
                            </div>
                            <span className="truncate text-[11px]">{person}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dispatch Month */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-600" /> Dispatch Month:
                    </span>
                    <select
                      value={dispatchMonthFilter}
                      onChange={(e) => onDispatchMonthChange(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="All">All Dispatch Months</option>
                      {dispatchMonths.filter(m => m !== 'All').map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Popover Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono">
                    {totalActiveFilterCount} filters active
                  </span>
                  <button
                    onClick={() => setIsFilterDropdownOpen(false)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset Filters Quick Button */}
          <button
            onClick={onResetFilters}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
            title="Reset all filters to default"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Filter Badges Bar */}
      {(selectedStages.length > 0 || selectedResponsibles.length > 0 || dispatchMonthFilter !== 'All' || sourceFilter !== 'all' || (!isDefaultActive && selectedStatuses.length !== 4)) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-medium">Active Filters:</span>

          {sourceFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
              <span>Source: {sourceFilter.toUpperCase()}</span>
              <button onClick={() => onSourceChange('all')} className="hover:text-slate-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dispatchMonthFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px]">
              <span>Month: {dispatchMonthFilter}</span>
              <button onClick={() => onDispatchMonthChange('All')} className="hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedStages.map(stg => (
            <span
              key={stg}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px]"
            >
              <span>{stg}</span>
              <button onClick={() => onStageToggle(stg)} className="hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {selectedResponsibles.map(resp => (
            <span
              key={resp}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-[11px]"
            >
              <span>{resp}</span>
              <button onClick={() => onResponsibleToggle(resp)} className="hover:text-pink-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            onClick={onResetFilters}
            className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
