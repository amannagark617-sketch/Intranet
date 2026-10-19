import { Order, FinalQcRecord } from '../types';
import { normalizeToYMD, MONTH_NAMES_SHORT, MONTH_NAMES_FULL } from '../utils/dateUtils';

export interface OnTimeOrderItem {
  opfNo: string;
  normalizedOpf: string;
  modelName: string;
  customerName?: string;
  totalQty: number; // Col C
  dispatchDateStr: string; // Col G raw
  dispatchYMD: string | null; // Col G normalized
  dispatchMonthKey: string | null; // YYYY-MM calendar month
  assignedMonthKey?: string | null; // YYYY-MM factory schedule assigned month
  weekKey?: string | null; // e.g. "2026-08-Week 1"
  weekNumInMonth?: number | null;
  weekName?: string | null; // e.g. "Week 1"
  weekRangeLabel?: string | null; // e.g. "(1st Aug to 7th Aug)"
  weekStartDate?: string | null;
  weekEndDate?: string | null;
  qcRecords: Array<{
    dateYMD: string;
    passQuantity: number;
    inspector: string;
    isOnTime: boolean;
  }>;
  totalQcPassed: number;
  onTimeQty: number; // passed on or before dispatch date
  delayedQty: number; // units passed after dispatch date or overdue past dispatch date
  upcomingQty: number; // units scheduled in the future not yet QC passed
  qcPassDateLatest: string | null;
  status: 'On-Time' | 'Partially Delayed' | 'Delayed' | 'Upcoming' | 'On Hold';
  statusExplanation: string;
  isArchived: boolean;
  overallStatus: string;
  currentStage: string;
}

export interface WeeklyOtdColumn {
  weekName: string; // e.g. "Week 1", "Week 2", "Week 3", "Week 4", "Week 5"
  dateRange: string; // e.g. "(1st Aug to 7th Aug)"
  startDate: string; // "2026-08-01"
  endDate: string; // "2026-08-07"
  totalOpf: number;
  totalChairs: number;
  onTimeOpf: number;
  onTimeChairs: number;
  delayOpf: number;
  delayChairs: number;
  onTimeOpfPct: number;
  onTimeChairsPct: number;
  delayOpfPct: number;
  delayChairsPct: number;
}

export interface WeeklyOtdMonthMatrix {
  monthKey: string; // "2026-08"
  monthDisplay: string; // "August 2026"
  totalNoOfOpf: number;
  totalNoOfChairs: number;
  onTimeOpf: number;
  onTimeChairs: number;
  delayOpf: number;
  delayChairs: number;
  onTimeOpfPct: number;
  onTimeChairsPct: number;
  delayOpfPct: number;
  delayChairsPct: number;
  weeks: WeeklyOtdColumn[];
}

export interface OnTimeMonthlySummary {
  monthKey: string; // e.g. "2026-08"
  monthDisplay: string; // e.g. "Aug 2026"
  totalOrders: number;
  totalUnits: number;
  onTimeUnits: number;
  delayedUnits: number;
  upcomingUnits: number;
  onTimeOrders: number;
  delayedOrders: number;
  upcomingOrders: number;
  holdOrders: number;
  unitOnTimePct: number | null; // null if future month with zero due orders
  orderOnTimePct: number | null;
  isFutureMonth: boolean;
  weeklyMatrix?: WeeklyOtdMonthMatrix;
}

export interface OnTimeOverallMetrics {
  totalOrders: number;
  totalUnits: number;
  totalOnTimeUnits: number;
  totalDelayedUnits: number;
  totalUpcomingUnits: number;
  totalOnTimeOrders: number;
  totalDelayedOrders: number;
  totalUpcomingOrders: number;
  totalDueUnits: number;
  totalDueOrders: number;
  overallUnitOnTimePct: number;
  overallOrderOnTimePct: number;
  monthlySummaries: OnTimeMonthlySummary[];
  orderItems: OnTimeOrderItem[];
  weeklyMatrices: Record<string, WeeklyOtdMonthMatrix>;
}

