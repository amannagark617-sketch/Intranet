import React from 'react';
import type { Order } from '../types';
import OrderStepTracker from './OrderStepTracker';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import { Calendar, Box, ChevronRight, AlertTriangle, Layers, Archive, Truck, Sparkles } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onSelect: (order: Order) => void;
}

const getStatusBadge = (status: string, isArchived?: boolean) => {
  switch (status) {
    case 'WIP':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
          WIP
        </span>
      );
    case 'On Hold':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          On Hold
        </span>
      );
    case 'Dispatched':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          Dispatched {isArchived && <span className="text-[10px] opacity-75 font-normal ml-0.5">• Archive</span>}
        </span>
      );
    case 'Ready':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
          Ready for Dispatch
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
          {status}
        </span>
      );
  }
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onSelect }) => {
  const currentStageText = order.overallStatus === 'Dispatched' 
    ? 'Dispatched' 
    : order.overallStatus === 'Ready' 
      ? 'Ready for Dispatch' 
      : order.currentStage 
        ? order.currentStage.replace('OF UPHOLSTERY', '') 
        : 'Dispatched';

  return (
    <div 
      onClick={() => onSelect(order)}
      className="w-full bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 md:p-5 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer relative"
    >
      {/* Row Header Information Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: OPF, Status, Model, Fabric */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            {order.opfNo}
          </span>
          
          {getStatusBadge(order.overallStatus, order.isArchived)}

          <div className="flex items-center gap-2">
            <h3 className="text-sm md:text-base font-bold text-slate-900">
              {order.modelName}
            </h3>
            {order.upholstery && (
              <span className="text-xs text-slate-500 hidden sm:inline-block">
                • <span className="text-slate-400">Fabric:</span> <span className="text-slate-700 font-medium">{order.upholstery}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Quantity, Target Dispatch, Current Stage & Owner, Action */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Quantity */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Qty:</span>
            <span className="font-bold text-slate-800 font-mono">{order.quantity} Units</span>
          </div>

          {/* Target Dispatch */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Dispatch:</span>
            <span className="font-mono font-bold text-slate-800">{formatDateDDMMMYYYY(order.dispatchDate)}</span>
          </div>

          {/* Current Stage & Owner */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            order.overallStatus === 'Ready' 
              ? 'bg-teal-50 border-teal-200 text-teal-700'
              : order.overallStatus === 'Dispatched'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}>
            <div className="flex items-center gap-1 font-bold text-xs">
              <Layers className="w-3.5 h-3.5" />
              <span>{currentStageText}</span>
            </div>
            {order.currentResponsible && (
              <span className="text-pink-700 font-semibold pl-1.5 border-l border-slate-200 text-xs">
                {order.currentResponsible}
              </span>
            )}
          </div>

          <div className="text-slate-400 hover:text-indigo-600 transition-colors hidden md:block pl-1">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Full Width 14 Steps Visual Track with Isolated Step Hover */}
      <OrderStepTracker 
        steps={order.steps} 
        currentStage={order.overallStatus === 'Ready' ? 'DISPATCH' : order.currentStage}
        onStepClick={() => onSelect(order)}
      />
    </div>
  );
};

export default OrderCard;
