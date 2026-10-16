import React from 'react';
import {
  RefreshCw,
  Home,
  LineChart,
  PackageCheck,
  ReceiptText,
  Armchair,
  Factory,
  Clock,
  Headphones,
  TrendingUp,
  FolderKanban,
  BadgePercent,
  Bot,
} from 'lucide-react';

export type ViewMode =
  | 'today'
  | 'dailySummary'
  | 'dashboard'
  | 'readyGoods'
  | 'readyStock'
  | 'receivableList'
  | 'pmsManesar'
  | 'pmsIndore'
  | 'overtime'
  | 'serviceComplaints'
  | 'salesReport'
  | 'executiveHub'
  | 'grossProfit';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalOrders: number;
  holdCount?: number;
  holdUnits?: number;
  readyGoodsUnits?: number;
  readyStockUnits?: number;
  receivablesCount?: number;
  onOpenAIAgent?: () => void;
}

type IconType = React.ComponentType<{ className?: string }>;

interface NavPage {
  id: ViewMode;
  label: string;
  icon: IconType;
  badge?: number;
}

interface NavGroup {
  id: string;
  label: string;
  icon: IconType;
  pages: NavPage[];
}

const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  onRefresh,
  isRefreshing,
  readyGoodsUnits,
  readyStockUnits,
  receivablesCount,
  onOpenAIAgent,
}) => {
  const groups: NavGroup[] = [
    {
      id: 'today',
      label: 'Today',
      icon: Home,
      pages: [
        { id: 'today', label: 'Overview', icon: Home },
        { id: 'dailySummary', label: 'Daily summary', icon: Home },
      ],
    },
    {
      id: 'production',
      label: 'Production',
      icon: Factory,
      pages: [
        { id: 'dashboard', label: 'Overview', icon: LineChart },
        { id: 'pmsManesar', label: 'Manesar', icon: Factory },
        { id: 'pmsIndore', label: 'Indore', icon: Factory },
      ],
    },
    {
      id: 'stockSales',
      label: 'Stock & Sales',
      icon: TrendingUp,
      pages: [
        { id: 'readyGoods', label: 'Ready Goods', icon: PackageCheck, badge: readyGoodsUnits },
        { id: 'readyStock', label: 'Ready Stock', icon: Armchair, badge: readyStockUnits },
        { id: 'salesReport', label: 'Sale Report', icon: TrendingUp },
        { id: 'grossProfit', label: 'Real-Time GP', icon: BadgePercent },
        { id: 'receivableList', label: 'Receivables', icon: ReceiptText, badge: receivablesCount },
      ],
    },
    {
      id: 'more',
      label: 'More',
      icon: FolderKanban,
      pages: [
        { id: 'overtime', label: 'Overtime', icon: Clock },
        { id: 'serviceComplaints', label: 'Complaints', icon: Headphones },
        { id: 'executiveHub', label: 'RG Directory', icon: FolderKanban },
      ],
    },
  ];

  const activeGroup = groups.find(g => g.pages.some(p => p.id === viewMode)) || groups[0];
  const showSubNav = activeGroup.pages.length > 1;

  return (
    <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-8">
        {/* Top row: brand, primary groups, actions */}
        <div className="flex items-center justify-between gap-3 py-2.5 md:py-3">
          <button
            onClick={() => onViewModeChange('today')}
            className="flex items-center gap-3 min-w-0 cursor-pointer"
            title="Go to Today"
          >
            <div className="h-9 px-2 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png"
                alt="Little Nap Recliners Logo"
                className="h-6 w-auto object-contain max-w-[110px]"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="hidden sm:block text-lg font-bold text-slate-900 tracking-tight truncate">
              Little Nap Recliners
            </h1>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {groups.map(g => {
              const Icon = g.icon;
              const isActive = g.id === activeGroup.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onViewModeChange(g.pages[0].id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-indigo-700 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {g.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenAIAgent && (
              <button
                onClick={onOpenAIAgent}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer min-h-[36px]"
                title="Ask AI about your data"
              >
                <Bot className="w-4 h-4" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium cursor-pointer min-h-[36px]"
              title="Refresh latest data from all Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Mobile primary groups */}
        <nav className="flex md:hidden items-center gap-1 pb-2" aria-label="Main">
          {groups.map(g => {
            const Icon = g.icon;
            const isActive = g.id === activeGroup.id;
            return (
              <button
                key={g.id}
                onClick={() => onViewModeChange(g.pages[0].id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{g.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sub navigation for the active group */}
        {showSubNav && (
          <nav
            className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none"
            aria-label={activeGroup.label}
          >
            {activeGroup.pages.map(p => {
              const isActive = p.id === viewMode;
              return (
                <button
                  key={p.id}
                  onClick={() => onViewModeChange(p.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 md:py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-indigo-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="whitespace-nowrap">{p.label}</span>
                  {typeof p.badge === 'number' && p.badge > 0 && (
                    <span className="px-1.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
