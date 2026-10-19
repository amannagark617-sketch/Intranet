import React, { useState, useEffect, useMemo } from 'react';
import { 
  ExecutiveResource, 
  ResourceCategory, 
  ResourceType, 
  fetchExecutiveHubData, 
  computeExecutiveHubAnalytics,
  togglePinResource,
  getPinnedResourceIds
} from '../services/executiveHubService';
import { 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Pin, 
  Sparkles, 
  FileSpreadsheet, 
  FolderGit2, 
  LayoutGrid, 
  List, 
  BarChart3, 
  AppWindow, 
  ShieldCheck, 
  TrendingUp, 
  Factory, 
  RefreshCw,
  Share2,
  FolderOpen,
  FolderKanban
} from 'lucide-react';

interface ExecutiveHubDashboardProps {
  onBackToDashboard?: () => void;
}

const CATEGORIES: { label: string; value: ResourceCategory | 'ALL'; icon: React.ReactNode; color: string }[] = [
  { label: 'All', value: 'ALL', icon: <LayoutGrid className="w-4 h-4" />, color: 'bg-slate-100 text-slate-800' },
  { label: 'Leadership & MIS', value: 'Leadership & MIS', icon: <Sparkles className="w-4 h-4" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Finance & Costing', value: 'Finance & Costing', icon: <TrendingUp className="w-4 h-4" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Factory & Operations', value: 'Factory & Operations', icon: <Factory className="w-4 h-4" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Sales, CRM & Growth', value: 'Sales, CRM & Growth', icon: <BarChart3 className="w-4 h-4" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Legal, IPO & Corporate', value: 'Legal, IPO & Corporate', icon: <ShieldCheck className="w-4 h-4" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Media, HR & Admin', value: 'Media, HR & Admin', icon: <FolderOpen className="w-4 h-4" />, color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export const ExecutiveHubDashboard: React.FC<ExecutiveHubDashboardProps> = ({ onBackToDashboard }) => {
  const [resources, setResources] = useState<ExecutiveResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<ResourceType | 'ALL'>('ALL');
  const [viewFormat, setViewFormat] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData(false);
    setPinnedIds(getPinnedResourceIds());
  }, []);

  const loadData = async (manual: boolean) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await fetchExecutiveHubData(manual);
      setResources(data);
    } catch (err) {
      console.error('Failed to load Executive Hub data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = togglePinResource(id);
    setPinnedIds(updated);
    setResources(prev => 
      prev.map(r => r.id === id ? { ...r, isPinned: updated.includes(id) } : r)
    );
  };

  const handleCopyLink = (link: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const analytics = useMemo(() => {
    return computeExecutiveHubAnalytics(resources);
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      // Category filter
      if (selectedCategory !== 'ALL' && res.category !== selectedCategory) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && res.resourceType !== selectedType) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = res.title.toLowerCase().includes(q);
        const inDesc = res.description.toLowerCase().includes(q);
        const inLink = res.link.toLowerCase().includes(q);
        const inCategory = res.category.toLowerCase().includes(q);
        const inTags = res.tags.some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inLink && !inCategory && !inTags) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      // Pinned items first, then by S.No
      const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return a.sNo - b.sNo;
    });
  }, [resources, selectedCategory, selectedType, searchQuery, pinnedIds]);

  const pinnedResources = useMemo(() => {
    return resources.filter(r => pinnedIds.includes(r.id));
  }, [resources, pinnedIds]);

  const getBadgeForType = (type: ResourceType) => {
    switch (type) {
      case 'Google Sheet':
        return {
          icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />,
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: 'Google Sheet'
        };
      case 'Google Drive':
        return {
          icon: <FolderGit2 className="w-3.5 h-3.5 text-amber-600" />,
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Drive Folder'
        };
      case 'Looker Studio':
        return {
          icon: <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />,
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          label: 'Looker BI'
        };
      case 'Web App / Portal':
        return {
          icon: <AppWindow className="w-3.5 h-3.5 text-indigo-600" />,
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          label: 'Web Portal'
        };
      default:
        return {
          icon: <Share2 className="w-3.5 h-3.5 text-slate-600" />,
          bg: 'bg-slate-50 text-slate-800 border-slate-200',
          label: 'Link'
        };
    }
  };

  const getCategoryColor = (cat: ResourceCategory) => {
    switch (cat) {
      case 'Leadership & MIS': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Finance & Costing': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Factory & Operations': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Sales, CRM & Growth': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Legal, IPO & Corporate': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Media, HR & Admin': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 pt-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Directory</h1>
        <p className="mt-1 text-sm text-slate-500">Links to the company's sheets, reports and portals</p>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 mt-6 space-y-6">
          {/* Pinned Quick Access (if any) */}
          {pinnedResources.length > 0 && (
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-indigo-100 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-indigo-950 font-semibold text-sm">
                <Pin className="w-4 h-4 fill-indigo-600 text-indigo-600" />
                <span>Pinned Quick Launch ({pinnedResources.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {pinnedResources.map(pin => (
                  <a
                    key={pin.id}
                    href={pin.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-200/70 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="p-1.5 rounded-lg bg-white shadow-2xs text-indigo-600">
                        {getBadgeForType(pin.resourceType).icon}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-indigo-900">
                          {pin.title}
                        </div>
                        <div className="text-[13px] text-slate-500 truncate">
                          {pin.category}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-500 opacity-70 group-hover:opacity-100 shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search the directory"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* View switcher & Type filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as ResourceType | 'ALL')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All types</option>
                <option value="Google Sheet">Google Sheets</option>
                <option value="Web App / Portal">Web Apps & Portals</option>
                <option value="Google Drive">Drive Archives</option>
                <option value="Looker Studio">Looker BI Dashboards</option>
                <option value="External Link">External Links</option>
              </select>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewFormat('grid')}
                  className={`p-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    viewFormat === 'grid' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewFormat('table')}
                  className={`p-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    viewFormat === 'table' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Compact Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Directory Resources"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map(cat => {
              const count = cat.value === 'ALL' 
                ? resources.length 
                : resources.filter(r => r.category === cat.value).length;
              
              const isSelected = selectedCategory === cat.value;

              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[13px] font-semibold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">Loading master company directory...</p>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && (
          <div className="flex items-center justify-between text-[13px] text-slate-500 px-1 font-medium">
            <span>
              Showing <strong className="text-slate-800">{filteredResources.length}</strong> of {resources.length} resources
            </span>
            {searchQuery && (
              <span>Filtered by: &ldquo;{searchQuery}&rdquo;</span>
            )}
          </div>
        )}

        {/* GRID VIEW */}
        {!isLoading && viewFormat === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredResources.map((res) => {
              const typeBadge = getBadgeForType(res.resourceType);
              const catColor = getCategoryColor(res.category);
              const isPinned = pinnedIds.includes(res.id);

              return (
                <div
                  key={res.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between p-4 group relative"
                >
                  {/* Top Bar: S.No, Category, Pin */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                          #{res.sNo}
                        </span>
                        <span className={`text-[13px] font-semibold px-2.5 py-0.5 rounded-full border ${catColor}`}>
                          {res.category}
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleTogglePin(res.id, e)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isPinned 
                            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' 
                            : 'text-slate-500 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title={isPinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-indigo-600' : ''}`} />
                      </button>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 leading-snug">
                        {res.title}
                      </h3>
                      <p className="text-[13px] text-slate-500 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                        {res.description}
                      </p>
                    </div>

                    {/* Format Badge & Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className={`inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-md border ${typeBadge.bg}`}>
                        {typeBadge.icon}
                        <span>{typeBadge.label}</span>
                      </span>
                      {res.tags.map(t => (
                        <span key={t} className="text-[13px] font-medium px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md border border-slate-100">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => handleCopyLink(res.link, res.id, e)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedId === res.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[13px] text-emerald-600 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[13px]">Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={res.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-all shadow-xs hover:shadow-sm cursor-pointer"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TABLE VIEW */}
        {!isLoading && viewFormat === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[13px] font-semibold text-slate-500">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Resource / Sheet Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700">
                  {filteredResources.map((res) => {
                    const typeBadge = getBadgeForType(res.resourceType);
                    const catColor = getCategoryColor(res.category);
                    const isPinned = pinnedIds.includes(res.id);

                    return (
                      <tr key={res.id} className="hover:bg-indigo-50/40 transition-colors group">
                        <td className="py-3 px-4 font-semibold text-slate-500 text-center">
                          {res.sNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 group-hover:text-indigo-600">
                          <div className="flex items-center gap-2">
                            {isPinned && <Pin className="w-3 h-3 fill-indigo-600 text-indigo-600 shrink-0" />}
                            <span>{res.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`text-[13px] font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>
                            {res.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-md border ${typeBadge.bg}`}>
                            {typeBadge.icon}
                            <span>{typeBadge.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-md truncate">
                          {res.description}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleCopyLink(res.link, res.id, e)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedId === res.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={res.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-all"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty Search Result */}
        {!isLoading && filteredResources.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
            <Search className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No matching resources found</h3>
            <p className="text-[13px] text-slate-500 max-w-sm mx-auto">
              We couldn&apos;t find any company resource matching your search or active filter. Try resetting your search query or selecting &ldquo;All Resources&rdquo;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedType('ALL');
              }}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[13px] font-semibold hover:bg-indigo-100 transition-all cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveHubDashboard;
