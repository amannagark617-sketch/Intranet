import React, { useEffect, useMemo, useState } from 'react';
import {
  Factory,
  PauseCircle,
  Wallet,
  Truck,
  Timer,
  TrendingUp,
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
import { getCachedReadyGoods } from '../services/readyGoodsService';
import { fetchCeoSales } from '../services/ceoSalesService';
import type { CeoSalesSummary, CeoSalesPeriod } from '../services/ceoSalesService';
import { fetchIndoreMetrics, pickHeadlineMetrics, extractIndoreProduction } from '../services/indoreService';
import type { IndoreResult } from '../services/indoreService';

export type TodayTarget =
  | 'dashboard'
  | 'pmsManesar'
  | 'pmsIndore'
  | 'readyGoods'
  | 'readyStock'
  | 'receivableList'
  | 'salesReport'
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
          <Icon className="hidden sm:block w-4 h-4 text-slate-500" />
          {title}
        </span>
        {t.label && (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${t.pill}`}>
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
  <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</h3>
);

const SalesPeriod: React.FC<{
  label: string;
  period: CeoSalesPeriod | null;
  tone: Tone;
  loading: boolean;
}> = ({ label, period, tone, loading }) => {
  const t = TONE_STYLES[tone];
  const pct = period && period.target ? Math.round((period.sales / period.target) * 100) : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          {label}{period ? ` · ${period.label}` : ''}
        </h3>
        {t.label && (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${t.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
        <span className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {period ? formatInr(period.sales) : loading ? '—' : 'n/a'}
        </span>
        {period && period.target ? (
          <span className="text-base text-slate-500">of {formatInr(period.target)} target</span>
        ) : null}
      </div>
      {period && period.target ? (
        <div className="mt-5">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${t.bar === 'bg-slate-200' ? 'bg-indigo-500' : t.bar}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[13px] text-slate-500 tabular-nums">
            <span>{pct}% of target</span>
            <span>{formatInr(Math.max(0, period.target - period.sales))} to go</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-slate-500">{loading ? 'Loading…' : 'No target available'}</p>
      )}
      {period && (
        <p className="mt-3 text-[13px] text-slate-500 tabular-nums">
          {period.orders.toLocaleString()} orders · {period.units.toLocaleString()} chairs
        </p>
      )}
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
    return { month: m, overallUnitPct: metrics.overallUnitOnTimePct, overallOrderPct: metrics.overallOrderOnTimePct };
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

  const [sales, setSales] = useState<CeoSalesSummary | null>(null);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [indore, setIndore] = useState<IndoreResult | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCeoSales(todayYMD())
      .then(r => { if (alive) { setSales(r); setSalesLoaded(true); } })
      .catch(() => { if (alive) setSalesLoaded(true); });
    fetchIndoreMetrics()
      .then(r => { if (alive) setIndore(r); })
      .catch(() => { if (alive) setIndore({ metrics: [], status: 'unavailable' }); });
    return () => { alive = false; };
  }, []);

  // How far through the month / financial year we are, to judge pace against target
  const monthElapsed = (() => {
    const d = new Date();
    return d.getDate() / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  })();
  const fyElapsed = (() => {
    const d = new Date();
    const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const start = new Date(startYear, 3, 1).getTime();
    return Math.min(1, (d.getTime() - start) / (365 * 86400000));
  })();
  const paceTone = (achieved: number, target: number | null, elapsed: number): Tone => {
    if (!target) return 'neutral';
    if (achieved >= target) return 'good';
    const ratio = achieved / target / Math.max(elapsed, 0.05);
    return ratio >= 0.9 ? 'good' : ratio >= 0.7 ? 'watch' : 'bad';
  };

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

  const onTimeVal = otd?.month?.unitOnTimePct;
  const onTimeTone: Tone =
    onTimeVal == null ? 'neutral' : onTimeVal >= 90 ? 'good' : onTimeVal >= 75 ? 'watch' : 'bad';
  const dueTone: Tone = stats.overdueAmount === 0 ? 'good' : 'bad';
  const indoreProd = indore && indore.status === 'ok' ? extractIndoreProduction(indore.metrics) : null;
  const maxBottleneck = Math.max(1, ...stats.bottlenecks.map(b => b.orders));
  const monthTone = sales ? paceTone(sales.month.sales, sales.month.target, monthElapsed) : 'neutral';
  const fyTone = sales ? paceTone(sales.fy.sales, sales.fy.target, fyElapsed) : 'neutral';

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  const pctOf = (a: number, t: number | null) => (t ? Math.round((a / t) * 100) : null);
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  const headline = (() => {
    const parts: string[] = [];
    if (sales) {
      const p = pctOf(sales.month.sales, sales.month.target);
      parts.push(p === null ? `${formatInr(sales.month.sales)} sold this month` : `Sales at ${p}% of the ${monthName} target`);
    }
    if (production && production.target) {
      parts.push(`Manesar production at ${Math.round((production.monthUnits / production.target) * 100)}% of target`);
    }
    if (stats.overdueAmount > 0) parts.push(`${formatInr(stats.overdueAmount)} receivables overdue`);
    return parts.length ? parts.join(' · ') : "Loading today's numbers…";
  })();
  const headlineTone: Tone = monthTone !== 'neutral' ? monthTone : 'good';

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-6">
      <div className="pt-2">
        <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
        <h2 className="mt-1 text-3xl sm:text-[34px] font-semibold text-slate-900 tracking-tight">{greeting}</h2>
        <p className="mt-2 flex items-start gap-2.5 text-[15px] text-slate-600">
          <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${TONE_STYLES[headlineTone].dot}`} />
          {headline}
        </p>
      </div>

      <section>
        <SectionLabel>Sales</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <button
            onClick={() => onNavigate('salesReport')}
            className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
          >
            <SalesPeriod label="This month" period={sales?.month ?? null} tone={monthTone} loading={!salesLoaded} />
          </button>
          <button
            onClick={() => onNavigate('salesReport')}
            className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
          >
            <SalesPeriod label="This financial year" period={sales?.fy ?? null} tone={fyTone} loading={!salesLoaded} />
          </button>
        </div>
        {sales && sales.regions.length > 0 && (
          <button
            onClick={() => onNavigate('salesReport')}
            className="mt-4 w-full text-left bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-slate-900">By showroom · {sales.month.label}</h3>
              <span className="text-[13px] text-slate-500">sales vs target</span>
            </div>
            <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
              {sales.regions.slice(0, 8).map(r => {
                const pct = r.target > 0 ? Math.round((r.sales / r.target) * 100) : null;
                return (
                  <li key={r.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800 truncate">{r.name}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {formatInr(r.sales)}{r.target > 0 ? ` / ${formatInr(r.target)}` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct !== null && pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500/80'}`}
                          style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[13px] font-medium text-slate-500 tabular-nums">{pct !== null ? `${pct}%` : ''}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </button>
        )}
        {salesLoaded && !sales?.hasTargets && sales && (
          <p className="mt-3 text-[13px] text-slate-500">Targets couldn't be read, so sales are shown without a target comparison.</p>
        )}
      </section>

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
                    ? `chairs · ${production.todayOrders} orders passed inspection`
                    : production.lastDay
                    ? `Last: ${production.lastUnits} on ${formatDisplayDate(production.lastDay, false)}`
                    : 'Nothing passed inspection yet'}
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

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Indore</h3>
              <button onClick={() => onNavigate('pmsIndore')} className="flex items-center gap-0.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {!indore ? (
              <p className="flex-1 flex items-center text-sm text-slate-500 py-6">Loading…</p>
            ) : indore.status === 'unavailable' ? (
              <div className="flex-1 flex flex-col justify-center py-6">
                <p className="text-[15px] font-medium text-slate-700">Couldn't read the Indore sheet</p>
                <p className="mt-1.5 text-sm text-slate-500">Check it is shared as "Anyone with the link can view", then refresh.</p>
              </div>
            ) : indoreProd ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[13px] font-medium text-slate-500">Produced today</div>
                    <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {indoreProd.today !== null ? indoreProd.today.toLocaleString() : '—'}
                    </div>
                    <div className="mt-1.5 text-[13px] text-slate-500">chairs</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-slate-500">Produced this month</div>
                    <div className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {indoreProd.month !== null ? indoreProd.month.toLocaleString() : '—'}
                    </div>
                    <div className="mt-1.5 text-[13px] text-slate-500">
                      {indoreProd.target !== null ? `of ${indoreProd.target.toLocaleString()} target` : 'no target set'}
                    </div>
                  </div>
                </div>
                {indoreProd.target !== null && indoreProd.target > 0 && indoreProd.month !== null && (
                  <div className="mt-6">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, (indoreProd.month / indoreProd.target) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[13px] text-slate-500 tabular-nums">
                      <span>{Math.round((indoreProd.month / indoreProd.target) * 100)}% of target</span>
                      <span>{Math.max(0, indoreProd.target - indoreProd.month).toLocaleString()} to go</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
                {pickHeadlineMetrics(indore.metrics, 4).map(m => (
                  <div key={m.label}>
                    <dt className="text-[13px] font-medium text-slate-500 truncate" title={m.label}>{m.label}</dt>
                    <dd className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Factory &amp; delivery</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard
            title="In production"
            value={`${stats.wip.units}`}
            sub={`units across ${stats.wip.count} orders`}
            tone="neutral"
            icon={Factory}
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
          <KpiCard
            title="On-time delivery"
            value={onTimeVal == null ? '—' : `${onTimeVal}%`}
            sub={otd ? `this month · ${otd.overallUnitPct}% till date` : 'Loading…'}
            tone={onTimeTone}
            icon={Timer}
            onClick={() => onNavigate('dashboard')}
          />
        </div>
      </section>

      <section>
        <SectionLabel>Stock &amp; cash</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('readyGoods')}
            className="lg:col-span-2 text-left bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <PackageCheck className="w-4 h-4 text-slate-500" /> Ready goods
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
                <div className="text-[13px] text-slate-500">{readyGoods.readyQty.toLocaleString()} ready</div>
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
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[13px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
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
                    {b.owner && <div className="mt-1.5 text-[13px] text-slate-500">Owner · {b.owner}</div>}
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
