import React, { useEffect, useMemo, useState } from 'react';
import {
  Factory,
  PauseCircle,
  AlertTriangle,
  Truck,
  Timer,
  PackageCheck,
  ReceiptText,
  Sparkles,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { Order, Insight, FinalQcRecord } from '../types';
import type { ReceivableItem } from '../services/receivableListService';
import { STAGE_CONFIGS } from '../constants';
import { normalizeToYMD, diffDaysYMD, formatDisplayDate } from '../utils/dateUtils';
import { fetchFinalQcRecords, getMonthlyTarget } from '../services/qcResponsesService';
import { calculateOnTimePerformance } from '../services/onTimeDeliveryService';
import type { OnTimeOrderItem } from '../services/onTimeDeliveryService';
import { getCachedReadyGoods } from '../services/readyGoodsService';

export type TodayTarget =
  | 'dashboard'
  | 'pmsManesar'
  | 'pmsIndore'
  | 'readyGoods'
  | 'readyStock'
  | 'receivableList'
  | 'overtime';

interface TodayHomeProps {
  orders: Order[];
  readyGoodsUnits: number;
  readyStockUnits: number;
  receivables: ReceivableItem[];
  onNavigate: (target: TodayTarget) => void;
  onGenerateInsights: () => Promise<Insight[]>;
}

type Tone = 'good' | 'watch' | 'bad' | 'neutral';

const TONE_STYLES: Record<Tone, { pill: string; dot: string; bar: string; label: string }> = {
  good: { pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'On track' },
  watch: { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', bar: 'bg-amber-400', label: 'Watch' },
  bad: { pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', bar: 'bg-rose-500', label: 'Attention' },
  neutral: { pill: '', dot: '', bar: 'bg-slate-200', label: '' },
};

const todayYMD = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatInr = (amount: number): string => {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

const KpiCard: React.FC<{
  title: string;
  value: string;
  sub: string;
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  className?: string;
}> = ({ title, value, sub, tone, icon: Icon, onClick, className = '' }) => {
  const t = TONE_STYLES[tone];
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden text-left bg-white rounded-2xl border border-slate-200/80 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.18)] hover:border-slate-300 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
      <div className="flex items-center justify-between gap-2 min-h-[24px]">
        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
          <Icon className="hidden sm:block w-4 h-4 text-slate-400" />
          {title}
        </span>
        {t.label && (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            <span className="hidden sm:inline">{t.label}</span>
          </span>
        )}
      </div>
      <div className="mt-3 sm:mt-4 text-3xl sm:text-[44px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      <div className="mt-3 flex items-end justify-between gap-3 text-[13px] leading-snug text-slate-500">
        <span>{sub}</span>
        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{children}</h3>
);

const OTD_PILL: Record<string, string> = {
  'On-Time': 'bg-emerald-50 text-emerald-700',
  'Partially Delayed': 'bg-amber-50 text-amber-700',
  Delayed: 'bg-rose-50 text-rose-700',
  Upcoming: 'bg-slate-100 text-slate-600',
};

const PctBlock: React.FC<{ label: string; pct: number | null | undefined; sub: string }> = ({ label, pct, sub }) => {
  const tone: Tone = pct == null ? 'neutral' : pct >= 90 ? 'good' : pct >= 75 ? 'watch' : 'bad';
  const t = TONE_STYLES[tone];
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        {label}
        {t.label && (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        )}
      </div>
      <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {pct == null ? '—' : `${pct}%`}
      </div>
      <div className="mt-1.5 text-[13px] text-slate-500">{sub}</div>
    </div>
  );
};

const TodayHome: React.FC<TodayHomeProps> = ({
  orders,
  readyGoodsUnits,
  readyStockUnits,
  receivables,
  onNavigate,
  onGenerateInsights,
}) => {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const today = todayYMD();
    const month = today.substring(0, 7);
    const live = orders.filter(o => !o.isArchived);
    const units = (list: Order[]) => list.reduce((s, o) => s + (o.quantity || 0), 0);

    const isHold = (o: Order) =>
      o.overallStatus === 'On Hold' ||
      (o.dispatchDate ? o.dispatchDate.toUpperCase().includes('HOLD') : false);

    const open = live.filter(o => o.overallStatus !== 'Dispatched');
    const wip = open.filter(o => o.overallStatus === 'WIP' && !isHold(o));
    const hold = open.filter(isHold);

    // Late = still on the floor and past its planned dispatch date
    const late = open.filter(o => {
      if (isHold(o)) return false;
      const d = normalizeToYMD(o.dispatchDate);
      return d ? diffDaysYMD(today, d) > 0 : false;
    });

    const dispatchedMonth = orders.filter(
      o => o.overallStatus === 'Dispatched' && (normalizeToYMD(o.dispatchDate) || '').startsWith(month)
    );

    // On-time: Final QC cleared on/before the planned dispatch date, for this month's dispatch dates
    let onTime = 0;
    let measured = 0;
    orders.forEach(o => {
      const d = normalizeToYMD(o.dispatchDate);
      if (!d || !d.startsWith(month)) return;
      const qc = o.steps.find(s => s.name === 'QUALITY CONTROL');
      const qcDate = normalizeToYMD(qc?.actualDate);
      if (qc && qc.status === 'Completed' && qcDate) {
        measured++;
        if (diffDaysYMD(qcDate, d) <= 0) onTime++;
      }
    });
    const onTimePct = measured > 0 ? Math.round((onTime / measured) * 100) : null;

    // Bottlenecks: stages holding the most active WIP orders
    const byStage = new Map<string, { orders: number; units: number }>();
    wip.forEach(o => {
      if (!o.currentStage) return;
      const cur = byStage.get(o.currentStage) || { orders: 0, units: 0 };
      cur.orders += 1;
      cur.units += o.quantity || 0;
      byStage.set(o.currentStage, cur);
    });
    const bottlenecks = Array.from(byStage.entries())
      .map(([stage, v]) => ({
        stage,
        ...v,
        owner: (STAGE_CONFIGS as Record<string, { responsible?: string }>)[stage]?.responsible || '',
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3);

    // Receivables
    const outstanding = receivables.reduce((s, r) => s + (r.balanceAmount || 0), 0);
    const overdueItems = receivables.filter(r => {
      const due = normalizeToYMD(r.newDueDate || r.dueDate);
      return (r.balanceAmount || 0) > 0 && due ? diffDaysYMD(today, due) > 0 : false;
    });
    const overdueAmount = overdueItems.reduce((s, r) => s + (r.balanceAmount || 0), 0);

    return {
      wip: { count: wip.length, units: units(wip) },
      hold: { count: hold.length, units: units(hold) },
      late: { count: late.length, units: units(late) },
      dispatchedMonth: { count: dispatchedMonth.length, units: units(dispatchedMonth) },
      onTimePct,
      measured,
      bottlenecks,
      outstanding,
      overdueAmount,
      overdueCount: overdueItems.length,
    };
  }, [orders, receivables]);

  // Final QC sheet drives production + on-time numbers
  const [qcRecords, setQcRecords] = useState<FinalQcRecord[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchFinalQcRecords(false)
      .then(r => { if (alive) setQcRecords(r); })
      .catch(() => { if (alive) setQcRecords([]); });
    return () => { alive = false; };
  }, []);

  const [showAllOtd, setShowAllOtd] = useState(false);

  const production = useMemo(() => {
    if (!qcRecords) return null;
    const today = todayYMD();
    const month = today.slice(0, 7);
    const passed = qcRecords.filter(r => r.status === 'Pass' || r.passQuantity > 0);
    const units = (list: FinalQcRecord[]) => list.reduce((s, r) => s + (r.passQuantity || 0), 0);
    const todayRecs = passed.filter(r => r.dateYMD === today);
    const monthRecs = passed.filter(r => r.monthKey === month);
    const pastDays = Array.from(new Set(passed.map(r => r.dateYMD).filter(d => d && d < today))).sort();
    const lastDay = pastDays.length ? pastDays[pastDays.length - 1] : null;
    const lastUnits = lastDay ? units(passed.filter(r => r.dateYMD === lastDay)) : 0;
    return {
      todayUnits: units(todayRecs),
      todayOrders: new Set(todayRecs.map(r => r.opfNo)).size,
      monthUnits: units(monthRecs),
      target: getMonthlyTarget(month),
      lastDay,
      lastUnits,
    };
  }, [qcRecords]);

  const otd = useMemo(() => {
    if (!qcRecords) return null;
    const today = todayYMD();
    const month = today.slice(0, 7);
    const metrics = calculateOnTimePerformance(orders, qcRecords, today);
    const m = metrics.monthlySummaries.find(x => x.monthKey === month) || null;
    const rank = (o: OnTimeOrderItem) =>
      o.status === 'Delayed' ? 0 : o.status === 'Partially Delayed' ? 1 : o.status === 'Upcoming' ? 2 : 3;
    const rows = metrics.orderItems
      .filter(o => o.assignedMonthKey === month && o.status !== 'On Hold')
      .sort((a, b) => rank(a) - rank(b) || (a.dispatchYMD || '').localeCompare(b.dispatchYMD || ''));
    return { month: m, overallUnitPct: metrics.overallUnitOnTimePct, overallOrderPct: metrics.overallOrderOnTimePct, rows };
  }, [qcRecords, orders]);

  const readyGoods = useMemo(() => {
    const items = getCachedReadyGoods();
    const sum = (f: (i: (typeof items)[number]) => number) => items.reduce((a, i) => a + (f(i) || 0), 0);
    return {
      orders: items.length,
      orderQty: sum(i => i.orderQty),
      readyQty: sum(i => i.readyGoodsQty),
      gross: sum(i => i.grossAmount),
      balance: sum(i => i.balancePayment),
    };
  }, []);

  const runInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      setInsights(await onGenerateInsights());
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : 'Could not generate summary right now.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const onTimeTone: Tone =
    stats.onTimePct === null ? 'neutral' : stats.onTimePct >= 90 ? 'good' : stats.onTimePct >= 75 ? 'watch' : 'bad';
  const lateTone: Tone = stats.late.count === 0 ? 'good' : stats.late.count <= 5 ? 'watch' : 'bad';
  const holdTone: Tone = stats.hold.count === 0 ? 'good' : stats.hold.count <= 5 ? 'watch' : 'bad';
  const dueTone: Tone = stats.overdueAmount === 0 ? 'good' : 'bad';
  const maxBottleneck = Math.max(1, ...stats.bottlenecks.map(b => b.orders));

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  const headline = (() => {
    const parts: string[] = [];
    if (stats.late.count > 0)
      parts.push(`${stats.late.count} ${stats.late.count === 1 ? 'order is' : 'orders are'} past the dispatch date`);
    if (stats.hold.count > 0) parts.push(`${stats.hold.count} on hold`);
    if (stats.overdueAmount > 0) parts.push(`${formatInr(stats.overdueAmount)} in receivables overdue`);
    if (parts.length === 0) return 'Everything is on track. Nothing needs attention right now.';
    return parts.join(' · ');
  })();
  const headlineTone: Tone =
    stats.late.count > 5 || stats.overdueAmount > 0
      ? 'bad'
      : stats.late.count > 0 || stats.hold.count > 0
      ? 'watch'
      : 'good';

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-6">
      <div className="pt-2">
        <p className="text-sm font-medium text-slate-400">{dateLabel}</p>
        <h2 className="mt-1 text-3xl sm:text-[34px] font-semibold text-slate-900 tracking-tight">{greeting}</h2>
        <p className="mt-2 flex items-start gap-2.5 text-[15px] text-slate-600">
          <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${TONE_STYLES[headlineTone].dot}`} />
          {headline}
        </p>
      </div>

      <section>
        <SectionLabel>Production</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Manesar</h3>
              <button onClick={() => onNavigate('pmsManesar')} className="flex items-center gap-0.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <div className="text-[13px] font-medium text-slate-500">Produced today</div>
                <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {production ? production.todayUnits : '—'}
                </div>
                <div className="mt-1.5 text-[13px] text-slate-500">
                  {!production
                    ? 'Loading…'
                    : production.todayUnits > 0
                    ? `chairs · ${production.todayOrders} orders passed QC`
                    : production.lastDay
                    ? `Last: ${production.lastUnits} on ${formatDisplayDate(production.lastDay, false)}`
                    : 'Nothing passed QC yet'}
                </div>
              </div>
              <div>
                <div className="text-[13px] font-medium text-slate-500">Produced this month</div>
                <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {production ? production.monthUnits.toLocaleString() : '—'}
                </div>
                <div className="mt-1.5 text-[13px] text-slate-500">
                  {production ? `of ${production.target.toLocaleString()} target` : 'Loading…'}
                </div>
              </div>
            </div>
            {production && (
              <div className="mt-6">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(100, production.target ? (production.monthUnits / production.target) * 100 : 0)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[13px] text-slate-500 tabular-nums">
                  <span>{production.target ? Math.round((production.monthUnits / production.target) * 100) : 0}% of target</span>
                  <span>{Math.max(0, production.target - production.monthUnits).toLocaleString()} to go</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Indore</h3>
              <button onClick={() => onNavigate('pmsIndore')} className="flex items-center gap-0.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                Open PMS <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex flex-col justify-center py-6">
              <p className="text-[15px] font-medium text-slate-700">Indore numbers aren't connected yet</p>
              <p className="mt-1.5 text-sm text-slate-500">
                Indore runs in its own PMS, so today's production, month-to-date and target can't be pulled in here until its data sheet is linked.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Factory floor</SectionLabel>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="In production"
            value={`${stats.wip.units}`}
            sub={`units across ${stats.wip.count} orders`}
            tone="neutral"
            icon={Factory}
            onClick={() => onNavigate('pmsManesar')}
          />
          <KpiCard
            title="Past dispatch date"
            value={`${stats.late.count}`}
            sub={`orders · ${stats.late.units} units not yet dispatched`}
            tone={lateTone}
            icon={AlertTriangle}
            onClick={() => onNavigate('pmsManesar')}
          />
          <KpiCard
            title="On hold"
            value={`${stats.hold.count}`}
            sub={`orders · ${stats.hold.units} units`}
            tone={holdTone}
            icon={PauseCircle}
            onClick={() => onNavigate('pmsManesar')}
          />
          <KpiCard
            title="Dispatched this month"
            value={`${stats.dispatchedMonth.units}`}
            sub={`units across ${stats.dispatchedMonth.count} orders`}
            tone="neutral"
            icon={Truck}
            onClick={() => onNavigate('dashboard')}
          />
        </div>
      </section>

      <section>
        <SectionLabel>On-time delivery</SectionLabel>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
            <PctBlock
              label="This month"
              pct={otd?.month?.unitOnTimePct}
              sub={otd?.month ? `chairs · ${otd.month.orderOnTimePct ?? '—'}% of orders · ${otd.month.delayedOrders} delayed` : qcRecords ? 'No orders due yet' : 'Loading…'}
            />
            <PctBlock
              label="Till date"
              pct={otd ? otd.overallUnitPct : null}
              sub={otd ? `chairs · ${otd.overallOrderPct}% of orders` : 'Loading…'}
            />
          </div>

          {otd && otd.rows.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Order-wise · this month</h4>
                <span className="text-[13px] text-slate-400">{otd.rows.length} orders</span>
              </div>
              <div className="mt-3 overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[520px] text-sm text-left">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="py-2 font-medium">Order</th>
                      <th className="py-2 font-medium">Model</th>
                      <th className="py-2 font-medium text-right">Qty</th>
                      <th className="py-2 font-medium text-right">Due</th>
                      <th className="py-2 font-medium text-right">QC passed</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {(showAllOtd ? otd.rows : otd.rows.slice(0, 8)).map(o => (
                      <tr key={o.opfNo} className="text-slate-600">
                        <td className="py-2.5 font-medium text-slate-900">{o.opfNo}</td>
                        <td className="py-2.5 truncate max-w-[160px]">{o.modelName}</td>
                        <td className="py-2.5 text-right">{o.totalQty}</td>
                        <td className="py-2.5 text-right">{formatDisplayDate(o.dispatchYMD, false)}</td>
                        <td className="py-2.5 text-right">{o.qcPassDateLatest ? formatDisplayDate(o.qcPassDateLatest, false) : '—'}</td>
                        <td className="py-2.5 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${OTD_PILL[o.status] || 'bg-slate-100 text-slate-600'}`}>
                            {o.status === 'Partially Delayed' ? 'Part delayed' : o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {otd.rows.length > 8 && (
                <button
                  onClick={() => setShowAllOtd(v => !v)}
                  className="mt-3 text-[13px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {showAllOtd ? 'Show fewer' : `Show all ${otd.rows.length} orders`}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionLabel>Ready goods &amp; receivables</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('readyGoods')}
            className="lg:col-span-2 text-left bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <PackageCheck className="w-4 h-4 text-slate-400" /> Ready goods
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div>
                <div className="text-[13px] text-slate-500">Orders</div>
                <div className="mt-1.5 text-3xl font-semibold text-slate-900 tabular-nums">{readyGoods.orders}</div>
              </div>
              <div>
                <div className="text-[13px] text-slate-500">Order qty</div>
                <div className="mt-1.5 text-3xl font-semibold text-slate-900 tabular-nums">{readyGoods.orderQty.toLocaleString()}</div>
                <div className="text-xs text-slate-400">{readyGoods.readyQty.toLocaleString()} ready</div>
              </div>
              <div>
                <div className="text-[13px] text-slate-500">Amount</div>
                <div className="mt-1.5 text-3xl font-semibold text-slate-900 tabular-nums">{formatInr(readyGoods.gross)}</div>
              </div>
              <div>
                <div className="text-[13px] text-slate-500">Balance to collect</div>
                <div className="mt-1.5 text-3xl font-semibold text-slate-900 tabular-nums">{formatInr(readyGoods.balance)}</div>
              </div>
            </div>
          </button>
          <KpiCard
            title="Receivables outstanding"
            value={formatInr(stats.outstanding)}
            sub={
              stats.overdueAmount > 0
                ? `${formatInr(stats.overdueAmount)} overdue across ${stats.overdueCount} invoices`
                : 'Nothing overdue'
            }
            tone={dueTone}
            icon={ReceiptText}
            onClick={() => onNavigate('receivableList')}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Where orders are stuck</h3>
          <p className="text-[13px] text-slate-500 mt-0.5">The stages holding the most orders right now</p>
          {stats.bottlenecks.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No active orders on the floor.</p>
          ) : (
            <ol className="mt-6 space-y-5">
              {stats.bottlenecks.map((b, i) => (
                <li key={b.stage} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-slate-800 capitalize truncate">{b.stage.toLowerCase()}</span>
                      <span className="text-[13px] text-slate-500 shrink-0 tabular-nums">
                        {b.orders} orders · {b.units} units
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500/80"
                        style={{ width: `${(b.orders / maxBottleneck) * 100}%` }}
                      />
                    </div>
                    {b.owner && <div className="mt-1.5 text-xs text-slate-400">Owner · {b.owner}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">AI summary</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">A plain-language read of today's numbers</p>
            </div>
            <button
              onClick={runInsights}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 rounded-lg text-[13px] font-semibold cursor-pointer shrink-0 transition-colors"
            >
              {insightsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {insights ? 'Refresh' : 'Generate'}
            </button>
          </div>
          {insightsError && <p className="mt-6 text-sm text-rose-600">{insightsError}</p>}
          {!insights && !insightsError && !insightsLoading && (
            <p className="mt-6 text-sm text-slate-500">Press Generate for a short summary of what needs attention.</p>
          )}
          {insights && (
            <ul className="mt-6 space-y-4">
              {insights.slice(0, 4).map((ins, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${
                      ins.severity === 'critical'
                        ? 'bg-rose-500'
                        : ins.severity === 'warning'
                        ? 'bg-amber-500'
                        : ins.severity === 'positive'
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div>
                    <div className="text-[15px] font-medium text-slate-800">{ins.title}</div>
                    <div className="mt-0.5 text-sm leading-relaxed text-slate-500">{ins.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default TodayHome;
