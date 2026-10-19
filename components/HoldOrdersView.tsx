import React, { useState, useMemo } from 'react';
import type { Order } from '../types';
import { 
  AlertTriangle, 
  Search, 
  Layers, 
  User, 
  Clock, 
  Boxes, 
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Download
} from 'lucide-react';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import { exportOrdersToExcel } from '../utils/excelExport';

interface HoldOrdersViewProps {
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
}

const HoldOrdersView: React.FC<HoldOrdersViewProps> = ({ orders, onSelectOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('All');

  // Identify all On Hold orders
  const holdOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.overallStatus === 'Dispatched' || o.isArchived) return false;
      const hasHoldStatus = o.overallStatus === 'On Hold';
      const hasHoldDispatch = o.dispatchDate ? o.dispatchDate.toUpperCase().includes('HOLD') : false;
      const hasHoldRemarks = o.steps.some(s => s.remarks && s.remarks.toUpperCase().includes('HOLD'));
      return hasHoldStatus || hasHoldDispatch || hasHoldRemarks;
    });
  }, [orders]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalOrders = holdOrders.length;
    const totalUnits = holdOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

    const stageBreakdown: { [stage: string]: { count: number; units: number } } = {};
    const responsibleBreakdown: { [name: string]: { count: number; units: number } } = {};

    holdOrders.forEach(o => {
      const stg = o.currentStage || 'Unassigned';
      if (!stageBreakdown[stg]) stageBreakdown[stg] = { count: 0, units: 0 };
      stageBreakdown[stg].count += 1;
      stageBreakdown[stg].units += o.quantity || 0;

      const resp = o.currentResponsible || 'Unassigned';
      if (!responsibleBreakdown[resp]) responsibleBreakdown[resp] = { count: 0, units: 0 };
      responsibleBreakdown[resp].count += 1;
      responsibleBreakdown[resp].units += o.quantity || 0;
    });

    return {
      totalOrders,
      totalUnits,
      stageBreakdown,
      responsibleBreakdown,
    };
  }, [holdOrders]);

  // Unique Stages for Filter
  const uniqueStages = useMemo(() => {
    const set = new Set<string>();
    holdOrders.forEach(o => {
      if (o.currentStage) set.add(o.currentStage);
    });
    return ['All', ...Array.from(set).sort()];
  }, [holdOrders]);

  // Filtered List
  const filteredHoldOrders = useMemo(() => {
    return holdOrders.filter(o => {
      if (stageFilter !== 'All' && o.currentStage !== stageFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesOpf = (o.opfNo || '').toLowerCase().includes(q);
        const matchesModel = (o.modelName || '').toLowerCase().includes(q);
        const matchesUpholstery = (o.upholstery || '').toLowerCase().includes(q);
        const matchesResp = o.currentResponsible ? o.currentResponsible.toLowerCase().includes(q) : false;
        const matchesRemarks = o.steps ? o.steps.some(s => s.remarks && s.remarks.toLowerCase().includes(q)) : false;
        if (!matchesOpf && !matchesModel && !matchesUpholstery && !matchesResp && !matchesRemarks) {
          return false;
        }
      }
      return true;
    });
  }, [holdOrders, stageFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-slate-500">
          {metrics.totalOrders} orders · {metrics.totalUnits} chairs paused, not counted in the production queue
        </p>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search OPF, model, upholstery, remarks.."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 outline-none w-72 focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Stage filter dropdown */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:border-amber-500 cursor-pointer"
            >
              {uniqueStages.map(stg => (
                <option key={stg} value={stg}>
                  {stg === 'All' ? 'All Stages' : `Stage: ${stg}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[13px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900">{filteredHoldOrders.length}</strong> of <strong className="text-slate-900">{holdOrders.length}</strong> Hold Orders
            </div>
            <button
              onClick={() => exportOrdersToExcel(filteredHoldOrders, `Hold_Orders_Report_${new Date().toISOString().slice(0, 10)}.xlsx`, 'On Hold Orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold shadow-xs transition-all cursor-pointer"
              title="Export Hold Orders to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Table */}
        {filteredHoldOrders.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="font-semibold text-sm text-slate-800">No orders on hold</p>
            <p className="text-[13px] text-slate-500 mt-1">Nothing matches. Try clearing the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-[13px] border-collapse bg-white">
              <thead className="bg-[#fef9c3] border-b-2 border-black text-black font-semibold text-left">
                <tr>
                  <th className="p-3 border-r border-slate-300">OPF No</th>
                  <th className="p-3 border-r border-slate-300">Model Name</th>
                  <th className="p-3 border-r border-slate-300">Upholstery</th>
                  <th className="p-3 border-r border-slate-300 text-center">Current Stage</th>
                  <th className="p-3 border-r border-slate-300 text-right">Total Qty</th>
                  <th className="p-3 border-r border-slate-300">Responsible</th>
                  <th className="p-3 border-r border-slate-300 text-center">Scheduled Dispatch</th>
                  <th className="p-3 border-r border-slate-300">Hold Reason / Remarks</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHoldOrders.map((order) => {
                  const holdRemark = order.steps?.find(s => s.remarks && s.remarks.toUpperCase().includes('HOLD'))?.remarks || 'Order placed on Hold';
                  const qcStep = order.steps.find(s => s.name === 'QUALITY CONTROL');

                  return (
                    <tr 
                      key={order.opfNo}
                      onClick={() => onSelectOrder && onSelectOrder(order)}
                      className={`hover:bg-amber-50/60 transition-colors ${onSelectOrder ? 'cursor-pointer' : ''}`}
                    >
                      <td className="p-3 font-semibold tabular-nums text-indigo-700 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{order.opfNo}</span>
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-900 border-r border-slate-200 max-w-xs truncate">
                        {order.modelName}
                      </td>
                      <td className="p-3 text-slate-600 border-r border-slate-200 max-w-xs truncate text-[13px]">
                        {order.upholstery}
                      </td>
                      <td className="p-3 text-center border-r border-slate-200">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[13px]">
                          {order.currentStage || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold text-slate-900 border-r border-slate-200 text-sm">
                        {order.quantity}
                      </td>
                      <td className="p-3 text-slate-700 border-r border-slate-200 text-[13px]">
                        {order.currentResponsible || 'Unassigned'}
                      </td>
                      <td className="p-3 text-center border-r border-slate-200 tabular-nums text-[13px] font-semibold text-amber-800">
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                          {order.dispatchDate || 'HOLD'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 border-r border-slate-200 text-[13px] max-w-xs">
                        <span className="italic">{holdRemark}</span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectOrder) onSelectOrder(order);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[13px] rounded-lg border border-indigo-200 transition-colors"
                        >
                          <span>Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoldOrdersView;