export const normalizeOpf = (s: string | undefined | null): string => {
  if (!s) return '';
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export interface FactoryWeekScheduleItem {
  weekNumInMonth: number;
  weekName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  assignedMonthKey: string; // YYYY-MM
  rangeLabel: string;
}

/**
 * Returns clean, deterministic calendar weeks for any given month (e.g. "2026-08").
 * Ensures every day from the 1st of the month to the last day of the month is covered
 * without spilling into previous or subsequent months.
 */
export const getWeeksForMonth = (monthKey: string): FactoryWeekScheduleItem[] => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const mShort = MONTH_NAMES_SHORT[month - 1] || 'Mth';

  const pad = (n: number) => String(n).padStart(2, '0');
  const makeYMD = (d: number) => `${year}-${pad(month)}-${pad(d)}`;

  const weeks: FactoryWeekScheduleItem[] = [
    {
      weekNumInMonth: 1,
      weekName: 'Week 1',
      startDate: makeYMD(1),
      endDate: makeYMD(Math.min(7, daysInMonth)),
      assignedMonthKey: monthKey,
      rangeLabel: `(${getOrdinal(1)} ${mShort} to ${getOrdinal(Math.min(7, daysInMonth))} ${mShort})`,
    },
    {
      weekNumInMonth: 2,
      weekName: 'Week 2',
      startDate: makeYMD(8),
      endDate: makeYMD(Math.min(14, daysInMonth)),
      assignedMonthKey: monthKey,
      rangeLabel: `(${getOrdinal(8)} ${mShort} to ${getOrdinal(Math.min(14, daysInMonth))} ${mShort})`,
    },
    {
      weekNumInMonth: 3,
      weekName: 'Week 3',
      startDate: makeYMD(15),
      endDate: makeYMD(Math.min(21, daysInMonth)),
      assignedMonthKey: monthKey,
      rangeLabel: `(${getOrdinal(15)} ${mShort} to ${getOrdinal(Math.min(21, daysInMonth))} ${mShort})`,
    },
    {
      weekNumInMonth: 4,
      weekName: 'Week 4',
      startDate: makeYMD(22),
      endDate: makeYMD(Math.min(28, daysInMonth)),
      assignedMonthKey: monthKey,
      rangeLabel: `(${getOrdinal(22)} ${mShort} to ${getOrdinal(Math.min(28, daysInMonth))} ${mShort})`,
    },
  ];

  if (daysInMonth > 28) {
    weeks.push({
      weekNumInMonth: 5,
      weekName: 'Week 5',
      startDate: makeYMD(29),
      endDate: makeYMD(daysInMonth),
      assignedMonthKey: monthKey,
      rangeLabel: `(${getOrdinal(29)} ${mShort} to ${getOrdinal(daysInMonth)} ${mShort})`,
    });
  }

  return weeks;
};

/**
 * Returns the factory week schedule item for any specific date string.
 */
export const getFactoryWeekForDate = (dispatchYMD: string | null): FactoryWeekScheduleItem | null => {
  if (!dispatchYMD) return null;
  const monthKey = dispatchYMD.slice(0, 7);
  const weeks = getWeeksForMonth(monthKey);
  const match = weeks.find((w) => dispatchYMD >= w.startDate && dispatchYMD <= w.endDate);
  return match || null;
};

/**
 * Builds weekly breakdown matrix for a given month matching Little Nap OTD format.
 */
