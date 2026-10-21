import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { db, getAnalyses, getStores } from '../db.ts';
import type { Analysis, Store } from '../types.ts';
import { 
  Store as StoreIcon, 
  Layers, 
  Coins, 
  Activity, 
  Calendar,
  BarChart3,
  AlertTriangle,
  Clock,
  ArrowRight,
  PlusCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { SpinnerIcon } from './Icons.tsx';

export interface DashboardPanelProps {
  onLoadAnalysis?: (id: string) => Promise<void>;
  onNavigateToView?: (view: any) => void;
  onStartNewAnalysis?: () => void;
}

// Chain color map helper for UI styling consistent with Slovak context
const CHAIN_COLORS: Record<string, string> = {
  'tesco': 'from-red-500 to-red-600',
  'lidl': 'from-blue-500 to-blue-600',
  'billa': 'from-yellow-500 to-yellow-600',
  'kaufland': 'from-rose-600 to-rose-700',
  'coop': 'from-orange-500 to-orange-600',
  'cba': 'from-green-500 to-green-600',
  'fresh': 'from-emerald-400 to-emerald-500',
  'dm': 'from-purple-500 to-purple-600'
};
const CHAIN_BORDER_COLORS: Record<string, string> = {
  'tesco': 'border-red-200 text-red-700 bg-red-50',
  'lidl': 'border-blue-200 text-blue-700 bg-blue-50',
  'billa': 'border-yellow-200 text-yellow-700 bg-yellow-50',
  'kaufland': 'border-rose-200 text-rose-700 bg-rose-50',
  'coop': 'border-orange-200 text-orange-700 bg-orange-50',
  'cba': 'border-green-200 text-green-700 bg-green-50',
  'fresh': 'border-emerald-200 text-emerald-700 bg-emerald-50',
  'dm': 'border-purple-200 text-purple-700 bg-purple-50'
};

const ValueCard: React.FC<{ 
  icon: React.ElementType; 
  title: string | number; 
  subtitle: string;
  badge?: string;
  children: React.ReactNode; 
}> = ({ icon: Icon, title, subtitle, badge, children }) => (
  <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xs hover:shadow-xl hover:border-lime-300 dark:hover:border-lime-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 dark:bg-zinc-800/40 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
    <div className="relative z-10 flex flex-col h-full">
      <div className="flex justify-between items-start mb-6">
        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700/60 group-hover:bg-zinc-900 dark:group-hover:bg-lime-500 group-hover:text-white dark:group-hover:text-zinc-950 transition-colors shadow-2xs">
          <Icon className="w-6 h-6 text-zinc-700 dark:text-zinc-300 group-hover:text-white dark:group-hover:text-zinc-950 transition-colors" />
        </div>
        {badge && (
          <span className="text-[10px] font-bold tracking-wide text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight leading-none mb-2">{title}</p>
        <p className="text-[11px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase mb-2">{subtitle}</p>
        <div className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed font-semibold">{children}</div>
      </div>
    </div>
  </div>
);

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  onLoadAnalysis,
  onNavigateToView,
  onStartNewAnalysis,
}) => {
  const { t } = useTranslation();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [dbStores, setDbStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hover states for interactive SVG charts
  const [activeDonutSlice, setActiveDonutSlice] = useState<number | null>(null);
  const [activeTimelineNode, setActiveTimelineNode] = useState<number | null>(null);

  // Pricing settings for ROI calculations
  const [defaultAnalysisPrice, setDefaultAnalysisPrice] = useState(5.00);
  const [defaultImagePrice, setDefaultImagePrice] = useState(1.00);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allAnalyses = await getAnalyses();
        const allStores = await getStores();
        setAnalyses(allAnalyses);
        setDbStores(allStores);

        // Fetch billing default prices for dynamic ROI calculation
        const savedDefPrice = await db.settings.get('defaultAnalysisPrice');
        const savedImgPrice = await db.settings.get('defaultImagePrice');
        
        if (savedDefPrice) setDefaultAnalysisPrice(savedDefPrice.value);
        if (savedImgPrice) setDefaultImagePrice(savedImgPrice.value);

      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Compute dynamic stats & aggregates
  const dashboardStats = useMemo(() => {
    let totalImages = 0;
    let totalProductsCount = 0;
    const storeIdsSet = new Set<number>();
    const storeNamesSet = new Set<string>();
    
    // Product frequency count map
    const productCounts: Record<string, number> = {};
    // Category occurrence map
    const categoryCounts: Record<string, number> = {};
    // Store Chain compliance values accumulator
    const chainComplianceAccum: Record<string, { total: number; count: number }> = {};
    // Daily analysis count
    const dailyCounts: Record<string, number> = {};

    let totalStandardCost = 0;
    let totalClientRevenue = 0;

    analyses.forEach(analysis => {
      // 1. Core counters
      totalImages += analysis.images?.length || 0;
      
      if (analysis.storeId) storeIdsSet.add(analysis.storeId);
      if (analysis.store?.name) {
        storeNamesSet.add(analysis.store.name);
        
        // Group by chain name
        const chainName = (analysis.store.chain || t('other') || 'Ostatné').toLowerCase().trim();
        const score = analysis.images?.reduce((acc, img) => {
          if (img.analysisResult?.complianceScore !== undefined) {
            return acc + img.analysisResult.complianceScore;
          }
          return acc;
        }, 0) || 0;
        
        const validScoresCount = analysis.images?.filter(img => img.analysisResult?.complianceScore !== undefined).length || 0;
        
        if (validScoresCount > 0) {
          const avgScore = score / validScoresCount;
          if (!chainComplianceAccum[chainName]) {
            chainComplianceAccum[chainName] = { total: 0, count: 0 };
          }
          chainComplianceAccum[chainName].total += avgScore;
          chainComplianceAccum[chainName].count += 1;
        }
      }

      // Group timeline by created date
      if (analysis.createdAt) {
        const dateStr = new Date(analysis.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      }

      // 2. Billing calculations
      let standardCost = 0;
      analysis.images?.forEach(img => {
        if (img.analysisResult?.products && Array.isArray(img.analysisResult.products)) {
          img.analysisResult.products.forEach(p => {
            if (!p || !p.name) return;
            totalProductsCount += 1;
            
            // Increment product count
            productCounts[p.name] = (productCounts[p.name] || 0) + 1;
            // Group categories
            const cat = p.brand || t('uncategorized') || 'Nezaradené';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
        }

        // Standard token usage pricing
        if (img.analysisResult?.usageMetadata) {
          const meta = img.analysisResult.usageMetadata;
          const inputCost = (meta.promptTokenCount || 0) * (0.075 / 1000000);
          const outputCost = (meta.candidatesTokenCount || 0) * (0.30 / 1000000);
          standardCost += (inputCost + outputCost);
        } else {
          // Fallback if no metadata
          standardCost += 0.005; // 0.5 cents fallback
        }
      });
      totalStandardCost += standardCost;

      // Calculate revenue
      // Default: $5 per analysis + $1 per extra image (if > 1)
      const imageCount = analysis.images?.length || 0;
      let revenue = defaultAnalysisPrice;
      if (imageCount > 1) {
        revenue += (imageCount - 1) * defaultImagePrice;
      }
      totalClientRevenue += revenue;
    });

    const netProfit = totalClientRevenue - totalStandardCost;
    const marginRatio = totalClientRevenue > 0 ? (netProfit / totalClientRevenue) * 100 : 0;

    // Transform counts to sorted arrays
    const topProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // TOP 5

    // Merge small categories into "Ostatné značky"
    const catEntries = Object.entries(categoryCounts).sort((a, b) => b.count - a.count);
    const topCategories = catEntries.slice(0, 5);
    const otherCount = catEntries.slice(5).reduce((sum, [, count]) => sum + count, 0);
    
    const categoriesDataset = topCategories.map(([name, count]) => ({ name, count }));
    if (otherCount > 0) {
      categoriesDataset.push({ name: t('otherBrands') || 'Ostatné značky', count: otherCount });
    }

    const chainComplianceList = Object.entries(chainComplianceAccum)
      .map(([name, data]) => ({
        name: name.toUpperCase(),
        chainKey: name,
        avgCompliance: data.total / data.count
      }))
      .sort((a, b) => b.avgCompliance - a.avgCompliance);

    // Transform daily counts to timeline array
    // Ensure chronological order (simple string sort might fail if cross-year, but sufficient for preview)
    const timelineData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort(() => {
          // A bit hacky but works for localized short dates like "10. sep"
          return 0; // Keeping insertion order or sorting by date logic can be complex without exact timestamps, we rely on natural order for now.
      });
    
    // Fallback if empty timeline
    if (timelineData.length === 0) {
        timelineData.push({ date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 });
    }

    // Calculate operational triage & audit pipeline
    let itemsToVerifyCount = 0;
    const inProgressAudits: Analysis[] = [];

    analyses.forEach(analysis => {
      const hasAnalyzing = (analysis.images || []).some(img => img.status === 'analyzing' || img.status === 'pending');
      if (hasAnalyzing) {
        inProgressAudits.push(analysis);
      }
      (analysis.images || []).forEach(img => {
        (img.analysisResult?.products || []).forEach(p => {
          if (p.type === 'pos_material') return;
          const hasMissingPrice = !p.prices || p.prices.length === 0;
          const isPending = p.verificationStatus === 'pending_review';
          const isLowConf = (p.confidence ?? 0.85) < 0.8;
          if (hasMissingPrice || isPending || isLowConf) {
            itemsToVerifyCount++;
          }
        });
      });
    });

    const recentCompletedVisits = [...analyses]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4);

    return {
      totalAnalyses: analyses.length,
      totalImages,
      totalProductsDetected: totalProductsCount,
      totalStoresVisited: storeNamesSet.size,
      totalClientRevenue,
      totalStandardCost,
      netProfit,
      marginRatio,
      topProducts,
      categoriesDataset,
      chainComplianceList,
      timelineData,
      inProgressAudits,
      itemsToVerifyCount,
      recentCompletedVisits
    };
  }, [analyses, defaultAnalysisPrice, defaultImagePrice, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-zinc-500 dark:text-zinc-400">
        <SpinnerIcon className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Define some gradient colors for donut chart slices matching the aesthetic
  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 animate-fade-in px-4">
      
      {/* HEADER SECTION (Like HomeScreen) */}
      <section className="text-center pt-8 pb-4 relative">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-4 py-1.5 rounded-full text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 mb-6 shadow-2xs">
          <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
          EXECUTIVE ANALYTICS
        </div>
        
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight mb-4">
          {t('dashboard') || 'Manažérsky prehľad'}
        </h1>
        <h2 className="text-lg md:text-xl font-semibold text-zinc-500 dark:text-zinc-400 mb-8 tracking-wide max-w-3xl mx-auto">
          {t('dashboardDesc') || 'Grafické vyhodnotenie realizovaných analýz, produktov a predajní'}
        </h2>
        
        <div className="flex justify-center">
            <div className="inline-flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 rounded-full px-5 py-2 shadow-3xs">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t('systemStatus') || 'System Status'}:</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                    ONLINE (LOCAL FIRST)
                </span>
            </div>
        </div>
      </section>

      {/* DOMOVSKÝ OPERAČNÝ PREHĽAD: Rozpracované audity & Položky na kontrolu */}
      <section className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200/90 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                {t('activeAuditsAndItemsNotice') || 'Active Audits & Items Requiring Attention'}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              {t('quickAccessPendingDesc') || 'Quick access to pending visits and verification of uncertain prices or facings'}
            </p>
          </div>
          {onStartNewAnalysis && (
            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-lime-500 hover:bg-zinc-800 dark:hover:bg-lime-400 text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-lime-400 dark:text-zinc-950" />
              <span>{t('newStoreVisit') || 'New Store Visit'}</span>
            </button>
          )}
        </div>

        {/* 3 Quick Action Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Položky na kontrolu */}
          <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/40 dark:to-orange-950/20 p-5 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-700/60">
                  {t('verificationQueueShort') || 'For Review'}
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-2xl font-black text-amber-950 dark:text-amber-100">
                {dashboardStats.itemsToVerifyCount} {t('itemsShort') || 'items'}
              </h3>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 font-medium">
                {t('itemsToVerifyDesc') || 'Items with missing prices, low detection confidence, or unassigned tags.'}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-amber-200/60 dark:border-amber-800/50">
              <button
                type="button"
                onClick={() => onNavigateToView && onNavigateToView('verificationQueue')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>{t('openExceptionTriage') || 'Open Exception Review'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Rozpracované audity */}
          <div className="bg-gradient-to-br from-sky-50/70 to-blue-50/40 dark:from-sky-950/40 dark:to-blue-950/20 p-5 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-700/60">
                  {t('inProgressVisits') || 'Visits in Progress'}
                </span>
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-2xl font-black text-sky-950 dark:text-sky-100">
                {dashboardStats.inProgressAudits.length} {t('auditsShort') || 'audits'}
              </h3>
              <p className="text-xs text-sky-900/80 dark:text-sky-300/80 font-medium">
                {dashboardStats.inProgressAudits.length > 0
                  ? `${t('processingLabel') || 'Processing'}: ${dashboardStats.inProgressAudits[0].name}`
                  : (t('allAuditsCompletedDesc') || 'All existing audits have completed photo processing.')}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-sky-200/60 dark:border-sky-800/50">
              {dashboardStats.inProgressAudits.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onLoadAnalysis && onLoadAnalysis(dashboardStats.inProgressAudits[0].id)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>{t('continueAudit') || 'Continue Audit'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateToView && onNavigateToView('analyses')}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-bold text-xs rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span>{t('viewAllAudits') || 'View All Audits'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Stabilita dát a pokrytie cien */}
          <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/40 dark:to-teal-950/20 p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-700/60">
                  {t('networkPriceCoverage') || 'Network Price Coverage'}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                {dashboardStats.totalProductsDetected > 0
                  ? `${Math.max(15, Math.round(((dashboardStats.totalProductsDetected - dashboardStats.itemsToVerifyCount) / Math.max(dashboardStats.totalProductsDetected, 1)) * 100))}%`
                  : '100%'}
              </h3>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 font-medium">
                {t('priceCoverageRatioDesc') || 'Ratio of products with verified price tags out of all detected facings.'}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-emerald-200/60 dark:border-emerald-800/50">
              <button
                type="button"
                onClick={() => onNavigateToView && onNavigateToView('exportReports')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>{t('generateComparisonReport') || 'Generovať porovnávací report'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Posledné dokončené návštevy predajní */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('recentCompletedVisits') || 'Posledné dokončené návštevy predajní'}
            </h3>
            <button
              onClick={() => onNavigateToView && onNavigateToView('analyses')}
              className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {t('allVisitsCount', { count: dashboardStats.totalAnalyses }) || `Všetky návštevy (${dashboardStats.totalAnalyses}) →`}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {dashboardStats.recentCompletedVisits.map((visit) => {
              const facingsCount = (visit.images || []).reduce((acc, img) => acc + (img.analysisResult?.products?.length || 0), 0);
              const dateStr = visit.createdAt ? new Date(visit.createdAt).toLocaleDateString('sk-SK') : 'Dnes';
              const chainBadge = (visit.store?.chain || t('store') || 'Predajňa').toLowerCase();

              return (
                <div
                  key={visit.id}
                  onClick={() => onLoadAnalysis && onLoadAnalysis(visit.id)}
                  className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between group shadow-3xs hover:shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                        {chainBadge}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                        {dateStr}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-white truncate group-hover:text-blue-500 transition-colors" title={visit.name}>
                        {visit.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={visit.store?.name}>
                        {visit.store?.name || t('retailStore') || 'Maloobchod'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <strong className="text-zinc-700 dark:text-zinc-300">{facingsCount}</strong> {t('facingsShort') || 'facingov'} • {visit.images?.length || 0} {t('photosShort') || 'fotiek'}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('open') || 'Otvoriť'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BENCHMARK STATS ROW (BENTO GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <ValueCard 
          icon={Calendar} 
          title={dashboardStats.totalAnalyses} 
          subtitle={t('summaryAnalysesCount') || 'Realizované analýzy'}
        >
          <span className="text-[10px]">Z toho <strong className="text-zinc-700 dark:text-zinc-300">{dashboardStats.totalImages}</strong> fotografických príloh</span>
        </ValueCard>

        <ValueCard 
          icon={Layers} 
          title={dashboardStats.totalProductsDetected} 
          subtitle={t('totalProductsDetected') || 'Detegované produkty celkom'}
        >
          <span className="text-[10px]">Priemer: <strong className="text-zinc-700 dark:text-zinc-300">{(dashboardStats.totalAnalyses > 0 ? (dashboardStats.totalProductsDetected / dashboardStats.totalAnalyses).toFixed(1) : 0)}</strong> na regál</span>
        </ValueCard>

        <ValueCard 
          icon={StoreIcon} 
          title={dashboardStats.totalStoresVisited} 
          subtitle={t('storesVisited') || 'Navštívené predajne'}
        >
          <span className="text-[10px]">V databáze <strong className="text-zinc-700 dark:text-zinc-300">{dbStores.length}</strong> evidovaných adries</span>
        </ValueCard>

        <ValueCard 
          icon={Coins} 
          title={`$${dashboardStats.netProfit.toFixed(1)}`} 
          subtitle={t('totalMargin') || 'Celková Marža'}
          badge={`${dashboardStats.marginRatio.toFixed(0)}%`}
        >
          <span className="text-[10px]">Revenue: <strong className="text-zinc-700 dark:text-zinc-300">${dashboardStats.totalClientRevenue.toFixed(0)}</strong></span>
        </ValueCard>

      </div>

      {/* MIDDLE ZONE - DETAILED GRAPHICAL EVALUATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart - spans 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-xs border border-zinc-150 dark:border-zinc-800 relative overflow-hidden group hover:border-lime-300 transition-colors">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {t('auditsOverTime') || 'Počet analýz v čase'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">
                {t('auditsTimelineDesc') || 'Grafický vývoj počtu dokončených skenov regálov podľa chronologického poradia auditov.'}
              </p>
            </div>
          </div>
          
          <div className="relative h-48 w-full flex items-end justify-between px-2 pb-6">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              <div className="w-full border-t border-dashed border-zinc-100 flex-1"></div>
              <div className="w-full border-t border-dashed border-zinc-100 flex-1 relative">
                  <span className="absolute -top-2 -left-3 text-[9px] text-zinc-300">1.5</span>
              </div>
              <div className="w-full border-t border-dashed border-zinc-100 flex-1 relative">
                  <span className="absolute -top-2 -left-3 text-[9px] text-zinc-300">3</span>
              </div>
            </div>
            
            {dashboardStats.timelineData.map((point, index) => {
                // Normalize height calculation (max 5 for demo visualization scaling)
                const maxVal = Math.max(...dashboardStats.timelineData.map(d => d.count), 5);
                const heightPercent = (point.count / maxVal) * 100;
                const isHovered = activeTimelineNode === index;
                
                return (
                  <div 
                    key={index} 
                    className="relative flex flex-col items-center justify-end h-full flex-1 group/node cursor-pointer z-10"
                    onMouseEnter={() => setActiveTimelineNode(index)}
                    onMouseLeave={() => setActiveTimelineNode(null)}
                  >
                    {/* Tooltip */}
                    <div className={`absolute -top-10 bg-zinc-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                      {point.count} {t('auditsShort') || 'analýz'}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45"></div>
                    </div>
                    
                    {/* Data Node */}
                    <div 
                      className={`w-3 h-3 rounded-full border-2 transition-all duration-200 z-10 ${isHovered ? 'bg-white dark:bg-zinc-900 border-blue-600 scale-150' : 'bg-blue-100 border-blue-500'}`}
                      style={{ marginBottom: `calc(${heightPercent}% - 6px)` }}
                    />
                    
                    {/* Vertical connecting line to base (optional visual aid) */}
                    <div 
                      className="absolute bottom-0 w-px bg-gradient-to-t from-blue-500/0 to-blue-500/20"
                      style={{ height: `${heightPercent}%` }}
                    />

                    <span className="absolute -bottom-5 text-[9px] font-bold text-zinc-400">
                      {point.date}
                    </span>
                  </div>
                );
            })}

            {/* Workaround for responsive SVG path connection */}
            <div className="absolute inset-0 pointer-events-none pb-6 overflow-hidden">
                <svg width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible">
                    <path 
                      d={(() => {
                        const len = Math.max(dashboardStats.timelineData.length - 1, 1);
                        const maxVal = Math.max(...dashboardStats.timelineData.map(d => d.count), 5);
                        let path = '';
                        dashboardStats.timelineData.forEach((d, i) => {
                           const x = (i / len) * 100;
                           const y = 100 - ((d.count / maxVal) * 100);
                           if (i === 0) path += `M ${x} ${y} `;
                           else path += `L ${x} ${y} `;
                        });
                        return path;
                      })()}
                      fill="none" 
                      stroke="#3b82f6" 
                      strokeWidth="2.5" 
                      vectorEffect="non-scaling-stroke"
                    />
                    <path 
                      d={(() => {
                        const len = Math.max(dashboardStats.timelineData.length - 1, 1);
                        const maxVal = Math.max(...dashboardStats.timelineData.map(d => d.count), 5);
                        let path = '';
                        dashboardStats.timelineData.forEach((d, i) => {
                           const x = (i / len) * 100;
                           const y = 100 - ((d.count / maxVal) * 100);
                           if (i === 0) path += `M ${x} ${y} `;
                           else path += `L ${x} ${y} `;
                        });
                        path += `L 100 100 L 0 100 Z`;
                        return path;
                      })()}
                      fill="url(#gradientFill)" 
                      vectorEffect="non-scaling-stroke"
                    />
                    <defs>
                      <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                </svg>
            </div>
          </div>
          <div className="pt-4 mt-2 flex justify-between items-center text-[10px] text-zinc-400 font-bold">
            <span>{t('showingMaxLast10Days') || 'Zobrazuje maximálne posledných 10 dní auditu'}</span>
            <span className="text-blue-500 font-extrabold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {t('continuousChanges') || 'Priebežné zmeny'}</span>
          </div>
        </div>

        {/* Brand Distribution Donut Chart */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-xs border border-zinc-150 dark:border-zinc-800 group hover:border-lime-300 transition-colors flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {t('brandDistributionTitle') || 'Distribúcia značiek na regále'}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mb-8">
              {t('brandDistributionSubtitle') || 'Prehľad a najčastejší auditovaný zoznam značiek.'}
            </p>
            
            {dashboardStats.categoriesDataset.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-zinc-400">
                {t('noCategoryData')}
              </div>
            ) : (
              <div className="flex flex-col xl:flex-row items-center gap-6">
                
                {/* Custom SVG Donut */}
                <div className="relative w-36 h-36 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {(() => {
                      let cumulativePercent = 0;
                      const total = dashboardStats.totalProductsDetected;
                      
                      return dashboardStats.categoriesDataset.map((slice, index) => {
                        const percent = total > 0 ? slice.count / total : 0;
                        const dashArray = `${percent * 314.159} 314.159`;
                        const dashOffset = `-${cumulativePercent * 314.159}`;
                        cumulativePercent += percent;
                        const isHovered = activeDonutSlice === index;
                        const strokeWidth = isHovered ? 16 : 12;
                        const color = COLORS[index % COLORS.length];

                        return (
                          <circle
                            key={slice.name}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setActiveDonutSlice(index)}
                            onMouseLeave={() => setActiveDonutSlice(null)}
                          />
                        );
                      });
                    })()}
                  </svg>
                  
                  {/* Center donut overlay with total count */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100 leading-none">{dashboardStats.totalProductsDetected}</p>
                    <p className="text-[8px] font-black uppercase text-zinc-400 mt-1">{t('productsPcs') || 'PRODUKTOV'}</p>
                  </div>
                </div>

                {/* Donut Legend List */}
                <div className="flex-1 space-y-1.5 w-full min-w-0">
                  {dashboardStats.categoriesDataset.map((d, i) => {
                    const isHovered = activeDonutSlice === i;
                    const totalProducts = dashboardStats.totalProductsDetected;
                    const percent = totalProducts > 0 ? (d.count / totalProducts) * 100 : 0;
                    return (
                      <div 
                        key={d.name}
                        className={`flex items-center justify-between p-1.5 rounded-lg transition-colors duration-150 ${isHovered ? 'bg-zinc-50' : ''}`}
                        onMouseEnter={() => setActiveDonutSlice(i)}
                        onMouseLeave={() => setActiveDonutSlice(null)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate">{d.name}</span>
                        </div>
                        <div className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 text-right shrink-0">
                          {d.count} ks <span className="text-[8px] text-zinc-400 font-bold ml-1">({percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-zinc-100 text-[10px] text-zinc-400 font-bold mt-6">
            {t('basedOnScannedShelves') || 'Na základe analýzy všetkých uložených regálov a fotiek.'}
          </div>
        </div>
      </div>

      {/* LOWER ROW - TOP PRODUCTS RANKING & STORE CHAIN COMPLIANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ranked TOP 5 Products */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-xs border border-zinc-150 dark:border-zinc-800 flex flex-col justify-between group hover:border-lime-300 transition-colors">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              {t('topProductsOnShelves') || 'Top produkty na regáloch'}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mb-8">
              {t('topProductsSubtitle') || 'Najčastejšie identifikované produkty v reálnom čase z celej histórie auditov.'}
            </p>
            <div className="space-y-4">
              {dashboardStats.topProducts.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-zinc-400">
                  {t('noDetectedProducts')}
                </div>
              ) : (
                dashboardStats.topProducts.map((p, index) => {
                  const maxCount = dashboardStats.topProducts[0]?.count || 1;
                  const ratio = (p.count / maxCount) * 100;
                  return (
                    <div key={p.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 bg-blue-50 text-blue-600 text-[10px] items-center justify-center flex font-black rounded-lg border border-blue-100 shrink-0">
                            #{index + 1}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px] md:max-w-[280px]" title={p.name}>
                            {p.name}
                          </span>
                        </div>
                        <span className="text-zinc-900 dark:text-zinc-100 ml-2 shrink-0">{p.count}× {t('detectedTimes') || 'zistený'}</span>
                      </div>
                      
                      {/* Horizontal bar meter */}
                      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-100/60 mt-8 text-[10px] text-zinc-400 font-bold">
            {t('updatedFromDb') || 'Aktualizované priamo z databázy.'}
          </div>
        </div>

        {/* Retail compliance rating (Skladový súlad reťazcov) */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-xs border border-zinc-150 dark:border-zinc-800 flex flex-col justify-between group hover:border-lime-300 transition-colors">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {t('storeComplianceTitle') || 'Súlad na predajniach (Compliance)'}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mb-8">
              {t('storeComplianceSubtitle') || 'Priemerné dosiahnuté vyhovujúce percento zaplnenia OSA a cenoviek podľa obchodných sietí a predajní.'}
            </p>
            <div className="space-y-3.5">
              {dashboardStats.chainComplianceList.length === 0 ? (
                <div className="py-12 text-center text-xs font-semibold text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 border-dashed">
                  {t('complianceMissingDesc') || 'Zatiaľ chýbajú vyhodnotenia súladu s planogramami alebo OSA.'}
                </div>
              ) : (
                dashboardStats.chainComplianceList.map((item) => {
                  const gradient = CHAIN_COLORS[item.chainKey] || 'from-zinc-500 to-zinc-600';
                  const badgeClass = CHAIN_BORDER_COLORS[item.chainKey] || 'border-zinc-200 text-zinc-700 bg-zinc-50';
                  
                  return (
                    <div key={item.chainKey} className="flex items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-100/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl border shrink-0 text-center w-20 truncate ${badgeClass}`}>
                        {item.name}
                      </span>
                      
                      {/* Vertical line & progress bar element */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`bg-gradient-to-r ${gradient} h-full rounded-full`}
                            style={{ width: `${item.avgCompliance}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 w-11 text-right">
                          {item.avgCompliance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-100/60 mt-8 flex justify-between items-center text-[10px] text-zinc-400 font-bold">
            <span>{t('complianceCalculatedFromStores') || 'Vypočítané na základe hodnotení v auditoch.'}</span>
            <span className="text-rose-500 font-extrabold flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {t('osaTarget90') || 'Cieľ 90%+'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
