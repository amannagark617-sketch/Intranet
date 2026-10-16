import React, { useRef, useEffect } from 'react';
import { 
  BarChart3, 
  RefreshCw, 
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
  Bot
} from 'lucide-react';

interface HeaderProps {
  viewMode: 'dashboard' | 'readyGoods' | 'readyStock' | 'receivableList' | 'pmsManesar' | 'pmsIndore' | 'overtime' | 'serviceComplaints' | 'salesReport' | 'executiveHub' | 'grossProfit';
  onViewModeChange: (mode: 'dashboard' | 'readyGoods' | 'readyStock' | 'receivableList' | 'pmsManesar' | 'pmsIndore' | 'overtime' | 'serviceComplaints' | 'salesReport' | 'executiveHub' | 'grossProfit') => void;
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

const Header: React.FC<HeaderProps> = ({ 
  viewMode, 
  onViewModeChange, 
  onRefresh, 
  isRefreshing,
  totalOrders,
  readyGoodsUnits,
  readyStockUnits,
  receivablesCount,
  onOpenAIAgent
}) => {
  const activeMobileTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeMobileTabRef.current) {
      activeMobileTabRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [viewMode]);

  const mobileNavItems: Array<{
    id: HeaderProps['viewMode'];
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    activeClass: string;
    inactiveClass: string;
  }> = [
    { id: 'executiveHub', label: 'RG Directory', icon: FolderKanban, activeClass: 'bg-indigo-600 text-white shadow-xs', inactiveClass: 'bg-slate-100 text-indigo-900 border-slate-200' },
    { id: 'dashboard', label: 'Dashboard', icon: LineChart, activeClass: 'bg-amber-600 text-white shadow-xs', inactiveClass: 'bg-amber-50 text-amber-900 border-amber-200' },
    { id: 'pmsManesar', label: 'Manesar', icon: Factory, activeClass: 'bg-slate-900 text-yellow-400 shadow-xs', inactiveClass: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'pmsIndore', label: 'Indore', icon: Factory, activeClass: 'bg-slate-900 text-cyan-400 shadow-xs', inactiveClass: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'readyGoods', label: 'Ready Goods', icon: PackageCheck, badge: readyGoodsUnits, activeClass: 'bg-emerald-700 text-white shadow-xs', inactiveClass: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    { id: 'readyStock', label: 'Ready Stock', icon: Armchair, badge: readyStockUnits, activeClass: 'bg-amber-500 text-white shadow-xs', inactiveClass: 'bg-amber-50 text-amber-900 border-amber-200' },
    { id: 'overtime', label: 'Overtime', icon: Clock, activeClass: 'bg-orange-600 text-white shadow-xs', inactiveClass: 'bg-orange-50 text-orange-900 border-orange-200' },
    { id: 'receivableList', label: 'Receivables', icon: ReceiptText, badge: receivablesCount, activeClass: 'bg-indigo-600 text-white shadow-xs', inactiveClass: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
    { id: 'grossProfit', label: 'Real-Time GP', icon: BadgePercent, activeClass: 'bg-teal-700 text-white shadow-xs', inactiveClass: 'bg-teal-50 text-teal-900 border-teal-200' },
    { id: 'salesReport', label: 'Sale Report', icon: TrendingUp, activeClass: 'bg-blue-600 text-white shadow-xs', inactiveClass: 'bg-blue-50 text-blue-900 border-blue-200' },
    { id: 'serviceComplaints', label: 'Complaints', icon: Headphones, activeClass: 'bg-rose-600 text-white shadow-xs', inactiveClass: 'bg-rose-50 text-rose-900 border-rose-200' },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 shadow-xs">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-8 py-2.5 md:py-3">
        {/* DESKTOP VIEW (Visible md and above) - 100% UNCHANGED FOR WEB USERS */}
        <div className="hidden md:flex justify-between items-center gap-4">
          {/* Left Title & Branding */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 px-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs overflow-hidden">
                <img 
                  src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png" 
                  alt="Little Nap Recliners Logo" 
                  className="h-7 w-auto object-contain max-w-[130px]" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                  Little Nap Recliners
                </h1>
              </div>
            </div>
          </div>

          {/* Categorized View Switchers & Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {/* GROUP 1: DIRECTORY & LEADERSHIP */}
              <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                <button
                  onClick={() => onViewModeChange('executiveHub')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'executiveHub'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-900 hover:text-indigo-950 hover:bg-indigo-100/70'
                  }`}
                  title="RG Directory - Master directory of leadership sheets, MIS scores, financial planning, portals, and corporate archives"
                >
                  <FolderKanban className={`w-3.5 h-3.5 ${viewMode === 'executiveHub' ? 'text-white' : 'text-indigo-600'}`} />
                  <span>RG Directory</span>
                </button>
              </div>

              {/* GROUP 2: PRODUCTION & PLANT OPERATIONS */}
              <div className="flex items-center p-1 bg-amber-50/70 rounded-xl border border-amber-200/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800/80 px-2 select-none">
                  Production
                </span>
                
                <button
                  onClick={() => onViewModeChange('dashboard')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'dashboard'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-900 hover:text-amber-950 hover:bg-amber-100/80'
                  }`}
                  title="Executive Production Dashboard with Target, In Queue, Dispatch & Monthly Performance"
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => onViewModeChange('pmsManesar')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'pmsManesar'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-amber-100/80'
                  }`}
                  title="PMS @ Manesar - Pipeline Cards, Planning Calendar, Hold Orders, Bottlenecks & Data Sheet"
                >
                  <Factory className={`w-3.5 h-3.5 ${viewMode === 'pmsManesar' ? 'text-yellow-400' : 'text-amber-700'}`} />
                  <span>Manesar</span>
                </button>

                <button
                  onClick={() => onViewModeChange('pmsIndore')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'pmsIndore'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-amber-100/80'
                  }`}
                  title="PMS @ Indore - Indore Factory Production Dashboard & Pipeline"
                >
                  <Factory className={`w-3.5 h-3.5 ${viewMode === 'pmsIndore' ? 'text-cyan-400' : 'text-amber-700'}`} />
                  <span>Indore</span>
                </button>

                <button
                  onClick={() => onViewModeChange('readyGoods')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'readyGoods'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-emerald-900 hover:text-emerald-950 hover:bg-amber-100/80'
                  }`}
                  title="Ready Goods Dashboard - Aging, Warehouse & Payment Tracking"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Ready Goods</span>
                </button>

                <button
                  onClick={() => onViewModeChange('readyStock')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'readyStock'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-900 hover:text-amber-950 hover:bg-amber-100/80'
                  }`}
                  title="Ready Stock in Factory - Available for Immediate Sales Purpose"
                >
                  <Armchair className="w-3.5 h-3.5" />
                  <span>Ready Stock</span>
                </button>

