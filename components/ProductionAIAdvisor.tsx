import React, { useState, useMemo } from 'react';
import type { ProductionAIAnalysis, AISuggestion, AIPlantContext } from '../types';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Zap,
  Target,
  Layers,
  Package,
  Boxes,
  Truck,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

interface ProductionAIAdvisorProps {
  plantContext: AIPlantContext;
  analysis: ProductionAIAnalysis;
  isLoading: boolean;
  onRefreshAnalysis: () => void;
  className?: string;
}

export const ProductionAIAdvisor: React.FC<ProductionAIAdvisorProps> = ({
  plantContext,
  analysis,
  isLoading,
  onRefreshAnalysis,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Categories list with counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: analysis.suggestions.length };
    analysis.suggestions.forEach(s => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });
    return Object.keys(counts).map(cat => ({
      name: cat,
      count: counts[cat]
    }));
  }, [analysis.suggestions]);

  // Filtered suggestions
  const filteredSuggestions = useMemo(() => {
    return analysis.suggestions.filter(s => {
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      const matchPrio = selectedPriority === 'All' || s.priority === selectedPriority;
      return matchCat && matchPrio;
    });
  }, [analysis.suggestions, selectedCategory, selectedPriority]);

  // Copy Executive Action Plan to Clipboard for meeting / floor review
  const handleCopySummary = () => {
    const summaryText = `*LITTLE NAP RECLINERS - AI PRODUCTION ADVISOR SUMMARY* (${plantContext.selectedMonth})
Status: ${analysis.targetStatus} (Health Score: ${analysis.targetHealthScore}/100)
Target: ${plantContext.target} units | Passed inspection: ${plantContext.achievedQcPassed} units (${plantContext.achievementPct}%)
Daily Pace: ${plantContext.dailyAvgPace} chairs/day (Required: ${plantContext.dailyRequiredPace}/day, Delta: ${plantContext.dailyPaceDelta >= 0 ? '+' : ''}${plantContext.dailyPaceDelta}/day)
Projected Month-End: ${analysis.projectedMonthEndUnits} units (${analysis.projectedTargetAchievementPct}%)

*TOP ACTIONABLE SUGGESTIONS:*
${analysis.suggestions.map((s, idx) => `${idx + 1}. [${s.priority}] ${s.title}\n   - Action: ${s.actionPlan}\n   - Impact: ${s.expectedImpact} (${s.responsibleDept})`).join('\n\n')}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getStatusBadge = (status: ProductionAIAnalysis['targetStatus']) => {
    switch (status) {
      case 'Exceptional':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Exceptional Run-Rate
          </span>
        );
      case 'On Track':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            On Track to Target
          </span>
        );
      case 'At Risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Pace At Risk (Action Needed)
          </span>
        );
      case 'Behind Pace':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Behind Target Pace
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: AISuggestion['priority']) => {
    switch (priority) {
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            HIGH PRIORITY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            MEDIUM PRIORITY
          </span>
        );
      case 'OPPORTUNITY':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            OPPORTUNITY
          </span>
        );
    }
  };

  const getCategoryIcon = (category: AISuggestion['category']) => {
    switch (category) {
      case 'Target & Run-Rate':
        return <Target className="w-4 h-4 text-indigo-600" />;
      case 'Bottlenecks & Flow':
        return <Layers className="w-4 h-4 text-amber-600" />;
      case 'Hold Orders & Clearance':
        return <Clock className="w-4 h-4 text-rose-600" />;
      case 'Dispatch & Stock':
        return <Truck className="w-4 h-4 text-emerald-600" />;
      case 'Quality & Efficiency':
      default:
        return <Zap className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Top Header Banner */}
      <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                AI Production & Target Improvement Advisor
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                AI Production Intelligence
              </span>
            </div>
            <p className="text-[13px] md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Real-time industrial engineering analysis correlating PMS 14-stage workflow bottlenecks, target velocity, hold orders, and ready stock to accelerate factory numbers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all shadow-xs"
              title="Copy executive action plan for WhatsApp / floor review"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied Plan</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Share Action Plan</span>
                </>
              )}
            </button>

            <button
              onClick={onRefreshAnalysis}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing Plant Math...' : 'Run Deep AI Analysis'}</span>
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition-all"
              title={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Executive Summary Card */}
        {isExpanded && (
          <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-400/20 text-indigo-300 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-semibold text-indigo-300">Executive Plant Diagnosis</span>
                  {getStatusBadge(analysis.targetStatus)}
                </div>
                <p className="text-[13px] md:text-sm text-slate-200 leading-relaxed font-medium">
                  {analysis.executiveSummary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 self-end md:self-auto border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
              <div className="text-right">
                <div className="text-[13px] font-semibold  text-slate-500">Plant Target Health</div>
                <div className="text-2xl font-semibold text-white">{analysis.targetHealthScore}<span className="text-[13px] font-normal text-slate-500">/100</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Key Plant Diagnostic Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50 border-b border-slate-200">
            {/* 1. Daily Pace & Gap */}
            <div className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-500">Daily Run-Rate Pace</div>
                <div className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  {plantContext.dailyAvgPace} <span className="text-[13px] font-normal text-slate-500">/ day</span>
                  <span className={`text-[13px] font-semibold px-1.5 py-0.2 rounded ${
                    plantContext.dailyPaceDelta >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {plantContext.dailyPaceDelta >= 0 ? `+${plantContext.dailyPaceDelta}` : plantContext.dailyPaceDelta}/day
                  </span>
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5">
                  Req: {plantContext.dailyRequiredPace}/day ({plantContext.workingDaysRemaining} days left)
                </div>
              </div>
            </div>

            {/* 2. Projected Month-End */}
            <div className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-500">Projected Output</div>
                <div className="text-base font-semibold text-slate-900">
                  {analysis.projectedMonthEndUnits} <span className="text-[13px] font-normal text-slate-500">of {plantContext.target} units</span>
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5">
                  {analysis.projectedTargetAchievementPct}% of target
                </div>
              </div>
            </div>

            {/* 3. Top Bottleneck Stage */}
            <div className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-500 truncate">Primary Bottleneck</div>
                <div className="text-base font-semibold text-slate-900 truncate">
                  {plantContext.bottleneckStages[0]?.stage || 'No Active Bottlenecks'}
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5 truncate">
                  {plantContext.bottleneckStages[0] ? `${plantContext.bottleneckStages[0].orders} orders (${plantContext.bottleneckStages[0].units} units)` : 'Flow balanced'}
                </div>
              </div>
            </div>

            {/* 4. Locked Hold Capital */}
            <div className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-500">Locked In Hold</div>
                <div className="text-base font-semibold text-slate-900">
                  {plantContext.holdOrdersCount} <span className="text-[13px] font-normal text-slate-500">orders ({plantContext.holdOrdersUnits} units)</span>
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5">
                  {plantContext.readyGoodsUnits} ready goods awaiting transport
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedCategory === cat.name
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[13px] font-semibold ${
                    selectedCategory === cat.name ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-medium py-1.5 px-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="OPPORTUNITY">Opportunity</option>
              </select>
            </div>
          </div>

          {/* Suggestions Cards List */}
          <div className="p-4 md:p-6 bg-slate-50/50 space-y-4">
            {filteredSuggestions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                <Target className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No suggestions match the selected category & priority.</p>
                <button
                  onClick={() => { setSelectedCategory('All'); setSelectedPriority('All'); }}
                  className="mt-3 text-[13px] text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-slate-100">
                            {getCategoryIcon(suggestion.category)}
                          </div>
                          <span className="text-[13px] font-semibold text-slate-600">
                            {suggestion.category}
                          </span>
                        </div>
                        {getPriorityBadge(suggestion.priority)}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">
                        {suggestion.title}
                      </h3>

                      {/* Grounded Observation */}
                      <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[13px] text-slate-600 leading-relaxed">
                        <strong className="text-slate-800 font-semibold">Data Observation:</strong> {suggestion.observation}
                      </div>

                      {/* Action Plan */}
                      <div className="mb-3 text-[13px] text-slate-700 leading-relaxed">
                        <strong className="text-slate-900 font-semibold flex items-center gap-1 mb-1">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          Recommended Floor Action:
                        </strong>
                        <p className="pl-4 border-l-2 border-indigo-200 text-slate-700 font-medium">
                          {suggestion.actionPlan}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Metadata: Impact & Owner */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">Impact: {suggestion.expectedImpact}</span>
                      </div>

                      <div className="text-slate-500 font-medium text-[13px] truncate">
                        Owner: <span className="font-semibold text-slate-800">{suggestion.responsibleDept}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductionAIAdvisor;
