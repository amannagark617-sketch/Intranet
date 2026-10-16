import React from 'react';
import type { Order } from '../types';
import { STAGE_CONFIGS } from '../constants';
import { Users, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface ResponsibleStatsProps {
  orders: Order[];
  onTogglePersonFilter: (person: string) => void;
  onClearAll: () => void;
  selectedResponsibles: string[];
}

const ResponsibleStats: React.FC<ResponsibleStatsProps> = ({ 
  orders, 
  onTogglePersonFilter, 
  onClearAll,
  selectedResponsibles 
}) => {
  // Aggregate stats per responsible person
  const personStats = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      stages: string[];
      activeOrders: number;
      completedTasks: number;
      delayedTasks: number;
      units: number;
    }>();

    // Initialize map for all known owners
    Object.values(STAGE_CONFIGS).forEach(cfg => {
      if (!map.has(cfg.responsible)) {
        map.set(cfg.responsible, {
          name: cfg.responsible,
          stages: [],
          activeOrders: 0,
          completedTasks: 0,
          delayedTasks: 0,
          units: 0,
        });
      }
      const entry = map.get(cfg.responsible)!;
      if (!entry.stages.includes(cfg.name)) {
        entry.stages.push(cfg.name);
      }
    });

    // Compute stats from orders
    orders.forEach(order => {
      order.steps.forEach(step => {
        const owner = step.responsible;
        if (!map.has(owner)) {
          map.set(owner, {
            name: owner,
            stages: [step.name],
            activeOrders: 0,
            completedTasks: 0,
            delayedTasks: 0,
            units: 0,
          });
        }
        const entry = map.get(owner)!;
        if (step.status === 'In Progress') {
          entry.activeOrders++;
          entry.units += order.quantity;
        } else if (step.status === 'Completed') {
          entry.completedTasks++;
        } else if (step.status === 'Delayed' || (step.delay && step.delay > 0)) {
          entry.delayedTasks++;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.activeOrders - a.activeOrders);
  }, [orders]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-50 text-pink-700 border border-pink-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-900">
              Department & Stage Owners
            </h3>
            <p className="text-xs text-slate-500">
              Assigned responsibilities across all 14 stages of production (Click any card to multi-filter)
            </p>
          </div>
        </div>

        {selectedResponsibles.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 flex items-center gap-1.5 font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Owner Filter ({selectedResponsibles.length} selected)</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {personStats.map(person => {
          const isSelected = selectedResponsibles.includes(person.name);
          const hasWorkload = person.activeOrders > 0;

          return (
            <div
              key={person.name}
              onClick={() => onTogglePersonFilter(person.name)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                isSelected 
                  ? 'bg-pink-50/70 border-pink-400 ring-2 ring-pink-300 shadow-xs' 
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-pink-900' : 'text-slate-800'}`} title={person.name}>
                    {person.name}
                  </h4>
                  {hasWorkload ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {person.activeOrders} Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-100 shrink-0">
                      Standby
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={person.stages.join(', ')}>
                  Stages: {person.stages.map(s => s.replace('OF UPHOLSTERY', '').replace('QUALITY CONTROL', 'QC')).join(', ')}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{person.completedTasks} Done</span>
                </div>
                {person.delayedTasks > 0 && (
                  <div className="flex items-center gap-1 text-amber-700 font-semibold">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{person.delayedTasks} Delay</span>
                  </div>
                )}
                <div className="text-slate-500 font-mono text-[10px]">
                  {person.units > 0 ? `${person.units} (units)` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResponsibleStats;