                <button
                  onClick={() => onViewModeChange('overtime')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'overtime'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-orange-900 hover:text-orange-950 hover:bg-amber-100/80'
                  }`}
                  title="Workforce Overtime Tracker - Portal & PMS Step-Wise Overtime Analysis"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Overtime</span>
                </button>
              </div>

              {/* GROUP 3: FINANCE & COMMERCIAL */}
              <div className="flex items-center p-1 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800/80 px-2 select-none">
                  Finance
                </span>

                <button
                  onClick={() => onViewModeChange('receivableList')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'receivableList'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-emerald-100/80'
                  }`}
                  title="Receivable List Dashboard - FMS Payment Follow-Up & Balances"
                >
                  <ReceiptText className={`w-3.5 h-3.5 ${viewMode === 'receivableList' ? 'text-white' : 'text-emerald-700'}`} />
                  <span>Receivables</span>
                </button>

                <button
                  onClick={() => onViewModeChange('grossProfit')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'grossProfit'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-teal-900 hover:text-teal-950 hover:bg-emerald-100/80'
                  }`}
                  title="Real-Time Gross Profit - Live revenue, RM costs, gross margins %, order forms, and salesperson metrics"
                >
                  <BadgePercent className={`w-3.5 h-3.5 ${viewMode === 'grossProfit' ? 'text-white' : 'text-teal-700'}`} />
                  <span>Real-Time GP</span>
                </button>
              </div>

              {/* GROUP 4: SALES & SERVICE */}
              <div className="flex items-center p-1 bg-blue-50/70 rounded-xl border border-blue-200/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800/80 px-2 select-none">
                  Sales & Service
                </span>

                <button
                  onClick={() => onViewModeChange('salesReport')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'salesReport'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-900 hover:text-blue-950 hover:bg-blue-100/80'
                  }`}
                  title="Sale Report & Admin Team Performance - Live gross/net sales, order quantities, regions, and salesperson performance"
                >
                  <TrendingUp className={`w-3.5 h-3.5 ${viewMode === 'salesReport' ? 'text-white' : 'text-blue-600'}`} />
                  <span>Sale Report</span>
                </button>

                <button
                  onClick={() => onViewModeChange('serviceComplaints')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'serviceComplaints'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-900 hover:text-rose-950 hover:bg-blue-100/80'
                  }`}
                  title="Service Open Complaint Tracker - Real-time customer issues, warranty, and technician dispatch"
                >
                  <Headphones className={`w-3.5 h-3.5 ${viewMode === 'serviceComplaints' ? 'text-white' : 'text-rose-600'}`} />
                  <span>Complaints</span>
                </button>
              </div>
            </div>

            {onOpenAIAgent && (
              <button
                onClick={onOpenAIAgent}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                title="Open Assistant"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              title="Refresh latest live data across all Google Sheets (PMS, Final QC, Dispatch, Ready Goods, Ready Stock, Receivables, Gross Profit, Sales)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>

        {/* MOBILE VIEW (Visible on screens < md) - CRAFTED FOR FLUID TOUCH EXPERIENCE */}
        <div className="flex md:hidden flex-col gap-2.5 w-full">
          {/* Mobile Top Row: Branding & Refresh Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 px-2 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                <img 
                  src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png" 
                  alt="Little Nap Recliners Logo" 
                  className="h-5 w-auto object-contain max-w-[100px]" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="truncate">
                <h1 className="text-sm font-black text-slate-900 tracking-tight truncate leading-tight">
                  Little Nap Recliners
                </h1>
                <span className="text-[10px] font-semibold text-slate-500">
                  Portal &middot; {mobileNavItems.find(item => item.id === viewMode)?.label || 'Overview'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenAIAgent && (
                <button
                  onClick={onOpenAIAgent}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[36px]"
                  title="Open Assistant"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Ask</span>
                </button>
              )}

              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[36px]"
                title="Refresh latest live data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? '...' : 'Refresh'}</span>
              </button>
            </div>
          </div>


          {/* Mobile Swipeable Module Bar with Momentum Scroll */}
          <div className="relative">
            <div 
              className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = viewMode === item.id;
                return (
                  <button
                    key={item.id}
                    ref={isActive ? activeMobileTabRef : undefined}
                    onClick={() => onViewModeChange(item.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer min-h-[38px] ${
                      isActive 
                        ? `${item.activeClass} border-transparent shadow-xs` 
                        : `${item.inactiveClass} hover:border-slate-300`
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-inherit' : 'opacity-80'}`} />
                    <span className="whitespace-nowrap">{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-800'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
