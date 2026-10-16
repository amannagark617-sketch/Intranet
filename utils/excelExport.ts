import * as XLSX from 'xlsx';
import type { Order } from '../types';
import type { ReadyGoodItem } from '../services/readyGoodsService';
import type { ReadyStockItem } from '../services/readyStockService';
import type { ReceivableItem } from '../services/receivableListService';
import type { OnTimeOrderItem, OnTimeMonthlySummary, WeeklyOtdColumn } from '../services/onTimeDeliveryService';

/**
 * Helper to auto-fit column widths based on maximum cell content length
 */
function calculateColumnWidths(data: Record<string, any>[]): { wch: number }[] {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let maxLength = key.length;
    for (const row of data) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLength) {
          maxLength = Math.min(60, strVal.length);
        }
      }
    }
    return { wch: Math.max(12, maxLength + 3) };
  });
}

/**
 * 1. Export Filtered Production Orders (PMS @ Manesar / Pipeline Cards / Data Sheet)
 */
export function exportOrdersToExcel(
  orders: Order[],
  filename = 'PMS_Production_Orders.xlsx',
  sheetTitle = 'PMS Work Orders'
) {
  const rows = orders.map((o, idx) => {
    const qcStep = o.steps?.find((s) => s.name === 'QUALITY CONTROL');
    const packingStep = o.steps?.find((s) => s.name === 'PACKING');
    
    return {
      'S.No': idx + 1,
      'OPF No': o.opfNo || 'N/A',
      'Model Name': o.modelName || 'N/A',
      'Upholstery / Fabric': o.upholstery || 'N/A',
      'Quantity (Units)': o.quantity || 0,
      'Overall Status': o.overallStatus || 'WIP',
      'Current Stage': o.currentStage || 'Finished / Dispatched',
      'Responsible Person': o.currentResponsible || 'N/A',
      'Scheduled Dispatch Date': o.dispatchDate || 'N/A',
      'OPF Receive Date': o.opfReceiveDate || 'N/A',
      'Final QC Pass Date': qcStep?.actualDate || 'Pending',
      'Final QC Pass Qty': o.finalQcQtyPass ?? qcStep?.qtyPass ?? 0,
      'Final QC Status': o.finalQcStatus || 'Pending',
      'Packing Date': packingStep?.actualDate || 'Pending',
      'Source Sheet': o.isArchived ? 'Archive' : 'Live PMS',
      'Remarks / Delay Details': o.steps?.filter(s => s.remarks).map(s => `${s.name}: ${s.remarks}`).join(' | ') || 'None'
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = calculateColumnWidths(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);

  // Add a Summary Sheet with KPIs
  const totalUnits = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const wipOrders = orders.filter(o => o.overallStatus === 'WIP');
  const readyOrders = orders.filter(o => o.overallStatus === 'Ready');
  const onHoldOrders = orders.filter(o => o.overallStatus === 'On Hold');
  const dispatchedOrders = orders.filter(o => o.overallStatus === 'Dispatched');

  const summaryRows = [
    { 'Metric': 'Report Generated On', 'Value': new Date().toLocaleString() },
    { 'Metric': 'Total Orders in Scope', 'Value': orders.length },
    { 'Metric': 'Total Recliner Units', 'Value': totalUnits },
    { 'Metric': 'WIP Orders (In Stages)', 'Value': `${wipOrders.length} orders (${wipOrders.reduce((s, o) => s + o.quantity, 0)} units)` },
    { 'Metric': 'Ready for Dispatch', 'Value': `${readyOrders.length} orders (${readyOrders.reduce((s, o) => s + o.quantity, 0)} units)` },
    { 'Metric': 'On Hold / Delayed', 'Value': `${onHoldOrders.length} orders (${onHoldOrders.reduce((s, o) => s + o.quantity, 0)} units)` },
    { 'Metric': 'Dispatched Orders', 'Value': `${dispatchedOrders.length} orders (${dispatchedOrders.reduce((s, o) => s + o.quantity, 0)} units)` },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

  XLSX.writeFile(workbook, filename);
}

/**
 * 2. Export On-Time Delivery (OTD) SLA Intelligence Report
 */
export function exportOnTimeReportToExcel(
  orders: OnTimeOrderItem[],
  monthlySummaries: OnTimeMonthlySummary[],
  weeklyBuckets: WeeklyOtdColumn[] = [],
  filename = 'OnTime_Delivery_SLA_Report.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Detailed Order SLA Ledger
  const orderRows = orders.map((o, idx) => ({
    'S.No': idx + 1,
    'OPF No': o.opfNo,
    'Model Name': o.modelName,
    'Customer': o.customerName || 'N/A',
    'Total Qty': o.totalQty,
    'Scheduled Dispatch Date': o.dispatchDateStr,
    'Scheduled Week': o.weekName || 'N/A',
    'Final QC Pass Date': o.qcPassDateLatest || 'Pending / In-Process',
    'On-Time Qty': o.onTimeQty,
    'Delayed Qty': o.delayedQty,
    'Upcoming Qty': o.upcomingQty || 0,
    'On-Time Delivery Status': o.status,
    'Audit Diagnosis': o.statusExplanation || 'N/A',
    'Current Stage': o.currentStage || 'N/A',
    'Overall Status': o.overallStatus || 'N/A',
    'Data Stream': o.isArchived ? 'Archive PMS' : 'Live PMS'
  }));
  const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
  ordersSheet['!cols'] = calculateColumnWidths(orderRows);
  XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Order SLA Ledger');

  // Sheet 2: Monthly Summary
  const monthRows = monthlySummaries.map((m) => ({
    'Month': m.monthDisplay,
    'Scheduled Orders': m.totalOrders,
    'Scheduled Units': m.totalUnits,
    'On-Time Orders': m.onTimeOrders,
    'On-Time Units': m.onTimeUnits,
    'Delayed Orders': m.delayedOrders,
    'Delayed Units': m.delayedUnits,
    'Upcoming Orders': m.upcomingOrders,
    'Upcoming Units': m.upcomingUnits,
    'Unit On-Time %': m.unitOnTimePct !== null ? `${m.unitOnTimePct}%` : 'N/A',
    'Order On-Time %': m.orderOnTimePct !== null ? `${m.orderOnTimePct}%` : 'N/A',
  }));
  const monthSheet = XLSX.utils.json_to_sheet(monthRows);
  monthSheet['!cols'] = calculateColumnWidths(monthRows);
  XLSX.utils.book_append_sheet(workbook, monthSheet, 'Monthly SLA Performance');

  // Sheet 3: Weekly Matrix Breakdown
  if (weeklyBuckets.length > 0) {
    const weekRows = weeklyBuckets.map((w) => ({
      'Week Name': w.weekName,
      'Date Range': w.dateRange,
      'Total Orders (OPF)': w.totalOpf,
      'Total Chairs (Units)': w.totalChairs,
      'On-Time OPF': w.onTimeOpf,
      'On-Time Chairs': w.onTimeChairs,
      'Delayed OPF': w.delayOpf,
      'Delayed Chairs': w.delayChairs,
      'Unit On-Time %': `${w.onTimeChairsPct}%`,
      'Order On-Time %': `${w.onTimeOpfPct}%`
    }));
    const weekSheet = XLSX.utils.json_to_sheet(weekRows);
    weekSheet['!cols'] = calculateColumnWidths(weekRows);
    XLSX.utils.book_append_sheet(workbook, weekSheet, 'Weekly Matrix');
  }

  XLSX.writeFile(workbook, filename);
}

/**
 * 2b. Export Direct On-Time vs Delayed Order Ledger
 */
export function exportOnTimeLedgerToExcel(
  orders: OnTimeOrderItem[],
  filename = 'OnTime_vs_Delayed_Order_Ledger.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  const orderRows = orders.map((o, idx) => ({
    'S.No': idx + 1,
    'OPF No': o.opfNo,
    'Model Name': o.modelName,
    'Customer': o.customerName || 'N/A',
    'Total Qty': o.totalQty,
    'Scheduled Dispatch Date': o.dispatchDateStr,
    'Scheduled Week': o.weekName || 'N/A',
    'Final QC Pass Date': o.qcPassDateLatest || 'Pending / In-Process',
    'On-Time Qty': o.onTimeQty,
    'Delayed Qty': o.delayedQty,
    'Upcoming Qty': o.upcomingQty || 0,
    'On-Time Delivery Status': o.status,
    'Audit Diagnosis / Explanation': o.statusExplanation || 'N/A',
    'Current Stage': o.currentStage || 'N/A',
    'Overall Status': o.overallStatus || 'N/A',
    'Data Stream': o.isArchived ? 'Archive PMS' : 'Live PMS'
  }));

  const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
  ordersSheet['!cols'] = calculateColumnWidths(orderRows);
  XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Order Ledger');

  XLSX.writeFile(workbook, filename);
}

/**
 * 3. Export Ready Goods Dashboard Data
 */
export function exportReadyGoodsToExcel(
  items: ReadyGoodItem[],
  filename = 'Ready_Goods_Report.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  const rows = items.map((r, idx) => ({
    'S.No': idx + 1,
    'OPF No': r.opfNo,
    'Model': r.modelOfRecliners || 'Standard Recliner',
    'Order Qty': r.orderQty,
    'Ready Goods Qty': r.readyGoodsQty,
    'Ready Goods Date': r.readyGoodsDate || 'N/A',
    'Days in Factory': r.daysInFactory,
    'Ageing Category': r.category,
    'Ageing Bucket': r.dateRange,
    'Gross Amount (₹)': r.grossAmount,
    'Amount Received (₹)': r.amountReceived,
    'Receivable Balance (₹)': r.receivable,
    'Warehouse Charges (₹)': r.warehouseCharges,
    'Total Received (₹)': r.totalReceived,
    'Balance Payment (₹)': r.balancePayment,
    'Payment Status %': r.pctBalancePayment,
    'Customer Name': r.customerName,
    'Company Name': r.companyName,
    'Location': r.location,
    'Sales Person': r.salesPerson,
    'CRE Name': r.creName,
    'Next Follow-Up Date': r.creNextFollowUpDate || 'Pending',
    'Follow-Ups Count': r.noOfFollowUps,
    'CRE Calling Remarks': r.creCallingRemarks || 'None'
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = calculateColumnWidths(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ready Goods Inventory');

  // Summary Sheet
  const totalUnits = items.reduce((sum, r) => sum + r.readyGoodsQty, 0);
  const totalReceivable = items.reduce((sum, r) => sum + (r.receivable || 0), 0);
  const totalGross = items.reduce((sum, r) => sum + (r.grossAmount || 0), 0);
  const avgDays = Math.round(items.reduce((sum, r) => sum + r.daysInFactory, 0) / (items.length || 1));

  const summaryRows = [
    { 'Summary Metric': 'Report Generated', 'Value': new Date().toLocaleString() },
    { 'Summary Metric': 'Total Ready Goods Orders', 'Value': items.length },
    { 'Summary Metric': 'Total Ready Units in Factory', 'Value': totalUnits },
    { 'Summary Metric': 'Total Gross Value', 'Value': `₹${totalGross.toLocaleString('en-IN')}` },
    { 'Summary Metric': 'Total Pending Receivable Balance', 'Value': `₹${totalReceivable.toLocaleString('en-IN')}` },
    { 'Summary Metric': 'Average Factory Retention Age', 'Value': `${avgDays} Days` },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Portfolio Summary');

  XLSX.writeFile(workbook, filename);
}

/**
 * 4. Export Ready Stock in Factory
 */
export function exportReadyStockToExcel(
  items: Array<{
    stockId?: string;
    modelName: string;
    upholstery: string;
    qty: number;
    category: string;
    location: string;
    date: string;
    remarks: string;
  }>,
  filename = 'Ready_Stock_Factory_Report.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  const rows = items.map((r, idx) => ({
    'S.No': idx + 1,
    'Stock / OPF ID': r.stockId || `STK-${idx + 1}`,
    'Model Name': r.modelName || 'Recliner Model',
    'Upholstery / Color': r.upholstery || 'Standard',
    'Stock Units': r.qty,
    'Category / Type': r.category || 'Factory Floor Stock',
    'Location': r.location || 'Manesar Warehouse',
    'Manufacturing / Entry Date': r.date || 'Available',
    'Remarks / Sales Allocation': r.remarks || 'Available for immediate delivery'
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = calculateColumnWidths(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ready Stock');

  XLSX.writeFile(workbook, filename);
}

/**
 * 5. Export Receivable List (FMS Payments Follow-up)
 */
export function exportReceivablesToExcel(
  items: Array<{
    opfNo?: string;
    customerName: string;
    companyName: string;
    location: string;
    salesPerson: string;
    creName: string;
    billAmount: number;
    receivedAmount: number;
    balanceAmount: number;
    daysOutstanding: number;
    paymentStatus: string;
    lastFollowUpDate: string;
    remarks: string;
  }>,
  filename = 'Receivable_List_Payment_Report.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  const rows = items.map((r, idx) => ({
    'S.No': idx + 1,
    'OPF No': r.opfNo || 'N/A',
    'Customer / Client Name': r.customerName || 'N/A',
    'Company Name': r.companyName || 'N/A',
    'Location': r.location || 'N/A',
    'Sales Lead': r.salesPerson || 'N/A',
    'CRE Assigned': r.creName || 'N/A',
    'Bill Amount (₹)': r.billAmount || 0,
    'Received Amount (₹)': r.receivedAmount || 0,
    'Receivable Balance (₹)': r.balanceAmount || 0,
    'Days Outstanding': r.daysOutstanding || 0,
    'Payment Status': r.paymentStatus || 'Pending',
    'Last Follow-Up Date': r.lastFollowUpDate || 'N/A',
    'Remarks': r.remarks || 'N/A'
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = calculateColumnWidths(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Receivables Ledger');

  XLSX.writeFile(workbook, filename);
}

/**
 * 6. Export Bottlenecks & Department Owners Intelligence
 */
export function exportBottlenecksToExcel(
  stageBottlenecks: {
    stage: string;
    stepCode: string;
    responsible: string;
    category: string;
    wipOrders: number;
    wipUnits: number;
    delayedOrders: number;
    delayedUnits: number;
    avgDelayDays: number;
    topFailureReasons: string[];
    timeline: string;
  }[],
  ownerWorkloads: {
    name: string;
    stages: string[];
    activeOrders: number;
    activeUnits: number;
    delayedOrders: number;
    completedOrders: number;
    bottleneckRisk: string;
  }[],
  delayedOrders: Order[],
  filename = 'Production_Bottlenecks_Analysis.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Stage Bottlenecks
  const stageRows = stageBottlenecks.map((s, idx) => ({
    'Rank': idx + 1,
    'Production Stage': s.stage,
    'Step Code': s.stepCode,
    'Department Lead': s.responsible,
    'Process Category': s.category,
    'Active WIP Orders': s.wipOrders,
    'Active WIP Units': s.wipUnits,
    'Delayed Work Orders': s.delayedOrders,
    'Delayed Units': s.delayedUnits,
    'Average Delay (Days)': s.avgDelayDays,
    'Target SLA Timeline': s.timeline,
    'Primary Root Cause Reasons': s.topFailureReasons.join('; ') || 'Normal operational queue'
  }));
  const stageSheet = XLSX.utils.json_to_sheet(stageRows);
  stageSheet['!cols'] = calculateColumnWidths(stageRows);
  XLSX.utils.book_append_sheet(workbook, stageSheet, 'Stage Bottleneck Audit');

  // Sheet 2: Department Owner Workload
  const ownerRows = ownerWorkloads.map((o) => ({
    'Department Owner': o.name,
    'Assigned Production Stages': o.stages.join(', '),
    'Active Workload (Orders)': o.activeOrders,
    'Active Workload (Units)': o.activeUnits,
    'Delayed Orders': o.delayedOrders,
    'Completed Tasks': o.completedOrders,
    'Bottleneck Risk Level': o.bottleneckRisk
  }));
  const ownerSheet = XLSX.utils.json_to_sheet(ownerRows);
  ownerSheet['!cols'] = calculateColumnWidths(ownerRows);
  XLSX.utils.book_append_sheet(workbook, ownerSheet, 'Department Leads Workload');

  // Sheet 3: Delayed Work Orders Detail
  const delayedOrderRows = delayedOrders.map((o, idx) => {
    const delayedSteps = o.steps?.filter(s => s.status === 'Delayed' || (s.delay && s.delay > 0)) || [];
    return {
      'S.No': idx + 1,
      'OPF No': o.opfNo,
      'Model Name': o.modelName,
      'Upholstery': o.upholstery,
      'Quantity': o.quantity,
      'Overall Status': o.overallStatus,
      'Current Stage': o.currentStage || 'WIP',
      'Assigned Lead': o.currentResponsible || 'N/A',
      'Scheduled Dispatch Date': o.dispatchDate,
      'Delayed Stage(s)': delayedSteps.map(s => s.name).join(', ') || o.currentStage || 'N/A',
      'Stage Delay Days': delayedSteps.map(s => `${s.name}: ${s.delay || s.delayDays || 0}d`).join(', ') || 'N/A',
      'Delay Remarks / Failure Reason': delayedSteps.map(s => s.reasonOfFail || s.remarks).filter(Boolean).join(' | ') || 'Under investigation'
    };
  });
  const delayedSheet = XLSX.utils.json_to_sheet(delayedOrderRows);
  delayedSheet['!cols'] = calculateColumnWidths(delayedOrderRows);
  XLSX.utils.book_append_sheet(workbook, delayedSheet, 'Delayed Work Orders');

  XLSX.writeFile(workbook, filename);
}

/**
 * 7. Export Daily Production and Step-Wise PMS Matrix
 */
export function exportDailyProductionToExcel(
  dailySummaryRows: Array<{
    date: string;
    dayName: string;
    dailyTarget: number;
    actualProducedFinalQc: number;
    dailyVariance: number;
    cumulativeTarget: number;
    cumulativeActual: number;
    cumulativeVariance: number;
    targetAchievementPct: string;
    qcSubmissionsCount: number;
    qcPassRatePct: string;
    dispatchedUnits: number;
    activeStagesCount: number;
  }>,
  stepMatrixRows: Array<Record<string, any>>,
  workOrderLogs: Array<{
    date: string;
    opfNo: string;
    modelName: string;
    upholstery: string;
    quantity: number;
    stageName: string;
    stepCode: string;
    responsible: string;
    status: string;
    remarks?: string;
  }>,
  filename = 'Daily_Production_PMS_Stepwise_Report.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Daily Production Ledger (Actual from Final QC Pass)
  const ledgerRows = dailySummaryRows.map((r, idx) => ({
    'S.No': idx + 1,
    'Date': r.date,
    'Day': r.dayName,
    'Daily Target (Units)': r.dailyTarget,
    'Actual Produced (Final QC Pass)': r.actualProducedFinalQc,
    'Daily Variance (+/-)': r.dailyVariance,
    'Cumulative Target': r.cumulativeTarget,
    'Cumulative Actual Produced': r.cumulativeActual,
    'Cumulative Variance': r.cumulativeVariance,
    'Achievement %': r.targetAchievementPct,
    'QC Submissions': r.qcSubmissionsCount,
    'QC Pass Rate': r.qcPassRatePct,
    'Dispatched (Units)': r.dispatchedUnits,
    'Active Floor Steps': r.activeStagesCount
  }));
  const ledgerSheet = XLSX.utils.json_to_sheet(ledgerRows);
  ledgerSheet['!cols'] = calculateColumnWidths(ledgerRows);
  XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Daily Output (Final QC)');

  // Sheet 2: Step-Wise Matrix
  if (stepMatrixRows.length > 0) {
    const matrixSheet = XLSX.utils.json_to_sheet(stepMatrixRows);
    matrixSheet['!cols'] = calculateColumnWidths(stepMatrixRows);
    XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Step-Wise PMS Matrix');
  }

  // Sheet 3: Daily Work Orders Log
  if (workOrderLogs.length > 0) {
    const logRows = workOrderLogs.map((l, idx) => ({
      'S.No': idx + 1,
      'Date Completed': l.date,
      'OPF No': l.opfNo,
      'Model Name': l.modelName,
      'Upholstery': l.upholstery,
      'Quantity': l.quantity,
      'Production Stage': l.stageName,
      'Step Code': l.stepCode,
      'Responsible Person': l.responsible,
      'Stage Status': l.status,
      'Remarks': l.remarks || 'None'
    }));
    const logSheet = XLSX.utils.json_to_sheet(logRows);
    logSheet['!cols'] = calculateColumnWidths(logRows);
    XLSX.utils.book_append_sheet(workbook, logSheet, 'Daily OPF Step Activity');
  }

  XLSX.writeFile(workbook, filename);
}

