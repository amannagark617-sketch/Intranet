import React, { useState } from 'react';
import type { Insight } from '../types';
import { Sparkles, Lightbulb, AlertCircle } from 'lucide-react';

interface AIPoweredInsightsCardProps {
  onGenerate: () => Promise<Insight[]>;
}

const AIPoweredInsightsCard: React.FC<AIPoweredInsightsCardProps> = ({ onGenerate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateClick = async () => {
    setIsLoading(true);
    setInsights(null);
    setError(null);
    try {
      const result = await onGenerate();
      setInsights(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col h-full border border-slate-200 shadow-xs">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            AI Production Insights
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Automated stage bottleneck analysis & recommendations</p>
        </div>
        <button
          onClick={handleGenerateClick}
          disabled={isLoading}
          className="flex-shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Insights</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-grow flex flex-col justify-center animate-fade-in mt-2">
        {!insights && !error && !isLoading && (
          <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Lightbulb className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Click "Generate Insights" to run automated analysis on active WIP orders & schedules.</p>
          </div>
        )}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-6 h-6 bg-slate-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-100 rounded w-full"></div>
                  <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="bg-rose-50 text-rose-800 p-3.5 rounded-xl text-xs border border-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Analysis Notice:</strong> {error}
            </div>
          </div>
        )}
        {insights && insights.length > 0 && (
          <ul className="space-y-3.5">
            {insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-indigo-600 flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-slate-900 mb-0.5">{insight.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AIPoweredInsightsCard;
