/**
 * Floor, queue and dispatch numbers for one production month.
 * Shared by the Production Overview and the Today screen so both always show the same figures.
 *
 * - Remaining in queue per order = total qty - Final QC qty passed (0 once QC passed / dispatched)
 * - Current month / backlog / next month are bucketed by each order's dispatch date
 * - Dispatched this month comes from the Dispatch responses sheet (from Jul 2026), else the PMS dates
 */
import type { Order } from '../types';
import { normalizeToYMD } from '../utils/dateUtils';
import {
  MANUAL_MONTHLY_DATA_BEFORE_AUG_2025,
  HISTORICAL_MONTHLY_DISPATCHED,
  type QcMonthReconciliation,
} from './qcResponsesService';
import type { DispatchRecord } from './dispatchResponseService';

export const computeFloorMetrics = ({
  orders,
  dispatchRecords,
  monthKey,
  liveProducedTillDate,
  qcReconciliation,
}: {
  orders: Order[];
  dispatchRecords: DispatchRecord[];
  monthKey: string; // YYYY-MM
  liveProducedTillDate: number;
  qcReconciliation: QcMonthReconciliation;
}) => {
  const [selectedYear, selectedMonthNum] = monthKey.split('-').map(Number);
  const nextMonthNum = selectedMonthNum === 12 ? 1 : selectedMonthNum + 1;
  const nextYearNum = selectedMonthNum === 12 ? selectedYear + 1 : selectedYear;
  const currentPrefix = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`;
  const nextPrefix = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}`;

  // Map of OPF -> Dispatched quantity from Dispatch Response sheet
  const dispatchByOpf = new Map<string, number>();
  dispatchRecords.forEach((d) => {
    dispatchByOpf.set(d.opfNo, (dispatchByOpf.get(d.opfNo) || 0) + d.quantity);
  });

  const detailedOrders: Array<{
    order: Order;
    opfNo: string;
    modelName: string;
    dispatchDate: string | null;
    dispatchYMD: string | null;
    totalQty: number; // Col C
    qtyPass: number; // Col AZ
    qcStatus: string; // Col AV / BA / Step 9 Status
    remainingQueue: number; // Col C - Col AZ (when <> Pass)
    category: 'current' | 'next' | 'backlog' | 'hold' | 'future' | 'completed';
    currentStage: string;
    overallStatus: string;
    isHold: boolean; // counted in the queue like any other order; flagged for information
  }> = [];

  let inQueueCurrentMonth = 0;
  let nextMonthChairs = 0;
  let backlogChairs = 0;
  let holdChairs = 0;
  let holdOrdersCount = 0;
  let otherFutureChairs = 0;
  let dispatchedThisMonth = 0;
  let readyGoodsUnits = 0;
  let readyStockUnits = 0;

  orders.forEach((order) => {
    const orderDispYMD = order.dispatchDate ? normalizeToYMD(order.dispatchDate) : null;
    const dispatchedQtyFromSheet = dispatchByOpf.get(order.opfNo) || 0;
    const isDispatched = order.overallStatus === 'Dispatched' || 
      !!order.isArchived || 
      (dispatchedQtyFromSheet >= (order.quantity || 0) && (order.quantity || 0) > 0);
    const totalQty = Math.max(0, order.quantity || 0);

    // Check if order is on Hold
    const isHold = order.overallStatus === 'On Hold' || 
      (order.dispatchDate ? order.dispatchDate.toUpperCase().includes('HOLD') : false) ||
      (!order.dispatchDate && order.steps.some(s => s.remarks && s.remarks.toUpperCase().includes('HOLD')));

    // Dispatched in this month (from PMS order dates)
    if (isDispatched && orderDispYMD && orderDispYMD.startsWith(currentPrefix)) {
      dispatchedThisMonth += totalQty;
    }

    // Ready Goods / Stock
    if (order.overallStatus === 'Ready' || order.currentStage === 'PACKING' || order.currentStage === 'DISPATCH') {
      readyGoodsUnits += totalQty;
    }
    if (order.overallStatus === 'Dispatched' || (order.steps.find((s) => s.name === 'PICTURE SHARING')?.status === 'Completed')) {
      readyStockUnits += totalQty;
    }

    // Live PMS Step 9 QC Qty Pass (Col AZ) & QC Status (Col BA / Step 9 Status)
    const qcStep = order.steps.find((s) => s.name === 'QUALITY CONTROL');
    const qtyPass = qcStep?.qtyPass ?? order.finalQcQtyPass ?? 0;
    const qcStatus = (order.finalQcStatus || qcStep?.status || 'Pending').trim();
    const isQcPassed = qcStatus.toLowerCase() === 'pass' || (qtyPass >= totalQty && totalQty > 0);

    let remainingQueue = 0;
    let category: 'current' | 'next' | 'backlog' | 'hold' | 'future' | 'completed' = 'completed';

    if (!isDispatched) {
      if (totalQty <= 0 || isQcPassed) {
        remainingQueue = 0;
        category = 'completed';
      } else {
        // Status is <> "Pass": calculate remaining in queue = Total (Col C) - Pass (Col AZ)
        remainingQueue = Math.max(0, totalQty - qtyPass);

        if (remainingQueue === 0) {
          category = 'completed';
        } else if (!orderDispYMD || orderDispYMD < `${currentPrefix}-01`) {
          // Dispatch date before this month, or no date at all (e.g. HOLD) -> Backlog
          category = 'backlog';
          backlogChairs += remainingQueue;
        } else if (orderDispYMD.startsWith(currentPrefix)) {
          category = 'current';
          inQueueCurrentMonth += remainingQueue;
        } else if (orderDispYMD.startsWith(nextPrefix)) {
          category = 'next';
          nextMonthChairs += remainingQueue;
        } else {
          category = 'future';
          otherFutureChairs += remainingQueue;
        }
      }
    }

    if (isHold && remainingQueue > 0) {
      holdChairs += remainingQueue;
      holdOrdersCount += 1;
    }

    if (remainingQueue > 0 || !isDispatched || isHold) {
      detailedOrders.push({
        order,
        opfNo: order.opfNo,
        modelName: order.modelName || 'Model Standard',
        dispatchDate: order.dispatchDate,
        dispatchYMD: orderDispYMD,
        totalQty,
        qtyPass,
        qcStatus,
        remainingQueue,
        category,
        currentStage: order.currentStage || 'Pending',
        overallStatus: isHold ? 'On Hold' : order.overallStatus,
        isHold,
      });
    }
  });

  // From July 2026 onwards, calculate Dispatched This Month directly from Dispatch Response Google Sheet
  const dispatchUnitsFromSheetForMonth = dispatchRecords
    .filter((r) => r.monthKey === currentPrefix)
    .reduce((acc, r) => acc + r.quantity, 0);

  let effectiveDispatchedThisMonth = 0;
  if (MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[currentPrefix]) {
    effectiveDispatchedThisMonth = MANUAL_MONTHLY_DATA_BEFORE_AUG_2025[currentPrefix].dispatched;
  } else if (HISTORICAL_MONTHLY_DISPATCHED[currentPrefix] !== undefined) {
    effectiveDispatchedThisMonth = HISTORICAL_MONTHLY_DISPATCHED[currentPrefix];
  } else if (currentPrefix >= '2026-07' && dispatchRecords.length > 0) {
    effectiveDispatchedThisMonth = dispatchUnitsFromSheetForMonth;
  } else {
    effectiveDispatchedThisMonth = dispatchedThisMonth;
  }

  const currentMonthPlusBacklog = inQueueCurrentMonth + backlogChairs;
  // Total Chairs in Queue = Current Month + Backlog + Next Month
  const totalChairsInQueue = inQueueCurrentMonth + backlogChairs + nextMonthChairs;
  
  // OPF-level reconciliation calculation:
  // If QC passed records exist for this month, use OPF-level reconciliation count
  // Otherwise fallback to Math.max(0, liveProducedTillDate - effectiveDispatchedThisMonth)
  const qcPassedNotDispatched = qcReconciliation.totalQcPassedOpfs > 0
    ? qcReconciliation.notDispatchedUnits
    : Math.max(0, liveProducedTillDate - effectiveDispatchedThisMonth);

  return {
    detailedOrders,
    dispatchedThisMonth: effectiveDispatchedThisMonth,
    inQueueCurrent: inQueueCurrentMonth,
    nextMonthChairs,
    backlogChairs,
    holdChairs,
    holdOrdersCount,
    currentMonthPlusBacklog,
    totalChairsInQueue,
    readyGoodsUnits,
    readyStockUnits,
    qcPassedNotDispatched,
  };
};
