import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Factory, 
  ReceiptText, 
  BadgePercent, 
  TrendingUp, 
  PackageCheck, 
  Clock, 
  Headphones,
  CheckCircle2
} from 'lucide-react';

const MODULES = [
  { label: 'Executive Directory & Leadership Sheets', icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Production Management System (Manesar & Indore)', icon: Factory, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Receivables & FMS Payment Follow-up', icon: ReceiptText, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Real-Time Gross Profit & Margins', icon: BadgePercent, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Ready Goods & Factory Stock Pipeline', icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { label: 'Sales Reports & Regional Performance', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Overtime & Workforce Capacity', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Service Complaints & Customer Care', icon: Headphones, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
];

const LoadingSpinner: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % MODULES.length);
    }, 280);
    return () => clearInterval(timer);
  }, []);

  const currentModule = MODULES[activeStep];
  const CurrentIcon = currentModule.icon;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center">
      {/* Dynamic Animated Spinner Ring */}
      <div className="relative flex items-center justify-center mb-5">
        {/* Outer glowing pulsing ring */}
        <div className="w-16 h-16 rounded-full border-3 border-slate-100 border-t-indigo-600 border-r-indigo-400 animate-spin"></div>
        {/* Center active module icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-xs transition-transform duration-200">
            <CurrentIcon className={`w-4 h-4 ${currentModule.color} transition-colors duration-200`} />
          </div>
        </div>
      </div>

      {/* Module Status Chip */}
      <div className={`px-3.5 py-1.5 rounded-full border ${currentModule.bg} flex items-center gap-2 transition-all duration-200 shadow-2xs`}>
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
        <span className="text-[13px] font-semibold text-slate-800">
          Connecting {currentModule.label}...
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-4">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${((activeStep + 1) / MODULES.length) * 100}%` }}
        />
      </div>

      {/* Synchronized Sub-bullet Pill Matrix */}
      <div className="grid grid-cols-2 gap-2 mt-5 w-full text-left">
        {MODULES.slice(0, 4).map((mod, idx) => {
          const isDone = activeStep >= idx;
          const ModIcon = mod.icon;
          return (
            <div 
              key={mod.label}
              className={`px-2.5 py-1.5 rounded-lg border text-[13px] font-medium flex items-center gap-2 transition-all duration-200 ${
                isDone 
                  ? 'bg-white border-slate-200 text-slate-700 shadow-2xs' 
                  : 'bg-slate-50 border-slate-100 text-slate-500 opacity-60'
              }`}
            >
              <ModIcon className={`w-3.5 h-3.5 shrink-0 ${isDone ? mod.color : 'text-slate-500'}`} />
              <span className="truncate">{mod.label.split('&')[0].trim()}</span>
              {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadingSpinner;
