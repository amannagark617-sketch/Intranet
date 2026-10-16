import React, { useState } from 'react';
import type { ProductionStep, ProductionStepName } from '../types';
import { STAGE_CONFIGS } from '../constants';
import { Clock, AlertTriangle, User, CheckCircle2 } from 'lucide-react';

interface OrderStepTrackerProps {
  steps: ProductionStep[];
  currentStage: ProductionStepName | null;
  onStepClick?: (step: ProductionStep) => void;
}

const OrderStepTracker: React.FC<OrderStepTrackerProps> = ({ steps, currentStage, onStepClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="w-full relative mt-3.5 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-1 w-full relative">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'Completed';
          const isCurrent = step.name === currentStage;
          const isDelayed = (step.delay !== null && step.delay > 0) || step.status === 'Delayed';
          const isHovered = hoveredIndex === idx;

          // Color calculation for light theme
          let barBg = 'bg-slate-200 border-slate-300';
          let textColor = 'text-slate-400';
          let badgeBg = 'bg-slate-100 text-slate-500 border border-slate-200';

          if (isCompleted) {
            barBg = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 shadow-xs';
            textColor = 'text-emerald-700';
            badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
          } else if (isCurrent) {
            barBg = 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 ring-2 ring-indigo-300 animate-pulse shadow-sm';
            textColor = 'text-indigo-700 font-semibold';
            badgeBg = 'bg-indigo-100 text-indigo-800 border border-indigo-300';
          } else if (isDelayed) {
            barBg = 'bg-amber-500 hover:bg-amber-600 border-amber-600 shadow-xs';
            textColor = 'text-amber-700 font-semibold';
            badgeBg = 'bg-amber-50 text-amber-800 border border-amber-300';
          }

          // Compact label formatting
          const formattedName = step.name
            .replace('QUALITY CONTROL', 'QC')
            .replace('OF UPHOLSTERY', '')
            .replace('AVAILABILITY OF BOXES', 'BOXES')
            .replace('PICTURE SHARING', 'PHOTOS');

          const stepShortCode = step.stepCode
            ? step.stepCode.replace('STEP ', 'S').replace('Purchase', 'PUR')
            : `S${idx + 1}`;

          return (
            <div
              key={step.name}
              className="relative flex-1 flex flex-col items-center cursor-pointer py-0.5 group/step min-w-[28px]"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (onStepClick) onStepClick(step);
              }}
            >
              {/* Progress bar segment */}
              <div 
                className={`w-full h-2 rounded-sm border transition-all duration-150 ${barBg}`}
              />

              {/* Step code badge */}
              <span className={`text-[8.5px] font-semibold mt-1 tracking-tighter  px-1 py-0.2 rounded tabular-nums ${badgeBg}`}>
                {stepShortCode}
              </span>

              {/* Stage label text */}
              <span 
                className={`text-[8.5px] text-center leading-tight line-clamp-1 max-w-full px-0.5 mt-0.5 transition-colors ${textColor}`}
                title={step.name}
              >
                {formattedName}
              </span>

              {/* ISOLATED Tooltip for THIS STEP ONLY */}
              {isHovered && (
                <div 
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3.5 bg-slate-900 text-white text-xs rounded-xl shadow-2xl z-50 pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    // Prevent overflow on extreme left or right steps
                    transform: idx <= 1 ? 'translateX(-15%)' : idx >= steps.length - 2 ? 'translateX(-85%)' : 'translateX(-50%)'
                  }}
                >
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                      {step.stepCode || `STEP ${idx + 1}`}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      isCurrent ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                      isDelayed ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isCurrent ? 'WIP (In Progress)' : isCompleted ? 'Completed' : isDelayed ? 'Delayed' : 'Pending'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-xs leading-snug">{step.name}</h4>
                  
                  <div className="mt-2.5 space-y-1.5 text-xs text-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-400" /> Owner:
                      </span>
                      <strong className="text-indigo-300 font-medium">{step.responsible}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" /> Timeline:
                      </span>
                      <span className="text-slate-300">{step.timeline}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-700">
                      <span className="text-slate-400">Planned:</span>
                      <span className="tabular-nums text-slate-200">{step.plannedDate || 'Pending'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Actual:</span>
                      <span className={`tabular-nums ${step.actualDate ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                        {step.actualDate || 'Not Completed'}
                      </span>
                    </div>

                    {step.delay !== null && step.delay > 0 && (
                      <div className="flex items-center justify-between text-amber-300 font-semibold bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Delay:</span>
                        <span>+{step.delay} Days</span>
                      </div>
                    )}

                    {step.remarks && (
                      <div className="text-slate-200 bg-slate-800 p-2 rounded text-[10.5px] mt-1.5 border border-slate-700">
                        <span className="text-slate-400 font-semibold block text-xs">QC / REMARKS</span>
                        {step.remarks}
                      </div>
                    )}

                    {step.reasonOfFail && (
                      <div className="text-red-200 bg-red-950/60 p-2 rounded text-[10.5px] mt-1.5 border border-red-800">
                        <span className="text-red-300 font-semibold block text-xs">HOLD REASON</span>
                        {step.reasonOfFail}
                      </div>
                    )}
                  </div>

                  {/* Arrow Indicator */}
                  <div 
                    className="absolute -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-slate-700 rotate-45"
                    style={{
                      left: idx <= 1 ? '15%' : idx >= steps.length - 2 ? '85%' : '50%',
                      transform: 'translateX(-50%) rotate(45deg)'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderStepTracker;
