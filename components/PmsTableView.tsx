import React, { useState } from 'react';
import type { Order } from '../types';
import { STAGE_CONFIGS } from '../constants';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import Pagination from './Pagination';
import { Eye, CheckCircle2, Clock, AlertTriangle, FileSpreadsheet, ExternalLink, Download } from 'lucide-react';
import { exportOrdersToExcel } from '../utils/excelExport';

interface PmsTableViewProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

const PmsTableView: React.FC<PmsTableViewProps> = ({ orders, onSelectOrder }) => {
  const [hoveredOpf, setHoveredOpf] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Calculate paginated slice of orders
  const totalPages = Math.ceil(orders.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = orders.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

  const getStep = (order: Order, stageName: string) => {
    return order.steps.find(s => s.name === stageName);
  };

  const getStatusBadge = (status: string | undefined, isCurrent: boolean) => {
    if (!status) return <span className="text-slate-300">-</span>;
    if (status === 'Completed') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          Pass / Done
        </span>
      );
    }
    if (isCurrent || status === 'In Progress') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[13px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse whitespace-nowrap">
          In progress
        </span>
      );
    }
    if (status === 'Delayed' || status === 'Failed QC') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[13px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          Hold / Delay
        </span>
      );
    }
    return <span className="text-slate-500 text-[13px]">Pending</span>;
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
      {/* Top Bar for PMS Sheet */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Data sheet
              </h3>
              <span className="text-[13px] text-slate-500 tabular-nums">{orders.length} orders</span>
            </div>
            <p className="text-[13px] text-slate-500">All 14 steps for every order. Scroll sideways to see them all.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-[13px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block animate-pulse"></span> In progress</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Hold / Delay</span>
          </div>

          <button
            onClick={() => exportOrdersToExcel(orders, `PMS_Production_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`, 'PMS Live Orders')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold shadow-xs transition-all cursor-pointer"
            title="Export all orders to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Overflow Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[700px] border-t border-slate-200 scrollbar-thin">
        <table className="w-full text-left text-[13px] border-collapse min-w-[2800px]">
          {/* Header Row 1: Steps & Timelines */}
          <thead>
            <tr className="bg-slate-800 text-slate-100 border-b border-slate-700">
              <th colSpan={7} className="p-2.5 text-center font-semibold text-rose-300 border-r border-slate-700 text-[13px] sticky left-0 z-20 bg-slate-900">
                PMS (Production Management System) - Order Identification
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 1 (07 Days Before Dispatch Date)
              </th>
              <th colSpan={5} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 2 (07 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                Purchase (Yes before 8 Days Of Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 3 (07 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 4 (6 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                (5 Days Of Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 5 ( 6 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 6 ( 5 Days Before Dispatch Date)
              </th>
              <th colSpan={5} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 7 ( 5 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 8 ( 3 Days Before Dispatch Date)
              </th>
              <th colSpan={5} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 9 ( 2 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 10 ( 2 Days Before Dispatch Date)
              </th>
              <th colSpan={5} className="p-2 text-center font-semibold border-r border-slate-700 bg-slate-800 text-slate-200">
                STEP 11 ( 1 Days Before Dispatch Date)
              </th>
              <th colSpan={4} className="p-2 text-center font-semibold bg-emerald-900 text-emerald-200">
                STEP 12 ( On Dispatch Date)
              </th>
            </tr>

            {/* Header Row 2: How (Google Forms & Methods) */}
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[13px]">
              <th colSpan={7} className="p-1.5 text-center font-medium border-r border-slate-300 sticky left-0 z-20 bg-slate-100">
                How (Update Method)
              </th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-slate-200 font-semibold text-indigo-700">Carpentry Q.C. Google Form</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-slate-200 font-semibold text-indigo-700">Upholstery Q.C. Google Form</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-semibold text-indigo-700">Fitting Google Form</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-slate-200 font-semibold text-indigo-700">Q.C. Ready Goods</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-slate-200 font-medium">Manually</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-slate-200 font-semibold text-indigo-700">Packing Google Form</th>
              <th colSpan={4} className="p-1.5 text-center font-semibold text-emerald-700">Dispatch Google Form</th>
            </tr>

            {/* Header Row 3: Responsible Person (Pinkish / Warm accent) */}
            <tr className="bg-indigo-50 text-indigo-900 border-b border-indigo-200 text-[13px]">
              <th colSpan={7} className="p-1.5 text-center font-semibold border-r border-indigo-200 sticky left-0 z-20 bg-indigo-100 text-indigo-950">
                Responsible Person
              </th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Sourav Yadav</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Atulendra Mishra</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Navneet</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Bharat</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Bharat</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Purchase Team / Ms. Sonia</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Bharat</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Bharat</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Aakash</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Ms. Kiran</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Vikas Sharma / Mr. Mohit</th>
              <th colSpan={4} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Rakesh Singh</th>
              <th colSpan={5} className="p-1.5 text-center border-r border-indigo-200 font-semibold italic">Mr. Yogender Singh</th>
              <th colSpan={4} className="p-1.5 text-center font-semibold italic text-emerald-900 bg-emerald-50">Mr. Umesh</th>
            </tr>

            {/* Header Row 4: Stages of Production */}
            <tr className="bg-amber-100 text-amber-950 border-b border-amber-300 text-[13px] font-semibold">
              <th colSpan={7} className="p-2 text-center border-r border-amber-300 sticky left-0 z-20 bg-amber-200 text-amber-950">
                Stages of Production
              </th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">CARPENTRY</th>
              <th colSpan={5} className="p-2 text-center border-r border-amber-300">CARPENTRY QUALITY CONTROL</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">UPHOLSTERY AVAILABLE</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">CUTTING OF UPHOLSTERY</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">STITCHING OF UPHOLSTERY</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">AVAILABILITY OF BOXES</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">LINING & FOAMING</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">UPHOLSTERY</th>
              <th colSpan={5} className="p-2 text-center border-r border-amber-300">UPHOLSTERY QUALITY CONTROL</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">FITTING</th>
              <th colSpan={5} className="p-2 text-center border-r border-amber-300">QUALITY CONTROL</th>
              <th colSpan={4} className="p-2 text-center border-r border-amber-300">PICTURE SHARING</th>
              <th colSpan={5} className="p-2 text-center border-r border-amber-300">PACKING</th>
              <th colSpan={4} className="p-2 text-center text-emerald-950 bg-emerald-100">DISPATCH</th>
            </tr>

            {/* Header Row 5: Column Subheaders */}
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[13px] font-semibold sticky top-0 z-10">
              {/* Order Info Sticky Columns */}
              <th className="p-2 border-r border-slate-300 sticky left-0 z-30 bg-slate-200 w-28">Target Dispatch</th>
              <th className="p-2 border-r border-slate-300 sticky left-28 z-30 bg-slate-200 w-28">Order no.</th>
              <th className="p-2 border-r border-slate-200 text-center w-16">Qty (units)</th>
              <th className="p-2 border-r border-slate-200 w-44">Model Of Recliners</th>
              <th className="p-2 border-r border-slate-200 w-48">Upholstery Type & Code</th>
              <th className="p-2 border-r border-slate-200 w-28">Order received</th>
              <th className="p-2 border-r border-slate-300 w-24">Action</th>

              {/* 1. Carpentry */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 2. Carpentry QC */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Status</th>
              <th className="p-1.5 border-r border-slate-300 w-32">Remarks</th>

              {/* 3. Upholstery Available */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 4. Cutting */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 5. Stitching */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 6. Availability of Boxes */}
              <th className="p-1.5 border-r border-slate-200">Pln</th>
              <th className="p-1.5 border-r border-slate-200">Act</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 7. Lining & Foaming */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 8. Upholstery */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 9. Upholstery QC */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Status</th>
              <th className="p-1.5 border-r border-slate-300 w-32">Remarks</th>

              {/* 10. Fitting */}
              <th className="p-1.5 border-r border-slate-200">Fitting Form</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 11. Quality Control */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Qty Pass</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Status</th>
              <th className="p-1.5 border-r border-slate-300 w-32">Reason of Fail</th>

              {/* 12. Picture Sharing */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Attachment</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Status</th>

              {/* 13. Packing */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Status</th>
              <th className="p-1.5 border-r border-slate-300 text-center">Delay Days</th>

              {/* 14. Dispatch */}
              <th className="p-1.5 border-r border-slate-200">Planned</th>
              <th className="p-1.5 border-r border-slate-200">Actual</th>
              <th className="p-1.5 border-r border-slate-200 text-center">Delay</th>
              <th className="p-1.5 text-center">Status</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {paginatedOrders.map((order, oIdx) => {
              const isHovered = hoveredOpf === order.opfNo;

              return (
                <tr 
                  key={order.opfNo} 
                  className={`transition-colors cursor-pointer ${
                    isHovered ? 'bg-indigo-50/60' : oIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  }`}
                  onMouseEnter={() => setHoveredOpf(order.opfNo)}
                  onMouseLeave={() => setHoveredOpf(null)}
                  onClick={() => onSelectOrder(order)}
                >
                  {/* Sticky Base Columns */}
                  <td className="p-2 border-r border-slate-200 tabular-nums text-slate-700 sticky left-0 z-10 bg-inherit whitespace-nowrap">
                    {formatDateDDMMMYYYY(order.dispatchDate)}
                  </td>
                  <td className="p-2 border-r border-slate-200 tabular-nums font-semibold text-indigo-700 sticky left-28 z-10 bg-inherit whitespace-nowrap flex items-center gap-1.5">
                    {order.opfNo}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-semibold text-slate-900">
                    {order.quantity}
                  </td>
                  <td className="p-2 border-r border-slate-200 font-medium text-slate-900 max-w-[180px] truncate" title={order.modelName}>
                    {order.modelName}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-slate-600 max-w-[200px] truncate" title={order.upholstery}>
                    {order.upholstery}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-slate-500 tabular-nums text-[13px] whitespace-nowrap">
                    {formatDateDDMMMYYYY(order.opfReceiveDate)}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelectOrder(order); }}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[13px] font-semibold flex items-center gap-1 mx-auto transition-colors"
                    >
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </td>

                  {/* 1. CARPENTRY */}
                  {(() => {
                    const s = getStep(order, 'CARPENTRY');
                    const isCurr = order.currentStage === 'CARPENTRY';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 2. CARPENTRY QC */}
                  {(() => {
                    const s = getStep(order, 'CARPENTRY QUALITY CONTROL');
                    const isCurr = order.currentStage === 'CARPENTRY QUALITY CONTROL';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                        <td className="p-1.5 border-r border-slate-300 text-[13px] text-slate-600 truncate max-w-[120px]" title={s?.remarks || ''}>
                          {s?.remarks || '-'}
                        </td>
                      </>
                    );
                  })()}

                  {/* 3. UPHOLSTERY AVAILABLE */}
                  {(() => {
                    const s = getStep(order, 'UPHOLSTERY AVAILABLE');
                    const isCurr = order.currentStage === 'UPHOLSTERY AVAILABLE';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 4. CUTTING */}
                  {(() => {
                    const s = getStep(order, 'CUTTING OF UPHOLSTERY');
                    const isCurr = order.currentStage === 'CUTTING OF UPHOLSTERY';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 5. STITCHING */}
                  {(() => {
                    const s = getStep(order, 'STITCHING OF UPHOLSTERY');
                    const isCurr = order.currentStage === 'STITCHING OF UPHOLSTERY';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 6. AVAILABILITY OF BOXES */}
                  {(() => {
                    const s = getStep(order, 'AVAILABILITY OF BOXES');
                    const isCurr = order.currentStage === 'AVAILABILITY OF BOXES';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 7. LINING & FOAMING */}
                  {(() => {
                    const s = getStep(order, 'LINING & FOAMING');
                    const isCurr = order.currentStage === 'LINING & FOAMING';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 8. UPHOLSTERY */}
                  {(() => {
                    const s = getStep(order, 'UPHOLSTERY');
                    const isCurr = order.currentStage === 'UPHOLSTERY';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 9. UPHOLSTERY QC */}
                  {(() => {
                    const s = getStep(order, 'UPHOLSTERY QUALITY CONTROL');
                    const isCurr = order.currentStage === 'UPHOLSTERY QUALITY CONTROL';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                        <td className="p-1.5 border-r border-slate-300 text-[13px] text-slate-600 truncate max-w-[120px]" title={s?.remarks || ''}>
                          {s?.remarks || '-'}
                        </td>
                      </>
                    );
                  })()}

                  {/* 10. FITTING */}
                  {(() => {
                    const s = getStep(order, 'FITTING');
                    const isCurr = order.currentStage === 'FITTING';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 11. QUALITY CONTROL */}
                  {(() => {
                    const s = getStep(order, 'QUALITY CONTROL');
                    const isCurr = order.currentStage === 'QUALITY CONTROL';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center font-semibold text-emerald-700">{s?.qtyPass ?? '-'}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                        <td className="p-1.5 border-r border-slate-300 text-[13px] text-rose-700 truncate max-w-[120px]" title={s?.reasonOfFail || ''}>
                          {s?.reasonOfFail || '-'}
                        </td>
                      </>
                    );
                  })()}

                  {/* 12. PICTURE SHARING */}
                  {(() => {
                    const s = getStep(order, 'PICTURE SHARING');
                    const isCurr = order.currentStage === 'PICTURE SHARING';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">
                          {s?.attachment ? <span className="text-indigo-700 font-semibold">✓ Attached</span> : '-'}
                        </td>
                        <td className="p-1.5 border-r border-slate-300 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}

                  {/* 13. PACKING */}
                  {(() => {
                    const s = getStep(order, 'PACKING');
                    const isCurr = order.currentStage === 'PACKING';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                        <td className="p-1.5 border-r border-slate-300 text-center text-[13px]">{s?.delayDays ?? '0'}</td>
                      </>
                    );
                  })()}

                  {/* 14. DISPATCH */}
                  {(() => {
                    const s = getStep(order, 'DISPATCH');
                    const isCurr = order.currentStage === 'DISPATCH';
                    return (
                      <>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{formatDateDDMMMYYYY(s?.plannedDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 tabular-nums text-[13px] text-slate-800 font-medium whitespace-nowrap">{formatDateDDMMMYYYY(s?.actualDate)}</td>
                        <td className="p-1.5 border-r border-slate-200 text-center text-[13px]">{s?.delay ? `+${s.delay}` : '0'}</td>
                        <td className="p-1.5 text-center">{getStatusBadge(s?.status, isCurr)}</td>
                      </>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination for table */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <Pagination
          currentPage={validCurrentPage}
          totalPages={totalPages}
          totalItems={orders.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[20, 35, 50, 100]}
        />
      </div>
    </div>
  );
};

export default PmsTableView;
