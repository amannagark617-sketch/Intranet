import React, { useMemo, useState } from 'react';
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
import type { Order, Insight } from '../types';
import type { ReceivableItem } from '../services/receivableListService';
import { STAGE_CONFIGS } from '../constants';
import { normalizeToYMD, diffDaysYMD } from '../utils/dateUtils';

export type TodayTarget =
  | 'dashboard'
  | 'pmsManesar'
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

const TONE_STYLES: Record<Tone, { dot: string; value: string; label: string }> = {
  good: { dot: 'bg-emerald-500', value: 'text-slate-900', label: 'On track' },
  watch: { dot: 'bg-amber-500', value: 'text-slate-900', label: 'Watch' },
  bad: { dot: 'bg-rose-500', value: 'text-rose-700', label: 'Needs attention' },
  neutral: { dot: 'bg-slate-300', value: 'text-slate-900', label: '' },
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
}> = ({ title, value, sub, tone, icon: Icon, onClick }) => {
  const t = TONE_STYLES[tone];
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
          {t.label}
        </span>
      </div>
      <div className={`mt-3 text-4xl sm:text-5xl font-bold tracking-tight ${t.value}`}>{value}</div>
      <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
        <span>{sub}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Today</h2>
        <p className="text-slate-500 mt-1">{dateLabel}</p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="In production"
          value={`${stats.wip.units}`}
          sub={`units · ${stats.wip.count} orders on the floor`}
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
          sub={`units · ${stats.dispatchedMonth.count} orders`}
          tone="neutral"
          icon={Truck}
          onClick={() => onNavigate('dashboard')}
        />
        <KpiCard
          title="On-time delivery"
          value={stats.onTimePct === null ? '—' : `${stats.onTimePct}%`}
          sub={stats.measured ? `${stats.measured} orders measured this month` : 'No QC data for this month yet'}
          tone={onTimeTone}
          icon={Timer}
          onClick={() => onNavigate('dashboard')}
        />
        <KpiCard
          title="Ready to dispatch"
          value={`${readyGoodsUnits + readyStockUnits}`}
          sub={`units · ${readyGoodsUnits} ready goods, ${readyStockUnits} ready stock`}
          tone="neutral"
          icon={PackageCheck}
          onClick={() => onNavigate('readyGoods')}
        />
        <KpiCard
          title="Receivables outstanding"
          value={formatInr(stats.outstanding)}
          sub={
            stats.overdueAmount > 0
              ? `${formatInr(stats.overdueAmount)} overdue · ${stats.overdueCount} invoices`
              : 'Nothing overdue'
          }
          tone={dueTone}
          icon={ReceiptText}
          onClick={() => onNavigate('receivableList')}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-slate-900">Where orders are stuck</h3>
          <p className="text-sm text-slate-500 mt-0.5">Stages holding the most orders right now</p>
          {stats.bottlenecks.length === 0 ? (
            <p className="mt-4 text-slate-500">No active orders on the floor.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {stats.bottlenecks.map(b => (
                <li key={b.stage}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-slate-800 capitalize">{b.stage.toLowerCase()}</span>
                    <span className="text-sm text-slate-600 shrink-0">
                      {b.orders} orders · {b.units} units
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(b.orders / maxBottleneck) * 100}%` }}
                    />
                  </div>
                  {b.owner && <div className="mt-1 text-xs text-slate-500">Owner: {b.owner}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI summary</h3>
              <p className="text-sm text-slate-500 mt-0.5">Plain-language read of today's numbers</p>
            </div>
            <button
              onClick={runInsights}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-sm font-semibold cursor-pointer shrink-0"
            >
              {insightsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {insights ? 'Refresh' : 'Generate'}
            </button>
          </div>
          {insightsError && <p className="mt-4 text-sm text-rose-600">{insightsError}</p>}
          {!insights && !insightsError && !insightsLoading && (
            <p className="mt-4 text-slate-500">Tap Generate for a short summary of what needs attention.</p>
          )}
          {insights && (
            <ul className="mt-4 space-y-3">
              {insights.slice(0, 4).map((ins, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-2 w-2.5 h-2.5 rounded-full shrink-0 ${
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
                    <div className="font-semibold text-slate-800">{ins.title}</div>
                    <div className="text-sm text-slate-600">{ins.description}</div>
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
