import React from 'react';
import type { Order } from '../types';
import { STAGE_CONFIGS } from '../constants';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import { X, User, Calendar, Clock, AlertTriangle, CheckCircle2, FileText, Image as ImageIcon, Truck, Archive } from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const getStatusText = (status: string) => {
    if (status === 'Ready') return 'Ready for Dispatch';
    return status;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200">
                {order.opfNo}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                order.overallStatus === 'Dispatched' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                order.overallStatus === 'Ready' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                order.overallStatus === 'On Hold' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                'bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}>
                {getStatusText(order.overallStatus)}
              </span>
              {order.isArchived && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Dispatched Archive
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-2">{order.modelName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="text-slate-400 font-medium">Upholstery:</span> <strong className="text-slate-700">{order.upholstery}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Quick Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/50 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Quantity (Qty)</span>
            <span className="text-sm font-bold text-slate-800 font-mono">{order.quantity} (units)</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">OPF Receive Date</span>
            <span className="text-sm font-bold text-slate-800 font-mono">{formatDateDDMMMYYYY(order.opfReceiveDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Target Dispatch Date</span>
            <span className="text-sm font-bold text-slate-800 font-mono">{formatDateDDMMMYYYY(order.dispatchDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Current Stage / Owner</span>
            <span className="text-sm font-bold text-indigo-700">
              {order.overallStatus === 'Dispatched' ? 'Completed & Dispatched' : 
               order.overallStatus === 'Ready' ? 'Ready for Dispatch (Mr. Umesh)' :
               order.currentStage ? `${order.currentStage} (${order.currentResponsible || 'N/A'})` : 'Complete'}
            </span>
          </div>
        </div>

        {/* 14 PMS Production Stages Breakdown */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            PMS 14-Stage Production Tracking {order.isArchived && <span className="text-slate-400 font-normal lowercase">(all steps verified completed in archive)</span>}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {order.steps.map((step) => {
              const isCurrent = order.currentStage === step.name || (order.overallStatus === 'Ready' && step.name === 'DISPATCH');
              const isCompleted = step.status === 'Completed';
              const isDelayed = (step.delay && step.delay > 0) || step.status === 'Delayed';

              return (
                <div
                  key={step.name}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent 
                      ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/30 shadow-sm' 
                      : isCompleted 
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs' 
                        : 'bg-slate-50 border-slate-200 opacity-90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                        {step.stepCode}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800">
                        {step.name}
                      </h4>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      isCurrent ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse' :
                      isDelayed ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {isDelayed && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      {order.overallStatus === 'Ready' && step.name === 'DISPATCH' ? 'Ready for Dispatch' : step.status}
                    </span>
                  </div>

                  {/* Stage Attributes */}
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                      <span className="truncate text-slate-700 font-medium">{step.responsible}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate text-slate-600">{step.timeline}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Plan: <strong className="text-slate-800 font-mono">{formatDateDDMMMYYYY(step.plannedDate)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Act: <strong className="text-slate-800 font-mono">{formatDateDDMMMYYYY(step.actualDate)}</strong></span>
                    </div>
                  </div>

                  {/* Additional Metadata: Remarks, Qty Pass, Reason of Fail, Attachment */}
                  {step.remarks && (
                    <div className="mt-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800">QC Remarks:</strong> {step.remarks}
                      </div>
                    </div>
                  )}

                  {step.reasonOfFail && (
                    <div className="mt-2 text-[11px] bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-rose-900">Hold Reason / QC Defect:</strong> {step.reasonOfFail}
                      </div>
                    </div>
                  )}

                  {step.qtyPass !== null && step.qtyPass !== undefined && (
                    <div className="mt-1.5 text-[11px] text-emerald-700 font-semibold">
                      ✓ Passed Quantity: {step.qtyPass} / {order.quantity} (units)
                    </div>
                  )}

                  {step.attachment && (
                    <div className="mt-2 flex items-center gap-2">
                      <img 
                        src={step.attachment} 
                        alt="Product Picture" 
                        className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-xs" 
                      />
                      <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        Picture Verified
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    <span>How: {step.how}</span>
                    {step.delay !== null && step.delay > 0 && (
                      <span className="text-amber-700 font-bold">Delay: +{step.delay}d</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
