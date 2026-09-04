import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { db, getAnalyses, getStores, MODEL_PRICING_TABLE } from '../db.ts';
import type { Analysis, Store } from '../types.ts';
import { 
  TrendingUp, 
  PieChart, 
  Store as StoreIcon, 
  Layers, 
  Coins, 
  Activity, 
  Sparkles,
  Calendar
} from 'lucide-react';
import { SpinnerIcon } from './Icons.tsx';

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

export const DashboardPanel: React.FC = () => {
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
        const chainName = (analysis.store.chain || 'Ostatné').toLowerCase().trim();
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
            const cat = p.brand || 'Nezaradené';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
        }

        // Standard token usage pricing
        if (img.analysisResult?.usageMetadata) {
          const meta = img.analysisResult.usageMetadata;

          const model = img.analysisResult.modelName || 'gemini-3.6-flash';
          const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.6-flash'];
          standardCost += (meta.promptTokenCount / 1000000) * pricing.input;
          standardCost += (meta.candidatesTokenCount / 1000000) * pricing.output;
        }
      });

      // Cost Panel fallback
      if (standardCost === 0 && analysis.costInfo?.cost) {
        standardCost = analysis.costInfo.cost;
      }
      totalStandardCost += standardCost;

      // Sales value client billed
      const manualPrice = analysis.manualPrice !== undefined
        ? analysis.manualPrice
        : (defaultAnalysisPrice + (analysis.images?.length || 0) * defaultImagePrice);
      totalClientRevenue += manualPrice;
    });

    // Top products formatting
    const topProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Categories donut dataset
    const categoriesDataset = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Remaining categories block
    const sumTopCats = categoriesDataset.reduce((acc, c) => acc + c.count, 0);
    const otherCatsSum = totalProductsCount - sumTopCats;
    if (otherCatsSum > 0) {
      categoriesDataset.push({ name: 'Ostatné značky', count: otherCatsSum });
    }

    // Chronological sorting for Timeline activity
    const timelineData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .slice(-10); // Display last 10 audit sessions

    // Format chain compliance list
    const chainComplianceList = Object.entries(chainComplianceAccum).map(([rawChain, accum]) => {
      const chainNorm = rawChain.toLowerCase().trim();
      const rawName = rawChain.charAt(0).toUpperCase() + rawChain.slice(1);
      return {
        chainKey: chainNorm,
        name: rawName,
        avgCompliance: accum.total / accum.count
      };
    }).sort((a, b) => b.avgCompliance - a.avgCompliance);

    const netProfit = totalClientRevenue - totalStandardCost;
    const marginRatio = totalClientRevenue > 0 ? (netProfit / totalClientRevenue) * 100 : 0;

    return {
      totalAnalyses: analyses.length,
      totalStoresVisited: Math.max(storeNamesSet.size, storeIdsSet.size),
      totalProductsDetected: totalProductsCount,
      totalImages,
      topProducts,
      categoriesDataset,
      timelineData,
      chainComplianceList,
      totalStandardCost,
      totalClientRevenue,
      netProfit,
      marginRatio
    };
  }, [analyses, defaultAnalysisPrice, defaultImagePrice]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <SpinnerIcon className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Define some gradient colors for donut chart slices
  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

  return (
    <div className="space-y-8 pb-20 animate-fade-in max-w-7xl mx-auto px-1">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 rounded-[2.5rem] shadow-xl border border-slate-800 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-[80px]"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Executive Analytics
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2 text-white">
              {t('dashboard') || 'Manažérsky Prehľad Salesapp'}
            </h1>
            <p className="text-sm font-semibold text-slate-400 max-w-2xl leading-relaxed">
              {t('dashboardDesc') || 'Komplexné vyhodnotenie vykonaných auditov, analýza regálového súladu produktov a finančnej marže projektu.'}
            </p>
          </div>
          
          <div className="flex flex-row items-center gap-4 bg-slate-900/65 border border-slate-800 rounded-3xl p-5 shrink-0">
            <Activity className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Systému</p>
              <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                ONLINE (LOCAL FIRST COLD)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BENCHMARK STATS ROW (BENTO GRID) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: Analyses */}
        <div className="bg-white p-7 rounded-[2rem] shadow-xs border border-slate-150 relative overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-blue-50/50 transition-colors">
            <Calendar className="w-20 h-20" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="p-3 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl w-fit mb-6">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-4xl font-black text-slate-900 tracking-tight mb-1">{dashboardStats.totalAnalyses}</p>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('summaryAnalysesCount') || 'Realizované analýzy'}</p>
              <p className="text-[10.5px] font-bold text-slate-500 mt-2">Z toho {dashboardStats.totalImages} fotografických príloh</p>
            </div>
          </div>
        </div>

        {/* Metric 2: Products */}
        <div className="bg-white p-7 rounded-[2rem] shadow-xs border border-slate-150 relative overflow-hidden group hover:border-emerald-300 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-emerald-50/50 transition-colors">
            <Layers className="w-20 h-20" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl w-fit mb-6">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-4xl font-black text-emerald-600 tracking-tight mb-1">{dashboardStats.totalProductsDetected}</p>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('totalProductsDetected') || 'Detegované produkty celkom'}</p>
              <p className="text-[10.5px] font-bold text-slate-500 mt-2">
                Priemer: <strong className="text-slate-700">{(dashboardStats.totalAnalyses > 0 ? (dashboardStats.totalProductsDetected / dashboardStats.totalAnalyses).toFixed(1) : 0)}</strong> na regál
              </p>
            </div>
          </div>
        </div>

        {/* Metric 3: Stores */}
        <div className="bg-white p-7 rounded-[2rem] shadow-xs border border-slate-150 relative overflow-hidden group hover:border-purple-300 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-purple-50/50 transition-colors">
            <StoreIcon className="w-20 h-20" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="p-3 bg-purple-50 border border-purple-100 text-purple-600 rounded-2xl w-fit mb-6">
              <StoreIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-4xl font-black text-slate-900 tracking-tight mb-1">{dashboardStats.totalStoresVisited}</p>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('storesVisited') || 'Navštívené predajne'}</p>
              <p className="text-[10.5px] font-bold text-slate-500 mt-2">V databáze {dbStores.length} evidovaných adries</p>
            </div>
          </div>
        </div>

        {/* Metric 4: Financial Revenue & Profit Margin */}
        <div className="bg-white p-7 rounded-[2rem] shadow-xs border border-slate-150 relative overflow-hidden group hover:border-indigo-300 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-amber-50/20 transition-colors">
            <Coins className="w-20 h-20" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl w-fit mb-6">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <p className="text-4xl font-black text-slate-900 tracking-tight mb-1">${dashboardStats.netProfit.toFixed(1)}</p>
              <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">{t('totalMargin') || 'Zisk (Marža projektu)'}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-lg">
                  {dashboardStats.marginRatio.toFixed(0)}% marža
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Revenue: ${dashboardStats.totalClientRevenue.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* MIDDLE ZONE - DETAILED GRAPHICAL EVALUATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Timeline Line/Area Chart widget */}
        <div className="lg:col-span-3 bg-white p-8 rounded-[2rem] shadow-3xs border border-slate-150 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  {t('allAnalysesChart') || 'Aktivita auditov regálov v čase'}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold leading-normal">
                  Grafický vývoj počtu dokončených skenov regálov podľa chronologického poradia auditov.
                </p>
              </div>
            </div>

            {/* SVG Timeline Chart Area */}
            {dashboardStats.timelineData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Calendar className="w-10 h-10 mb-2 stroke-[1.5]" />
                <span className="text-xs font-bold">Zatiaľ nie sú zaznamenané žiadne historické analýzy v čase</span>
              </div>
            ) : (
              <div className="h-64 w-full pt-4 relative">
                <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guideline Grids */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <line 
                      key={i} 
                      x1="40" 
                      y1={40 + ratio * 160} 
                      x2="480" 
                      y2={40 + ratio * 160} 
                      stroke="#F1F5F9" 
                      strokeWidth="1.5" 
                    />
                  ))}

                  {/* Build line coordinates */}
                  {(() => {
                    const data = dashboardStats.timelineData;
                    const maxVal = Math.max(...data.map(d => d.count), 3);
                    const width = 440;
                    const height = 160;
                    const dx = width / Math.max(data.length - 1, 1);
                    
                    const points = data.map((d, i) => {
                      const x = 40 + i * dx;
                      const y = 200 - (d.count / maxVal) * height;
                      return { x, y, val: d.count, date: d.date };
                    });

                    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaPath = points.length > 0 
                      ? `${linePath} L ${points[points.length - 1].x} 200 L ${points[0].x} 200 Z`
                      : '';

                    return (
                      <>
                        {/* Shaded Area */}
                        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

                        {/* Stroke Line */}
                        {linePath && (
                          <path 
                            d={linePath} 
                            fill="none" 
                            stroke="#2563EB" 
                            strokeWidth="3.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                          />
                        )}

                        {/* Interactive Data Nodes */}
                        {points.map((p, i) => {
                          const isHovered = activeTimelineNode === i;
                          return (
                            <g key={i} className="cursor-pointer">
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isHovered ? "7" : "4.5"} 
                                fill={isHovered ? "#2563EB" : "#FFFFFF"} 
                                stroke="#2563EB" 
                                strokeWidth="3" 
                                onMouseEnter={() => setActiveTimelineNode(i)}
                                onMouseLeave={() => setActiveTimelineNode(null)}
                                className="transition-all duration-150"
                              />
                              {/* Axis Label X */}
                              {i % 2 === 0 && (
                                <text 
                                  x={p.x} 
                                  y="222" 
                                  textAnchor="middle" 
                                  className="text-[9px] text-slate-400 font-extrabold"
                                >
                                  {p.date}
                                </text>
                              )}
                              
                              {/* Axis values on Y bar far-left */}
                              {i === 0 && (
                                <g className="text-[9px] fill-slate-400 font-extrabold text-right">
                                  <text x="32" y="44" textAnchor="end">{maxVal}</text>
                                  <text x="32" y="124" textAnchor="end">{(maxVal/2).toFixed(1)}</text>
                                  <text x="32" y="204" textAnchor="end">0</text>
                                </g>
                              )}

                              {/* Tooltip Overlay */}
                              {isHovered && (
                                <g>
                                  {/* Tooltip background card */}
                                  <rect 
                                    x={Math.min(Math.max(p.x - 45, 10), 400)} 
                                    y={Math.max(p.y - 45, 10)} 
                                    width="90" 
                                    height="30" 
                                    rx="8" 
                                    fill="#0F172A" 
                                  />
                                  <text 
                                    x={Math.min(Math.max(p.x, 55), 445)} 
                                    y={Math.max(p.y - 26, 29)} 
                                    textAnchor="middle" 
                                    fill="#FFFFFF" 
                                    className="text-[9px] font-black"
                                  >
                                    {p.val} {p.val === 1 ? 'analýza' : p.val < 5 ? 'analýzy' : 'analýz'}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[11px] font-semibold text-slate-500">
            <span>{t('showingMaxDays', { count: 10 })}</span>
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 block animate-pulse"></span>
              {t('ongoingChanges')}
            </span>
          </div>
        </div>

        {/* Brand category shares donut visualization */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-3xs border border-slate-150 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {t('brandShelfDistribution')}
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mb-6 leading-normal">
              {t('brandAuditOverview')}
            </p>

            {dashboardStats.categoriesDataset.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <PieChart className="w-10 h-10 mb-2 stroke-[1.5]" />
                <span className="text-xs font-bold">{t('noCategoryData')}</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                
                {/* SVG Donut */}
                <div className="relative w-40 h-40 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                    {(() => {
                      const data = dashboardStats.categoriesDataset;
                      const total = data.reduce((acc, curr) => acc + curr.count, 0);
                      
                      let cumulativePercent = 0;
                      
                      return data.map((d, index) => {
                        const percent = d.count / total;
                        const startAngle = cumulativePercent * 360;
                        cumulativePercent += percent;
                        const endAngle = cumulativePercent * 360;
                        
                        // Convert angles to polar coords
                        const rad = Math.PI / 180;
                        const r = 38; // Radius
                        const cx = 50;
                        const cy = 50;
                        
                        const x1 = cx + r * Math.cos((startAngle - 90) * rad);
                        const y1 = cy + r * Math.sin((startAngle - 90) * rad);
                        const x2 = cx + r * Math.cos((endAngle - 90) * rad);
                        const y2 = cy + r * Math.sin((endAngle - 90) * rad);
                        
                        const largeArcFlag = percent > 0.5 ? 1 : 0;
                        
                        const pathData = `
                          M ${x1} ${y1}
                          A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}
                        `;
                        
                        const isHovered = activeDonutSlice === index;
                        const strokeWidth = isHovered ? 13 : 9;
                        const color = COLORS[index % COLORS.length];

                        return (
                          <path
                            key={index}
                            d={pathData}
                            fill="none"
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
                    <p className="text-xl font-black text-slate-900 leading-none">{dashboardStats.totalProductsDetected}</p>
                    <p className="text-[8px] font-black uppercase text-slate-400 mt-1">{t('productsPcs')}</p>
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
                        className={`flex items-center justify-between p-1 rounded-lg transition-colors duration-150 ${isHovered ? 'bg-slate-50' : ''}`}
                        onMouseEnter={() => setActiveDonutSlice(i)}
                        onMouseLeave={() => setActiveDonutSlice(null)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-[11px] font-bold text-slate-600 truncate">{d.name}</span>
                        </div>
                        <div className="text-[10px] font-extrabold text-slate-900 text-right shrink-0">
                          {d.count} {t('pcsUnit')} <span className="text-[8px] text-slate-400 font-bold ml-1">({percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-50 text-[10px] text-slate-400 font-bold">
            {t('basedOnScannedShelves')}
          </div>
        </div>

      </div>

      {/* LOWER ROW - TOP PRODUCTS RANKING & STORE CHAIN COMPLIANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Ranked TOP 5 Products */}
        <div className="bg-white p-8 rounded-[2rem] shadow-3xs border border-slate-150 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              {t('topProductsOnShelves')}
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mb-6">
              {t('topProductsSubtitle')}
            </p>

            <div className="space-y-4">
              {dashboardStats.topProducts.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  {t('noDetectedProducts')}
                </div>
              ) : (
                dashboardStats.topProducts.map((p, index) => {
                  const maxCount = dashboardStats.topProducts[0]?.count || 1;
                  const ratio = (p.count / maxCount) * 100;
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 bg-blue-50 text-blue-600 text-[10px] items-center justify-center flex font-black rounded-lg border border-blue-100">
                            #{index + 1}
                          </span>
                          <span className="text-slate-700 truncate max-w-[200px] md:max-w-[280px]" title={p.name}>
                            {p.name}
                          </span>
                        </div>
                        <span className="text-slate-900 ml-2 shrink-0">{t('timesDetected', { count: p.count })}</span>
                      </div>
                      
                      {/* Horizontal bar meter */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-1000"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100/60 mt-6 text-[10px] text-slate-400 font-bold">
            {t('updatedFromDb')}
          </div>
        </div>

        {/* Retail compliance rating (Skladový súlad reťazcov) */}
        <div className="bg-white p-8 rounded-[2rem] shadow-3xs border border-slate-150 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {t('storeComplianceTitle')}
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mb-6">
              {t('storeComplianceSubtitle')}
            </p>

            <div className="space-y-3.5">
              {dashboardStats.chainComplianceList.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  {t('noComplianceData')}
                </div>
              ) : (
                dashboardStats.chainComplianceList.map((item) => {
                  const gradient = CHAIN_COLORS[item.chainKey] || 'from-slate-500 to-slate-600';
                  const badgeClass = CHAIN_BORDER_COLORS[item.chainKey] || 'border-slate-200 text-slate-700 bg-slate-50';
                  
                  return (
                    <div key={item.chainKey} className="flex items-center gap-4 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-colors">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl border shrink-0 text-center w-20 truncate ${badgeClass}`}>
                        {item.name}
                      </span>
                      
                      {/* Vertical line & progress bar element */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div 
                            className={`bg-gradient-to-r ${gradient} h-full rounded-full`}
                            style={{ width: `${item.avgCompliance}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-800 w-11 text-right">
                          {item.avgCompliance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100/60 mt-6 flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>{t('complianceCalculatedFromStores')}</span>
            <span className="text-rose-500 font-extrabold">{t('osaTarget90')}</span>
          </div>
        </div>

      </div>

    </div>
  );
};
