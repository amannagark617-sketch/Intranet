import React from 'react';
import type { Order } from '../types';
import OrderStepTracker from './OrderStepTracker';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import { titleCase } from '../utils/format';

interface OrderCardProps {
  order: Order;
  onSelect: (order: Order) => void;
}

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  WIP: { label: 'WIP', dot: 'bg-indigo-500', text: 'text-indigo-700' },
  'On Hold': { label: 'On hold', dot: 'bg-amber-500', text: 'text-amber-700' },
  Dispatched: { label: 'Dispatched', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  Ready: { label: 'Ready to dispatch', dot: 'bg-emerald-500', text: 'text-emerald-700' },
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onSelect }) => {
  const status = STATUS[order.overallStatus] || { label: order.overallStatus, dot: 'bg-slate-400', text: 'text-slate-600' };
  const stage =
    order.overallStatus === 'Dispatched'
      ? 'Dispatched'
      : order.overallStatus === 'Ready'
      ? 'Ready to dispatch'
      : order.currentStage
      ? titleCase(order.currentStage)
      : '—';

  return (
    <div
      onClick={() => onSelect(order)}
      className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 md:p-5 transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md cursor-pointer"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold text-slate-900">{titleCase(order.modelName)}</h3>
            <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500 tabular-nums">
            {order.opfNo}
            {order.upholstery ? ` · ${titleCase(order.upholstery)}` : ''}
          </p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-[13px] text-slate-500">Chairs</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{order.quantity}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-slate-500">Dispatch</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{formatDateDDMMMYYYY(order.dispatchDate)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-slate-500">Now at</dt>
            <dd className="font-semibold text-slate-900">
              {stage}
              {order.currentResponsible ? <span className="font-normal text-slate-500"> · {order.currentResponsible}</span> : null}
            </dd>
          </div>
        </dl>
      </div>

      <OrderStepTracker
        steps={order.steps}
        currentStage={order.overallStatus === 'Ready' ? 'DISPATCH' : order.currentStage}
        onStepClick={() => onSelect(order)}
      />
    </div>
  );
};

export default OrderCard;