export const buildWeeklyOtdMatrix = (
  monthKey: string,
  allOrders: OnTimeOrderItem[]
): WeeklyOtdMonthMatrix => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const monthNameFull = MONTH_NAMES_FULL[monthIdx] || 'Month';
  const monthDisplay = `${monthNameFull} ${year}`;

  // Find the exact weeks covering this calendar month
  const monthWeeks = getWeeksForMonth(monthKey);

  // Build weekly columns
  const weeks: WeeklyOtdColumn[] = monthWeeks.map((w) => {
    const weekOrders = allOrders.filter((o) => {
      if (!o.dispatchYMD) return false;
      return o.dispatchMonthKey === monthKey && o.dispatchYMD >= w.startDate && o.dispatchYMD <= w.endDate;
    });

    let wTotalOpf = 0;
    let wTotalChairs = 0;
    let wOnTimeOpf = 0;
    let wOnTimeChairs = 0;
    let wDelayOpf = 0;
    let wDelayChairs = 0;

    weekOrders.forEach((o) => {
      wTotalOpf += 1;
      wTotalChairs += o.totalQty;
      wOnTimeChairs += o.onTimeQty;
      wDelayChairs += o.delayedQty;
      if (o.status === 'On-Time') {
        wOnTimeOpf += 1;
      } else if (o.status === 'Delayed' || o.status === 'Partially Delayed') {
        wDelayOpf += 1;
      }
    });

    const wOnTimeOpfPct = wTotalOpf > 0 ? Math.round((wOnTimeOpf / wTotalOpf) * 100) : 0;
    const wOnTimeChairsPct = wTotalChairs > 0 ? Math.round((wOnTimeChairs / wTotalChairs) * 100) : 0;
    const wDelayOpfPct = wTotalOpf > 0 ? Math.round((wDelayOpf / wTotalOpf) * 100) : 0;
    const wDelayChairsPct = wTotalChairs > 0 ? Math.round((wDelayChairs / wTotalChairs) * 100) : 0;

    return {
      weekName: w.weekName,
      dateRange: w.rangeLabel,
      startDate: w.startDate,
      endDate: w.endDate,
      totalOpf: wTotalOpf,
      totalChairs: wTotalChairs,
      onTimeOpf: wOnTimeOpf,
      onTimeChairs: wOnTimeChairs,
      delayOpf: wDelayOpf,
      delayChairs: wDelayChairs,
      onTimeOpfPct: wOnTimeOpfPct,
      onTimeChairsPct: wOnTimeChairsPct,
      delayOpfPct: wDelayOpfPct,
      delayChairsPct: wDelayChairsPct,
    };
  });

  // Aggregate monthly totals directly from the weeks (guaranteeing exact sum consistency)
  const totalNoOfOpf = weeks.reduce((sum, w) => sum + w.totalOpf, 0);
  const totalNoOfChairs = weeks.reduce((sum, w) => sum + w.totalChairs, 0);
  const onTimeOpf = weeks.reduce((sum, w) => sum + w.onTimeOpf, 0);
  const onTimeChairs = weeks.reduce((sum, w) => sum + w.onTimeChairs, 0);
  const delayOpf = weeks.reduce((sum, w) => sum + w.delayOpf, 0);
  const delayChairs = weeks.reduce((sum, w) => sum + w.delayChairs, 0);

  const onTimeOpfPct = totalNoOfOpf > 0 ? Math.round((onTimeOpf / totalNoOfOpf) * 100) : 0;
  const onTimeChairsPct = totalNoOfChairs > 0 ? Math.round((onTimeChairs / totalNoOfChairs) * 100) : 0;
  const delayOpfPct = totalNoOfOpf > 0 ? Math.round((delayOpf / totalNoOfOpf) * 100) : 0;
  const delayChairsPct = totalNoOfChairs > 0 ? Math.round((delayChairs / totalNoOfChairs) * 100) : 0;

  return {
    monthKey,
    monthDisplay,
    totalNoOfOpf,
    totalNoOfChairs,
    onTimeOpf,
    onTimeChairs,
    delayOpf,
    delayChairs,
    onTimeOpfPct,
    onTimeChairsPct,
    delayOpfPct,
    delayChairsPct,
    weeks,
  };
};

/**
 * Computes On-Time Delivery Data across all PMS Orders (Live + Archive) against Final QC responses.
 */
