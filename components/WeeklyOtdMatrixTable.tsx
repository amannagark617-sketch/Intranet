import React, { useState } from 'react';
import { Table, CheckCircle2, AlertTriangle, Filter, X, ChevronRight, Sparkles } from 'lucide-react';
import type { WeeklyOtdMonthMatrix, OnTimeMonthlySummary } from '../services/onTimeDeliveryService';

interface WeeklyOtdMatrixTableProps {
  monthlySummaries: OnTimeMonthlySummary[];
  weeklyMatrices: Record<string, WeeklyOtdMonthMatrix>;
  initialMonthKey?: string;
  selectedWeek?: string | null;
  onSelectMonth?: (monthKey: string) => void;
  onSelectWeek?: (weekName: string | null) => void;
}

export const WeeklyOtdMatrixTable: React.FC<WeeklyOtdMatrixTableProps> = ({
  monthlySummaries,
  weeklyMatrices,
  initialMonthKey,
  selectedWeek = null,
  onSelectMonth,
  onSelectWeek,
}) => {
  // Available months from Feb 2026 to Sep 2026
  const availableMonths = monthlySummaries
    .filter((m) => !m.isFutureMonth && m.monthKey >= '2026-02')
    .map((m) => m.monthKey);

  const defaultMonth = initialMonthKey && availableMonths.includes(initialMonthKey)
    ? initialMonthKey
    : (availableMonths[availableMonths.length - 1] || '2026-07');

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(defaultMonth);

  // Sync internal selectedMonthKey if initialMonthKey changes
  React.useEffect(() => {
    if (initialMonthKey && initialMonthKey !== 'all' && initialMonthKey !== selectedMonthKey) {
      setSelectedMonthKey(initialMonthKey);
    }
  }, [initialMonthKey]);

  const currentMatrix = weeklyMatrices[selectedMonthKey] || weeklyMatrices['2026-07'] || null;

  const handleMonthChange = (mKey: string) => {
    setSelectedMonthKey(mKey);
    if (onSelectMonth) onSelectMonth(mKey);
    // Reset week when month changes
    if (onSelectWeek) onSelectWeek(null);
  };

  const handleWeekClick = (weekName: string | null) => {
    if (!onSelectWeek) return;
    if (selectedWeek === weekName) {
      onSelectWeek(null); // toggle off
    } else {
      onSelectWeek(weekName);
    }
  };

  if (!currentMatrix) {
    return null;
  }

  const activeWeekObj = selectedWeek
    ? currentMatrix.weeks.find((w) => w.weekName === selectedWeek)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Top Header Card with Clean Light Aesthetic & Month Switcher Pills */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Production Schedule
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                Interactive Weekly OTD
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>OTD Production Data — {currentMatrix.monthDisplay}</span>
              <span className="text-xs tabular-nums font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                {currentMatrix.totalNoOfOpf} OPFs • {currentMatrix.totalNoOfChairs} Units
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Weekly breakdown comparing Column G scheduled dispatch against completed Final QC pass dates
            </p>
          </div>

          {/* Month Selector Pills (Clean Light Aesthetic) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {availableMonths.map((mKey) => {
              const isSelected = mKey === selectedMonthKey;
              const [y, m] = mKey.split('-');
              const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m, 10) - 1];
              return (
                <button
                  key={mKey}
                  onClick={() => handleMonthChange(mKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {monthShort} {y}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Week Filter Selector Strip */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">Filter By Week:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* All Month Button */}
            <button
              onClick={() => handleWeekClick(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                !selectedWeek
                  ? 'bg-indigo-600 text-white shadow-xs border border-indigo-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Full Month ({currentMatrix.totalNoOfOpf} OPFs)</span>
            </button>

            {/* Individual Week Buttons */}
            {currentMatrix.weeks.map((w) => {
              const isWkSelected = selectedWeek === w.weekName;
              return (
                <button
                  key={w.weekName}
                  onClick={() => handleWeekClick(w.weekName)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isWkSelected
                      ? 'bg-indigo-600 text-white border border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title={`Click to filter orders below for ${w.weekName} ${w.dateRange}`}
                >
                  <span>{w.weekName}</span>
                  <span className={`text-xs font-medium px-1 rounded ${
                    isWkSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {w.totalOpf} OPF
                  </span>
                  <span className={`text-xs tabular-nums font-semibold ${
                    isWkSelected
                      ? 'text-white'
                      : w.onTimeOpfPct >= 80 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {w.onTimeOpfPct}%
                  </span>
                </button>
              );
            })}

            {selectedWeek && (
              <button
                onClick={() => handleWeekClick(null)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-pointer transition-all ml-1"
                title="Clear week filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Week Filter Alert Banner if week is selected */}
      {activeWeekObj && (
        <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2.5 flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            <span className="font-semibold">
              Active Weekly Filter: <span className="underline decoration-indigo-400 decoration-2">{activeWeekObj.weekName} ({activeWeekObj.dateRange})</span>
            </span>
            <span className="text-indigo-700 hidden sm:inline">
              — Showing {activeWeekObj.totalOpf} OPFs ({activeWeekObj.totalChairs} units), {activeWeekObj.onTimeOpfPct}% On-Time in ledger below
            </span>
          </div>
          <button
            onClick={() => handleWeekClick(null)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100/70 border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            Show All Weeks
          </button>
        </div>
      )}

      {/* Clean Spreadsheet Style OTD Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse text-xs min-w-[720px]">
          {/* Header Row 1: Section Blocks */}
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <th className="p-3 text-left font-semibold text-xs  border-r border-slate-200 w-56 bg-slate-100 text-slate-800">
                Months / Metrics
              </th>
              {/* Total Block Header */}
              <th
                colSpan={2}
                onClick={() => handleWeekClick(null)}
                className={`p-3 border-r border-slate-200 font-semibold text-xs cursor-pointer transition-all ${
                  !selectedWeek
                    ? 'bg-indigo-50/90 text-indigo-900 ring-2 ring-indigo-400 ring-inset font-semibold'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title="Click to view Total Month Schedule in ledger below"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>TOTAL MONTH SCHEDULE</span>
                  {!selectedWeek && <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.2 rounded font-semibold">ACTIVE</span>}
                </div>
              </th>

              {/* Weekly Columns Headers */}
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <th
                    key={w.weekName}
                    colSpan={2}
                    onClick={() => handleWeekClick(w.weekName)}
                    className={`p-3 border-r border-slate-200 font-semibold text-xs cursor-pointer transition-all relative ${
                      isWkSelected
                        ? 'bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-400 ring-inset font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100/90 text-slate-700'
                    }`}
                    title={`Click to filter ledger below for ${w.weekName} ${w.dateRange}`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{w.weekName}</span>
                        {isWkSelected && (
                          <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.2 rounded-full font-semibold">
                            FILTERED
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-normal tracking-tight ${isWkSelected ? 'text-indigo-900 font-semibold' : 'text-slate-500'}`}>
                        {w.dateRange}
                      </div>
                      <div className={`text-xs mt-0.5 transition-opacity ${isWkSelected ? 'text-indigo-700 font-semibold' : 'text-slate-400 opacity-80'}`}>
                        {isWkSelected ? 'Click to reset' : 'Click to filter'}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Header Row 2: OPF vs QTY Sub-headers */}
            <tr className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
              <th className="p-2 text-left bg-slate-100/80 border-r border-slate-200 text-slate-500 text-xs">
                Metric Classification
              </th>
              {/* Month Total Sub-headers */}
              <th
                onClick={() => handleWeekClick(null)}
                className={`p-2 border-r border-slate-200 w-20 cursor-pointer ${
                  !selectedWeek ? 'bg-indigo-50 text-indigo-950 font-semibold' : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100'
                }`}
              >
                OPF
              </th>
              <th
                onClick={() => handleWeekClick(null)}
                className={`p-2 border-r border-slate-200 w-20 cursor-pointer ${
                  !selectedWeek ? 'bg-indigo-50 text-indigo-950 font-semibold' : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100'
                }`}
              >
                QTY
              </th>
              {/* Week Sub-headers */}
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-sub`}>
                    <th
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-2 border-r border-slate-200 w-18 cursor-pointer transition-colors ${
                        isWkSelected
                          ? 'bg-indigo-100/80 text-indigo-950 font-semibold'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      OPF
                    </th>
                    <th
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-2 border-r border-slate-200 w-18 cursor-pointer transition-colors ${
                        isWkSelected
                          ? 'bg-indigo-100/80 text-indigo-950 font-semibold'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      QTY
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {/* ROW 1: TOTAL NUMBER OF OPF / CHAIRS */}
            <tr className="hover:bg-slate-50/80 font-semibold text-slate-800 transition-colors">
              <td className="p-3 text-left font-semibold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                TOTAL NUMBER OF OPF
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-indigo-50/80 text-indigo-950 font-semibold' : 'text-slate-900 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.totalNoOfOpf.toLocaleString()}
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-indigo-50/80 text-indigo-950 font-semibold' : 'text-slate-900 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.totalNoOfChairs.toLocaleString()}
              </td>
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-tot`}>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-indigo-50/90 font-semibold text-indigo-950' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {w.totalOpf}
                    </td>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-indigo-50/90 font-semibold text-indigo-950' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {w.totalChairs}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            {/* ROW 2: ON TIME */}
            <tr className="hover:bg-slate-50/80 text-slate-800 transition-colors">
              <td className="p-3 text-left font-semibold text-emerald-700 bg-slate-50/60 border-r border-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                <span>ON TIME</span>
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-emerald-700 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.onTimeOpf}
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-emerald-700 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.onTimeChairs}
              </td>
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-ontime`}>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-emerald-50 text-emerald-950 font-semibold' : 'text-emerald-700 font-semibold hover:bg-emerald-50/50'
                      }`}
                    >
                      {w.onTimeOpf}
                    </td>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-emerald-50 text-emerald-950 font-semibold' : 'text-emerald-700 font-semibold hover:bg-emerald-50/50'
                      }`}
                    >
                      {w.onTimeChairs}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            {/* ROW 3: DELAY */}
            <tr className="hover:bg-slate-50/80 text-slate-800 transition-colors">
              <td className="p-3 text-left font-semibold text-rose-700 bg-slate-50/60 border-r border-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline shrink-0" />
                <span>DELAY</span>
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-rose-50 text-rose-900 font-semibold' : 'text-rose-700 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.delayOpf}
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer ${
                  !selectedWeek ? 'bg-rose-50 text-rose-900 font-semibold' : 'text-rose-700 hover:bg-slate-50'
                }`}
              >
                {currentMatrix.delayChairs}
              </td>
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-delay`}>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-rose-50 text-rose-950 font-semibold' : 'text-rose-700 font-semibold hover:bg-rose-50/50'
                      }`}
                    >
                      {w.delayOpf}
                    </td>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-rose-50 text-rose-950 font-semibold' : 'text-rose-700 font-semibold hover:bg-rose-50/50'
                      }`}
                    >
                      {w.delayChairs}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            {/* ROW 4: ON TIME % */}
            <tr className="bg-emerald-50/40 text-emerald-950 font-semibold border-t border-slate-200">
              <td className="p-3 text-left font-semibold bg-emerald-50/80 text-emerald-900 border-r border-slate-200">
                ON TIME %
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className="p-3 tabular-nums font-semibold text-emerald-800 border-r border-slate-200 text-sm cursor-pointer"
              >
                {currentMatrix.onTimeOpfPct}%
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className="p-3 tabular-nums font-semibold text-emerald-800 border-r border-slate-200 text-sm cursor-pointer"
              >
                {currentMatrix.onTimeChairsPct}%
              </td>
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-ontime-pct`}>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-emerald-100/80 text-emerald-950 font-semibold text-sm' : 'text-emerald-800 hover:bg-emerald-100/50'
                      }`}
                    >
                      {w.onTimeOpfPct}%
                    </td>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-emerald-100/80 text-emerald-950 font-semibold text-sm' : 'text-emerald-800 hover:bg-emerald-100/50'
                      }`}
                    >
                      {w.onTimeChairsPct}%
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>

            {/* ROW 5: DELAY % */}
            <tr className="bg-rose-50/30 text-rose-950 font-semibold border-t border-slate-200">
              <td className="p-3 text-left font-semibold bg-rose-50/80 text-rose-900 border-r border-slate-200">
                DELAY %
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className="p-3 tabular-nums font-semibold text-rose-800 border-r border-slate-200 text-sm cursor-pointer"
              >
                {currentMatrix.delayOpfPct}%
              </td>
              <td
                onClick={() => handleWeekClick(null)}
                className="p-3 tabular-nums font-semibold text-rose-800 border-r border-slate-200 text-sm cursor-pointer"
              >
                {currentMatrix.delayChairsPct}%
              </td>
              {currentMatrix.weeks.map((w) => {
                const isWkSelected = selectedWeek === w.weekName;
                return (
                  <React.Fragment key={`${w.weekName}-delay-pct`}>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-rose-100/80 text-rose-950 font-semibold text-sm' : 'text-rose-800 hover:bg-rose-100/50'
                      }`}
                    >
                      {w.delayOpfPct}%
                    </td>
                    <td
                      onClick={() => handleWeekClick(w.weekName)}
                      className={`p-3 tabular-nums font-semibold border-r border-slate-200 cursor-pointer transition-colors ${
                        isWkSelected ? 'bg-rose-100/80 text-rose-950 font-semibold text-sm' : 'text-rose-800 hover:bg-rose-100/50'
                      }`}
                    >
                      {w.delayChairsPct}%
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Matrix Footnote / Audit Source */}
      <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/80 text-slate-500 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Click on any Week header or pill above to instantly filter the order ledger below</span>
        </div>
        <div className="text-slate-400 tabular-nums text-xs">
          Source: PMS Live + Destination_2 Archive
        </div>
      </div>
    </div>
  );
};