export const calculateOnTimePerformance = (
  orders: Order[],
  qcRecords: FinalQcRecord[],
  todayYMD: string = '2026-09-07'
): OnTimeOverallMetrics => {
  const currentMonthKey = todayYMD.slice(0, 7);

  // 1. Group Final QC records by strictly normalized OPF
  const qcByOpf = new Map<string, FinalQcRecord[]>();

  qcRecords.forEach((rec) => {
    const nOpf = normalizeOpf(rec.opfNo);
    if (nOpf) {
      if (!qcByOpf.has(nOpf)) qcByOpf.set(nOpf, []);
      qcByOpf.get(nOpf)!.push(rec);
    }
  });

  const orderItems: OnTimeOrderItem[] = [];
  const monthlyMap = new Map<string, {
    totalOrders: number;
    totalUnits: number;
    onTimeUnits: number;
    delayedUnits: number;
    upcomingUnits: number;
    onTimeOrders: number;
    delayedOrders: number;
    upcomingOrders: number;
    holdOrders: number;
  }>();

  orders.forEach((order) => {
    if (!order.opfNo || !order.opfNo.trim()) return;

    const totalQty = typeof order.quantity === 'number' && !isNaN(order.quantity) ? Math.max(0, order.quantity) : 0;
    const nOpf = normalizeOpf(order.opfNo);
    const dispatchYMD = order.dispatchDate ? normalizeToYMD(order.dispatchDate) : null;
    const isHold = order.overallStatus === 'On Hold' || 
      (order.dispatchDate && order.dispatchDate.toUpperCase().includes('HOLD'));

    // Retrieve matching QC records from Final QC responses sheet strictly by OPF
    const matchedQc = nOpf ? (qcByOpf.get(nOpf) || []) : [];
    const validPassedRecords = matchedQc.filter(r => r.status === 'Pass' || r.passQuantity > 0);

    let totalQcPassed = 0;
    let onTimeQcPassed = 0;
    let lateQcPassed = 0;
    let latestQcDate: string | null = null;
    const qcDetails: Array<{ dateYMD: string; passQuantity: number; inspector: string; isOnTime: boolean }> = [];

    const isFutureDispatch = dispatchYMD ? dispatchYMD > todayYMD : false;
    const qcStep = order.steps?.find(s => s.name === 'QUALITY CONTROL');
    const isQcStepDone = qcStep && (qcStep.status === 'Completed' || (qcStep.status as string) === 'Pass');
    const qcActualYMD = qcStep?.actualDate ? normalizeToYMD(qcStep.actualDate) : null;
    const archiveCleared = order.isArchived || order.source === 'archive';

    // Process actual Final QC responses from Google Sheet
    validPassedRecords.forEach((r) => {
      const qDate = r.dateYMD || normalizeToYMD(r.timestamp);
      const pQty = r.passQuantity || 1;
      totalQcPassed += pQty;
      if (qDate) {
        if (!latestQcDate || qDate > latestQcDate) latestQcDate = qDate;
        const isOnTime = dispatchYMD ? qDate <= dispatchYMD : false;
        if (isOnTime) {
          onTimeQcPassed += pQty;
        } else {
          lateQcPassed += pQty;
        }
        qcDetails.push({
          dateYMD: qDate,
          passQuantity: pQty,
          inspector: r.qcInspector || 'QC Inspector',
          isOnTime,
        });
      }
    });

    // If no form record matched in the QC responses sheet, check order's own QC step / archive status
    if (validPassedRecords.length === 0) {
      if (qcActualYMD) {
        latestQcDate = qcActualYMD;
        const isOnTime = dispatchYMD ? qcActualYMD <= dispatchYMD : false;
        const passUnits = qcStep.qtyPass || totalQty;
        totalQcPassed = passUnits;
        if (isOnTime) {
          onTimeQcPassed = passUnits;
        } else {
          lateQcPassed = passUnits;
        }
        qcDetails.push({
          dateYMD: qcActualYMD,
          passQuantity: passUnits,
          inspector: qcStep.responsible || 'QC Inspector',
          isOnTime,
        });
      } else if (isQcStepDone || archiveCleared) {
        // Step completed without specific timestamp or historical archive order
        const fallbackDate = order.dispatchDate ? normalizeToYMD(order.dispatchDate) : todayYMD;
        latestQcDate = fallbackDate;
        totalQcPassed = totalQty;
        onTimeQcPassed = totalQty;
        qcDetails.push({
          dateYMD: fallbackDate || todayYMD,
          passQuantity: totalQty,
          inspector: 'Production QC',
          isOnTime: true,
        });
      }
    }

    // Determine On-Time Quantity, Delayed Quantity, and Upcoming Quantity
    let onTimeQty = 0;
    let delayedQty = 0;
    let upcomingQty = 0;

    if (isFutureDispatch) {
      // Future scheduled order (Column G dispatch date > today):
      if (onTimeQcPassed >= totalQty) {
        // Factory completed early and passed Final QC ahead of schedule!
        onTimeQty = totalQty;
        delayedQty = 0;
        upcomingQty = 0;
      } else if (onTimeQcPassed > 0) {
        onTimeQty = onTimeQcPassed;
        delayedQty = 0;
        upcomingQty = Math.max(0, totalQty - onTimeQty);
      } else {
        onTimeQty = 0;
        delayedQty = 0;
        upcomingQty = totalQty;
      }
    } else {
      // Past or current due date (Column G dispatch date <= today):
      onTimeQty = Math.min(totalQty, onTimeQcPassed);
      delayedQty = Math.max(0, totalQty - onTimeQty);
      upcomingQty = 0;
    }

    // Status Classification
    let status: 'On-Time' | 'Partially Delayed' | 'Delayed' | 'Upcoming' | 'On Hold' = 'Delayed';
    let explanation = '';

    if (isHold) {
      status = 'On Hold';
      explanation = 'Order placed on Hold pending customer / material clearance.';
    } else if (totalQty === 0) {
      if (isFutureDispatch) {
        status = 'Upcoming';
        explanation = `Scheduled for future dispatch on ${dispatchYMD || '-'} (0 units booked); production in progress.`;
      } else if (onTimeQcPassed > 0 || archiveCleared || isQcStepDone || order.overallStatus === 'Dispatched') {
        status = 'On-Time';
        explanation = `Order with 0 booked quantity cleared on or before scheduled dispatch date (${dispatchYMD || '-'}).`;
      } else if (validPassedRecords.length > 0) {
        status = 'On-Time';
        explanation = `Order with 0 booked quantity passed final QC.`;
      } else if (dispatchYMD && dispatchYMD <= todayYMD) {
        status = 'Delayed';
        explanation = `Scheduled for ${dispatchYMD} (0 units booked), but final QC is pending.`;
      } else {
        status = 'Upcoming';
        explanation = `Scheduled for ${dispatchYMD || '-'} with 0 units.`;
      }
    } else if (onTimeQty >= totalQty && totalQty > 0) {
      status = 'On-Time';
      explanation = isFutureDispatch 
        ? `All ${totalQty} units passed final QC early ahead of schedule (${dispatchYMD}).`
        : `All ${totalQty} units passed final QC on or before scheduled dispatch date (${dispatchYMD}).`;
    } else if (isFutureDispatch) {
      status = 'Upcoming';
      explanation = onTimeQty > 0
        ? `${onTimeQty} of ${totalQty} units already passed QC ahead of schedule; remaining ${upcomingQty} in progress for ${dispatchYMD}.`
        : `Scheduled for future dispatch on ${dispatchYMD}; production currently in progress.`;
    } else if (!dispatchYMD) {
      status = 'Delayed';
      explanation = 'Unassigned dispatch schedule; final QC pending or unverified.';
    } else if (onTimeQty > 0 && onTimeQty < totalQty) {
      status = 'Partially Delayed';
      explanation = `${onTimeQty} of ${totalQty} units passed QC on time; ${delayedQty} units delayed past dispatch date (${dispatchYMD}).`;
    } else {
      status = 'Delayed';
      explanation = `Scheduled for ${dispatchYMD}, but final QC records show 0 on-time cleared units.`;
    }

    const monthKey = dispatchYMD ? dispatchYMD.slice(0, 7) : 'Unscheduled';
    const matchedWeek = getFactoryWeekForDate(dispatchYMD);
    const assignedMonthKey = monthKey !== 'Unscheduled' ? monthKey : null;

    const item: OnTimeOrderItem = {
      opfNo: order.opfNo,
      normalizedOpf: nOpf,
      modelName: order.modelName || 'Custom Recliner',
      customerName: (order as any).customerName || '',
      totalQty,
      dispatchDateStr: order.dispatchDate || '-',
      dispatchYMD,
      dispatchMonthKey: monthKey !== 'Unscheduled' ? monthKey : null,
      assignedMonthKey,
      weekKey: matchedWeek ? `${matchedWeek.assignedMonthKey}-${matchedWeek.weekName}` : null,
      weekNumInMonth: matchedWeek?.weekNumInMonth ?? null,
      weekName: matchedWeek?.weekName ?? null,
      weekRangeLabel: matchedWeek?.rangeLabel ?? null,
      weekStartDate: matchedWeek?.startDate ?? null,
      weekEndDate: matchedWeek?.endDate ?? null,
      qcRecords: qcDetails,
      totalQcPassed,
      onTimeQty,
      delayedQty,
      upcomingQty,
      qcPassDateLatest: latestQcDate,
      status,
      statusExplanation: explanation,
      isArchived: !!order.isArchived,
      overallStatus: order.overallStatus,
      currentStage: order.currentStage || 'Pending',
    };

    orderItems.push(item);

    // Aggregate by calendar month (from Feb 2026 onwards)
    if (assignedMonthKey && assignedMonthKey >= '2026-02' && assignedMonthKey <= '2099-12') {
      if (!monthlyMap.has(assignedMonthKey)) {
        monthlyMap.set(assignedMonthKey, {
          totalOrders: 0,
          totalUnits: 0,
          onTimeUnits: 0,
          delayedUnits: 0,
          upcomingUnits: 0,
          onTimeOrders: 0,
          delayedOrders: 0,
          upcomingOrders: 0,
          holdOrders: 0,
        });
      }
      const agg = monthlyMap.get(assignedMonthKey)!;
      agg.totalOrders += 1;
      agg.totalUnits += totalQty;
      agg.onTimeUnits += onTimeQty;
      agg.delayedUnits += delayedQty;
      agg.upcomingUnits += upcomingQty;

      if (status === 'On-Time') {
        agg.onTimeOrders += 1;
      } else if (status === 'Upcoming') {
        agg.upcomingOrders += 1;
      } else if (status === 'On Hold') {
        agg.holdOrders += 1;
      } else {
        agg.delayedOrders += 1;
      }
    }
  });

  // Calculate Weekly Matrices for each month
  const weeklyMatrices: Record<string, WeeklyOtdMonthMatrix> = {};
  const sortedMonthKeys = Array.from(monthlyMap.keys()).sort();

  sortedMonthKeys.forEach((mKey) => {
    weeklyMatrices[mKey] = buildWeeklyOtdMatrix(mKey, orderItems);
  });

  // Calculate Monthly Summaries sorted chronologically
  const monthlySummaries: OnTimeMonthlySummary[] = sortedMonthKeys.map((mKey) => {
    const data = monthlyMap.get(mKey)!;
    const [y, m] = mKey.split('-');
    const mIdx = parseInt(m, 10) - 1;
    const monthDisplay = `${MONTH_NAMES_SHORT[mIdx] || ''} ${y}`;
    const isFutureMonth = mKey > currentMonthKey;
    const weeklyMatrix = weeklyMatrices[mKey];

    // For future months, only calculate percentage if units were due or passed in advance
    const dueUnits = data.onTimeUnits + data.delayedUnits;
    const dueOrders = data.onTimeOrders + data.delayedOrders;

    const unitOnTimePct = dueUnits > 0
      ? Math.round((data.onTimeUnits / dueUnits) * 100)
      : (isFutureMonth ? null : 0);

    const orderOnTimePct = dueOrders > 0
      ? Math.round((data.onTimeOrders / dueOrders) * 100)
      : (isFutureMonth ? null : 0);

    return {
      monthKey: mKey,
      monthDisplay,
      totalOrders: data.totalOrders,
      totalUnits: data.totalUnits,
      onTimeUnits: data.onTimeUnits,
      delayedUnits: data.delayedUnits,
      upcomingUnits: data.upcomingUnits,
      onTimeOrders: data.onTimeOrders,
      delayedOrders: data.delayedOrders,
      upcomingOrders: data.upcomingOrders,
      holdOrders: data.holdOrders,
      unitOnTimePct,
      orderOnTimePct,
      isFutureMonth,
      weeklyMatrix,
    };
  });

  // Calculate Overall aggregates
  const pastSummaries = monthlySummaries.filter(m => !m.isFutureMonth);
  const totalOrders = pastSummaries.reduce((sum, m) => sum + m.totalOrders, 0);
  const totalUnits = pastSummaries.reduce((sum, m) => sum + m.totalUnits, 0);
  const totalOnTimeUnits = pastSummaries.reduce((sum, m) => sum + m.onTimeUnits, 0);
  const totalDelayedUnits = pastSummaries.reduce((sum, m) => sum + m.delayedUnits, 0);
  const totalUpcomingUnits = pastSummaries.reduce((sum, m) => sum + m.upcomingUnits, 0);
  const totalOnTimeOrders = pastSummaries.reduce((sum, m) => sum + m.onTimeOrders, 0);
  const totalDelayedOrders = pastSummaries.reduce((sum, m) => sum + m.delayedOrders, 0);
  const totalUpcomingOrders = pastSummaries.reduce((sum, m) => sum + m.upcomingOrders, 0);

  const totalDueUnits = totalOnTimeUnits + totalDelayedUnits;
  const totalDueOrders = totalOnTimeOrders + totalDelayedOrders;

  const overallUnitOnTimePct = totalDueUnits > 0
    ? Math.round((totalOnTimeUnits / totalDueUnits) * 100)
    : 0;

  const overallOrderOnTimePct = totalDueOrders > 0
    ? Math.round((totalOnTimeOrders / totalDueOrders) * 100)
    : 0;

  return {
    totalOrders,
    totalUnits,
    totalOnTimeUnits,
    totalDelayedUnits,
    totalUpcomingUnits,
    totalOnTimeOrders,
    totalDelayedOrders,
    totalUpcomingOrders,
    totalDueUnits,
    totalDueOrders,
    overallUnitOnTimePct,
    overallOrderOnTimePct,
    monthlySummaries,
    orderItems,
    weeklyMatrices,
  };
};
